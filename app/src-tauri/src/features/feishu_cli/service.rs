use crate::features::feishu_cli::{
    schema, FeishuCliHealth, FeishuCliOperationLog, FeishuCliRequest, FeishuCliResponse,
    FeishuWritePreview,
};
use crate::infra::error::{AppError, AppResult};
use crate::infra::sqlite::AppDatabase;
use chrono::{Duration, Utc};
use rusqlite::params;
use serde_json::Value;
use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

const PREVIEW_TTL_MINUTES: i64 = 15;

#[derive(Clone)]
pub struct FeishuCliService {
    database: AppDatabase,
}

impl FeishuCliService {
    pub fn new(database: AppDatabase) -> Self {
        Self { database }
    }

    pub fn ensure_schema(&self) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        schema::ensure(&connection)
    }

    pub fn health(&self, cli_path: Option<String>) -> FeishuCliHealth {
        match resolve_cli_path(cli_path.as_deref()) {
            Ok(resolved) => match run_command(&resolved.path, &["--version".to_string()]) {
                Ok(output) => FeishuCliHealth {
                    installed: true,
                    path: Some(resolved.path.display().to_string()),
                    version: Some(first_non_empty_line(&output.stdout, &output.stderr)),
                    source: Some(resolved.source),
                    error: None,
                },
                Err(error) => FeishuCliHealth {
                    installed: false,
                    path: Some(resolved.path.display().to_string()),
                    version: None,
                    source: Some(resolved.source),
                    error: Some(error.to_string()),
                },
            },
            Err(error) => FeishuCliHealth {
                installed: false,
                path: None,
                version: None,
                source: None,
                error: Some(error.to_string()),
            },
        }
    }

    pub fn auth_status(&self, cli_path: Option<String>) -> AppResult<FeishuCliResponse> {
        let request = FeishuCliRequest {
            operation: "auth_status".to_string(),
            args: Value::Object(serde_json::Map::new()),
        };
        self.read_operation(cli_path, request)
    }

    pub fn read_operation(
        &self,
        cli_path: Option<String>,
        request: FeishuCliRequest,
    ) -> AppResult<FeishuCliResponse> {
        let operation = parse_read_operation(&request.operation)?;
        let command_args = build_operation_args(operation, &request.args, false)?;
        let resolved = resolve_cli_path(cli_path.as_deref())?;
        let output = run_command(&resolved.path, &command_args)?;
        Ok(response_from_output(
            request.operation,
            command_for_display(&resolved.path, &command_args),
            output,
        ))
    }

    pub fn write_preview(
        &self,
        cli_path: Option<String>,
        request: FeishuCliRequest,
    ) -> AppResult<FeishuWritePreview> {
        let operation = parse_write_operation(&request.operation)?;
        let command_args = build_operation_args(operation, &request.args, false)?;
        let dry_run_args = build_operation_args(operation, &request.args, true)?;
        let resolved = resolve_cli_path(cli_path.as_deref())?;
        let dry_run_output = run_command(&resolved.path, &dry_run_args)?;
        let operation_id = generate_operation_id();
        let now = Utc::now();
        let expires_at = now + Duration::minutes(PREVIEW_TTL_MINUTES);
        let dry_run_response = response_from_output(
            request.operation.clone(),
            command_for_display(&resolved.path, &dry_run_args),
            dry_run_output,
        );
        let command = command_for_display(&resolved.path, &command_args);
        let dry_run_command = command_for_display(&resolved.path, &dry_run_args);
        let preview = FeishuWritePreview {
            operation_id: operation_id.clone(),
            operation: request.operation.clone(),
            summary: summarize_write_operation(operation, &request.args),
            command: command.clone(),
            dry_run_command: dry_run_command.clone(),
            dry_run_result: dry_run_response.clone(),
            expires_at: expires_at.timestamp_millis(),
        };

        let connection = self.database.open_connection()?;
        connection.execute(
            r#"
            insert into feishu_cli_operation_logs (
              id, operation, args_json, dry_run_json, command_json, status,
              stdout, stderr, created_at, executed_at
            ) values (?1, ?2, ?3, ?4, ?5, 'previewed', null, null, ?6, null)
            "#,
            params![
                operation_id,
                request.operation,
                request.args.to_string(),
                serde_json::to_string(&preview)?,
                serde_json::to_string(&command)?,
                now.to_rfc3339(),
            ],
        )?;

        Ok(preview)
    }

    pub fn write_confirm(
        &self,
        cli_path: Option<String>,
        operation_id: String,
    ) -> AppResult<FeishuCliResponse> {
        let connection = self.database.open_connection()?;
        let log = connection.query_row(
            r#"
            select id, operation, args_json, dry_run_json, command_json, status,
                   stdout, stderr, created_at, executed_at
            from feishu_cli_operation_logs
            where id = ?1
            "#,
            params![operation_id],
            map_operation_log,
        )?;

        if log.status != "previewed" {
            return Err(AppError::message("飞书写操作已执行或不可确认"));
        }

        let preview_json = log
            .dry_run_json
            .as_deref()
            .ok_or_else(|| AppError::message("飞书写操作缺少 dry-run 预览"))?;
        let preview: FeishuWritePreview = serde_json::from_str(preview_json)?;
        if Utc::now().timestamp_millis() > preview.expires_at {
            return Err(AppError::message("飞书写操作预览已过期，请重新生成预览"));
        }

        let operation = parse_write_operation(&log.operation)?;
        let args: Value = serde_json::from_str(&log.args_json)?;
        let command_args = build_operation_args(operation, &args, false)?;
        let resolved = resolve_cli_path(cli_path.as_deref())?;
        let output = run_command(&resolved.path, &command_args);
        let executed_at = Utc::now().to_rfc3339();

        match output {
            Ok(output) => {
                let response = response_from_output(
                    log.operation.clone(),
                    command_for_display(&resolved.path, &command_args),
                    output,
                );
                connection.execute(
                    r#"
                    update feishu_cli_operation_logs
                    set status = 'executed',
                        stdout = ?2,
                        stderr = ?3,
                        executed_at = ?4
                    where id = ?1
                    "#,
                    params![log.id, response.stdout, response.stderr, executed_at],
                )?;
                Ok(response)
            }
            Err(error) => {
                connection.execute(
                    r#"
                    update feishu_cli_operation_logs
                    set status = 'failed',
                        stderr = ?2,
                        executed_at = ?3
                    where id = ?1
                    "#,
                    params![log.id, error.to_string(), executed_at],
                )?;
                Err(error)
            }
        }
    }
}

#[derive(Clone, Copy, Debug)]
enum Operation {
    AuthStatus,
    CalendarAgenda,
    CalendarFreebusy,
    ContactSearch,
    TaskList,
    DocSearch,
    MinutesSearch,
    TaskCreate,
    CalendarEventCreate,
    DocCreateMarkdown,
}

struct ResolvedCliPath {
    path: PathBuf,
    source: String,
}

struct ProcessOutput {
    stdout: String,
    stderr: String,
}

fn parse_read_operation(operation: &str) -> AppResult<Operation> {
    match operation {
        "auth_status" => Ok(Operation::AuthStatus),
        "calendar_agenda" => Ok(Operation::CalendarAgenda),
        "calendar_freebusy" => Ok(Operation::CalendarFreebusy),
        "contact_search" => Ok(Operation::ContactSearch),
        "task_list" => Ok(Operation::TaskList),
        "doc_search" => Ok(Operation::DocSearch),
        "minutes_search" => Ok(Operation::MinutesSearch),
        _ => Err(AppError::message(format!(
            "Unsupported Feishu read operation: {operation}"
        ))),
    }
}

fn parse_write_operation(operation: &str) -> AppResult<Operation> {
    match operation {
        "task_create" => Ok(Operation::TaskCreate),
        "calendar_event_create" => Ok(Operation::CalendarEventCreate),
        "doc_create_markdown" => Ok(Operation::DocCreateMarkdown),
        _ => Err(AppError::message(format!(
            "Unsupported Feishu write operation: {operation}"
        ))),
    }
}

fn build_operation_args(
    operation: Operation,
    args: &Value,
    dry_run: bool,
) -> AppResult<Vec<String>> {
    let mut command_args = match operation {
        Operation::AuthStatus => vec!["auth", "status"],
        Operation::CalendarAgenda => vec!["calendar", "agenda"],
        Operation::CalendarFreebusy => vec!["calendar", "freebusy"],
        Operation::ContactSearch => vec!["contact", "search"],
        Operation::TaskList => vec!["task", "list"],
        Operation::DocSearch => vec!["drive", "search"],
        Operation::MinutesSearch => vec!["minutes", "search"],
        Operation::TaskCreate => vec!["task", "create"],
        Operation::CalendarEventCreate => vec!["calendar", "event", "create"],
        Operation::DocCreateMarkdown => vec!["docs", "create"],
    }
    .into_iter()
    .map(str::to_string)
    .collect::<Vec<_>>();

    append_common_args(&mut command_args, operation, args)?;
    if dry_run {
        command_args.push("--dry-run".to_string());
    }
    command_args.push("--format".to_string());
    command_args.push("json".to_string());
    Ok(command_args)
}

fn append_common_args(
    command_args: &mut Vec<String>,
    operation: Operation,
    args: &Value,
) -> AppResult<()> {
    match operation {
        Operation::AuthStatus => {}
        Operation::CalendarAgenda => {
            push_optional_string(command_args, "--start", args, "start")?;
            push_optional_string(command_args, "--end", args, "end")?;
        }
        Operation::CalendarFreebusy => {
            push_required_string(command_args, "--start", args, "start")?;
            push_required_string(command_args, "--end", args, "end")?;
            push_optional_array(command_args, "--user", args, "user_ids")?;
        }
        Operation::ContactSearch => {
            push_required_string(command_args, "--query", args, "query")?;
            push_optional_number(command_args, "--limit", args, "limit")?;
        }
        Operation::TaskList => {
            push_optional_string(command_args, "--status", args, "status")?;
            push_optional_string(command_args, "--due", args, "due")?;
        }
        Operation::DocSearch | Operation::MinutesSearch => {
            push_required_string(command_args, "--query", args, "query")?;
            push_optional_number(command_args, "--limit", args, "limit")?;
        }
        Operation::TaskCreate => {
            push_required_string(command_args, "--title", args, "title")?;
            push_optional_string(command_args, "--description", args, "description")?;
            push_optional_string(command_args, "--due", args, "due")?;
            push_optional_string(command_args, "--reminder", args, "reminder")?;
            push_optional_array(command_args, "--assignee", args, "assignee_ids")?;
        }
        Operation::CalendarEventCreate => {
            push_required_string(command_args, "--title", args, "title")?;
            push_required_string(command_args, "--start", args, "start")?;
            push_required_string(command_args, "--end", args, "end")?;
            push_optional_string(command_args, "--description", args, "description")?;
            push_optional_string(command_args, "--location", args, "location")?;
            push_optional_array(command_args, "--attendee", args, "attendee_ids")?;
        }
        Operation::DocCreateMarkdown => {
            push_required_string(command_args, "--title", args, "title")?;
            push_required_string(command_args, "--content", args, "markdown")?;
            command_args.push("--type".to_string());
            command_args.push("markdown".to_string());
        }
    }
    Ok(())
}

fn push_required_string(
    command_args: &mut Vec<String>,
    flag: &str,
    args: &Value,
    key: &str,
) -> AppResult<()> {
    let value = args
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::message(format!("Feishu CLI argument is required: {key}")))?;
    command_args.push(flag.to_string());
    command_args.push(value.to_string());
    Ok(())
}

fn push_optional_string(
    command_args: &mut Vec<String>,
    flag: &str,
    args: &Value,
    key: &str,
) -> AppResult<()> {
    if let Some(value) = args
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        command_args.push(flag.to_string());
        command_args.push(value.to_string());
    }
    Ok(())
}

fn push_optional_number(
    command_args: &mut Vec<String>,
    flag: &str,
    args: &Value,
    key: &str,
) -> AppResult<()> {
    if let Some(value) = args.get(key).and_then(Value::as_i64) {
        command_args.push(flag.to_string());
        command_args.push(value.to_string());
    }
    Ok(())
}

fn push_optional_array(
    command_args: &mut Vec<String>,
    flag: &str,
    args: &Value,
    key: &str,
) -> AppResult<()> {
    if let Some(values) = args.get(key).and_then(Value::as_array) {
        for value in values {
            let Some(text) = value
                .as_str()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            else {
                return Err(AppError::message(format!(
                    "Feishu CLI array argument must contain strings: {key}"
                )));
            };
            command_args.push(flag.to_string());
            command_args.push(text.to_string());
        }
    }
    Ok(())
}

fn resolve_cli_path(configured_path: Option<&str>) -> AppResult<ResolvedCliPath> {
    if let Some(path) = configured_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let path = PathBuf::from(path);
        if let Some(path) =
            resolve_windows_npm_shim(&path).or_else(|| path.exists().then_some(path))
        {
            return Ok(ResolvedCliPath {
                path,
                source: "configured".to_string(),
            });
        }
        return Err(AppError::message(format!(
            "Configured lark-cli path does not exist: {}",
            path.display()
        )));
    }

    for candidate in cli_path_candidates() {
        if let Some(path) = find_in_path(candidate) {
            return Ok(ResolvedCliPath {
                path,
                source: "path".to_string(),
            });
        }
    }

    Err(AppError::message(
        "未找到 lark-cli。请先安装飞书 CLI 并完成登录授权。",
    ))
}

#[cfg(windows)]
fn cli_path_candidates() -> &'static [&'static str] {
    &["lark-cli.cmd", "lark-cli.exe", "lark-cli.ps1", "lark-cli"]
}

#[cfg(not(windows))]
fn cli_path_candidates() -> &'static [&'static str] {
    &["lark-cli"]
}

#[cfg(windows)]
fn resolve_windows_npm_shim(path: &Path) -> Option<PathBuf> {
    let extension = path.extension().and_then(|value| value.to_str());
    if extension.is_some() && path.exists() {
        return Some(path.to_path_buf());
    }

    for extension in ["cmd", "exe", "ps1"] {
        let candidate = path.with_extension(extension);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

#[cfg(not(windows))]
fn resolve_windows_npm_shim(_path: &Path) -> Option<PathBuf> {
    None
}

fn find_in_path(binary: &str) -> Option<PathBuf> {
    if Path::new(binary).is_absolute() && Path::new(binary).exists() {
        return Some(PathBuf::from(binary));
    }

    let paths = env::var_os("PATH")?;
    for dir in env::split_paths(&paths) {
        let candidate = dir.join(binary);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn run_command(path: &Path, args: &[String]) -> AppResult<ProcessOutput> {
    let output = Command::new(path).args(args).output().map_err(|error| {
        AppError::message(format!(
            "Failed to run lark-cli {}: {error}",
            path.display()
        ))
    })?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        return Err(AppError::message(format!(
            "lark-cli failed with status {}: {}{}{}",
            output.status,
            stdout,
            if stdout.is_empty() || stderr.is_empty() {
                ""
            } else {
                "\n"
            },
            stderr
        )));
    }

    Ok(ProcessOutput { stdout, stderr })
}

fn response_from_output(
    operation: String,
    command: Vec<String>,
    output: ProcessOutput,
) -> FeishuCliResponse {
    let parsed_json = serde_json::from_str(&output.stdout).ok();
    FeishuCliResponse {
        operation,
        command,
        stdout: output.stdout,
        stderr: output.stderr,
        parsed_json,
    }
}

fn command_for_display(path: &Path, args: &[String]) -> Vec<String> {
    let mut command = vec![path.display().to_string()];
    command.extend(args.iter().cloned());
    command
}

fn summarize_write_operation(operation: Operation, args: &Value) -> String {
    let title = args
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("未命名")
        .trim();
    match operation {
        Operation::TaskCreate => format!("创建飞书任务：{title}"),
        Operation::CalendarEventCreate => format!("创建飞书日程：{title}"),
        Operation::DocCreateMarkdown => format!("创建飞书文档：{title}"),
        _ => "飞书写操作".to_string(),
    }
}

fn first_non_empty_line(stdout: &str, stderr: &str) -> String {
    stdout
        .lines()
        .chain(stderr.lines())
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("unknown")
        .to_string()
}

fn generate_operation_id() -> String {
    let timestamp = Utc::now()
        .timestamp_nanos_opt()
        .unwrap_or_else(|| Utc::now().timestamp_micros() * 1_000);
    format!("feishu-op-{timestamp}")
}

fn map_operation_log(row: &rusqlite::Row<'_>) -> rusqlite::Result<FeishuCliOperationLog> {
    Ok(FeishuCliOperationLog {
        id: row.get(0)?,
        operation: row.get(1)?,
        args_json: row.get(2)?,
        dry_run_json: row.get(3)?,
        command_json: row.get(4)?,
        status: row.get(5)?,
        stdout: row.get(6)?,
        stderr: row.get(7)?,
        created_at: row.get(8)?,
        executed_at: row.get(9)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn rejects_unknown_read_operation() {
        let error = parse_read_operation("im_send").expect_err("unknown operation rejected");
        assert!(error
            .to_string()
            .contains("Unsupported Feishu read operation"));
    }

    #[test]
    fn shell_characters_remain_plain_arguments() {
        let args = serde_json::json!({
            "query": "张三; rm -rf /",
            "limit": 5
        });
        let command_args =
            build_operation_args(Operation::ContactSearch, &args, false).expect("build args");
        assert!(command_args.contains(&"张三; rm -rf /".to_string()));
        assert!(!command_args.contains(&"rm".to_string()));
    }

    #[test]
    fn dry_run_flag_added_for_write_preview() {
        let args = serde_json::json!({
            "title": "跟进回款",
            "description": "明早处理"
        });
        let command_args =
            build_operation_args(Operation::TaskCreate, &args, true).expect("build args");
        let flags: HashSet<_> = command_args.iter().map(String::as_str).collect();
        assert!(flags.contains("--dry-run"));
        assert!(flags.contains("--format"));
    }

    #[cfg(windows)]
    #[test]
    fn windows_cli_candidates_prefer_shell_shims() {
        assert_eq!(cli_path_candidates()[0], "lark-cli.cmd");
        assert!(cli_path_candidates().contains(&"lark-cli"));
    }

    #[cfg(windows)]
    #[test]
    fn configured_windows_npm_shim_resolves_to_cmd_file() {
        let unique = Utc::now()
            .timestamp_nanos_opt()
            .unwrap_or_else(|| Utc::now().timestamp_micros() * 1_000);
        let dir = env::temp_dir().join(format!("canmou-lark-cli-test-{unique}"));
        std::fs::create_dir_all(&dir).expect("create temp dir");

        let shim = dir.join("lark-cli");
        let cmd_shim = dir.join("lark-cli.cmd");
        std::fs::write(&cmd_shim, "@echo off\r\n").expect("write cmd shim");

        let resolved = resolve_windows_npm_shim(&shim).expect("resolve cmd shim");
        assert_eq!(resolved, cmd_shim);

        std::fs::remove_dir_all(&dir).expect("remove temp dir");
    }
}
