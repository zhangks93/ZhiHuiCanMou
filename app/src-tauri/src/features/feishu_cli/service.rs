use crate::features::feishu_cli::{
    schema, FeishuAuthBeginRequest, FeishuAuthCompleteRequest, FeishuCliHealth,
    FeishuCliOperationLog, FeishuCliRequest, FeishuCliResponse, FeishuConfigInitRequest,
    FeishuWritePreview,
};
use crate::infra::error::{AppError, AppResult};
use crate::infra::sqlite::AppDatabase;
use chrono::{Duration, Utc};
use rusqlite::params;
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::Manager;

const PREVIEW_TTL_MINUTES: i64 = 15;
const DEFAULT_AUTH_DOMAINS: &[&str] = &["calendar", "contact", "docs", "drive", "minutes", "task"];

#[derive(Clone)]
pub struct FeishuCliService {
    database: AppDatabase,
    cli_path: PathBuf,
    cli_home: PathBuf,
}

impl FeishuCliService {
    pub fn new(database: AppDatabase, cli_path: PathBuf, cli_home: PathBuf) -> Self {
        Self {
            database,
            cli_path,
            cli_home,
        }
    }

    pub fn ensure_schema_for_database(database: &AppDatabase) -> AppResult<()> {
        let connection = database.open_connection()?;
        schema::ensure(&connection)
    }

    pub fn ensure_schema(&self) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        schema::ensure(&connection)
    }

    pub fn health(&self) -> FeishuCliHealth {
        if !self.cli_path.exists() {
            return FeishuCliHealth {
                installed: false,
                bundled: false,
                configured: false,
                authenticated: false,
                path: Some(self.cli_path.display().to_string()),
                version: None,
                source: Some("bundled".to_string()),
                error: Some(format!(
                    "未找到随应用打包的 lark-cli：{}",
                    self.cli_path.display()
                )),
            };
        }

        let version = match self.run_command(&["--version".to_string()]) {
            Ok(output) => Some(first_non_empty_line(&output.stdout, &output.stderr)),
            Err(error) => {
                return FeishuCliHealth {
                    installed: false,
                    bundled: true,
                    configured: false,
                    authenticated: false,
                    path: Some(self.cli_path.display().to_string()),
                    version: None,
                    source: Some("bundled".to_string()),
                    error: Some(error.to_string()),
                }
            }
        };

        let configured = self.run_command(&["config".to_string(), "show".to_string()]).is_ok();
        let authenticated = self
            .run_command(&["auth".to_string(), "status".to_string()])
            .is_ok();

        FeishuCliHealth {
            installed: true,
            bundled: true,
            configured,
            authenticated,
            path: Some(self.cli_path.display().to_string()),
            version,
            source: Some("bundled".to_string()),
            error: None,
        }
    }

    pub fn config_init(&self, request: FeishuConfigInitRequest) -> AppResult<FeishuCliResponse> {
        let app_id = required_text(&request.app_id, "appId")?;
        let app_secret = required_text(&request.app_secret, "appSecret")?;
        let brand = match request.brand.trim() {
            "" | "feishu" => "feishu",
            "lark" => "lark",
            value => {
                return Err(AppError::message(format!(
                    "Unsupported Feishu brand: {value}"
                )))
            }
        };
        let args = vec![
            "config".to_string(),
            "init".to_string(),
            "--app-id".to_string(),
            app_id,
            "--app-secret-stdin".to_string(),
            "--brand".to_string(),
            brand.to_string(),
        ];
        let output = self.run_command_with_stdin(&args, Some(format!("{app_secret}\n")))?;
        Ok(response_from_output(
            "config_init".to_string(),
            self.command_for_display(&args),
            output,
        ))
    }

    pub fn auth_begin(&self, request: FeishuAuthBeginRequest) -> AppResult<FeishuCliResponse> {
        let mut args = vec![
            "auth".to_string(),
            "login".to_string(),
            "--json".to_string(),
            "--no-wait".to_string(),
        ];

        let domains = if request.domains.is_empty() {
            DEFAULT_AUTH_DOMAINS
                .iter()
                .map(|value| value.to_string())
                .collect::<Vec<_>>()
        } else {
            request
                .domains
                .iter()
                .map(|value| required_text(value, "domain"))
                .collect::<AppResult<Vec<_>>>()?
        };

        if !domains.is_empty() {
            args.push("--domain".to_string());
            args.push(domains.join(","));
        }

        if !request.scopes.is_empty() {
            args.push("--scope".to_string());
            args.push(
                request
                    .scopes
                    .iter()
                    .map(|value| required_text(value, "scope"))
                    .collect::<AppResult<Vec<_>>>()?
                    .join(","),
            );
        }

        let output = self.run_command(&args)?;
        Ok(response_from_output(
            "auth_begin".to_string(),
            self.command_for_display(&args),
            output,
        ))
    }

    pub fn auth_complete(
        &self,
        request: FeishuAuthCompleteRequest,
    ) -> AppResult<FeishuCliResponse> {
        let device_code = required_text(&request.device_code, "deviceCode")?;
        let args = vec![
            "auth".to_string(),
            "login".to_string(),
            "--json".to_string(),
            "--device-code".to_string(),
            device_code,
        ];
        let output = self.run_command(&args)?;
        Ok(response_from_output(
            "auth_complete".to_string(),
            self.command_for_display(&args),
            output,
        ))
    }

    pub fn config_remove(&self) -> AppResult<FeishuCliResponse> {
        let args = vec!["config".to_string(), "remove".to_string()];
        let output = self.run_command(&args)?;
        Ok(response_from_output(
            "config_remove".to_string(),
            self.command_for_display(&args),
            output,
        ))
    }

    pub fn auth_status(&self) -> AppResult<FeishuCliResponse> {
        let request = FeishuCliRequest {
            operation: "auth_status".to_string(),
            args: Value::Object(serde_json::Map::new()),
        };
        self.read_operation(request)
    }

    pub fn read_operation(
        &self,
        request: FeishuCliRequest,
    ) -> AppResult<FeishuCliResponse> {
        let operation = parse_read_operation(&request.operation)?;
        let command_args = build_operation_args(operation, &request.args, false)?;
        let output = self.run_command(&command_args)?;
        Ok(response_from_output(
            request.operation,
            self.command_for_display(&command_args),
            output,
        ))
    }

    pub fn write_preview(
        &self,
        request: FeishuCliRequest,
    ) -> AppResult<FeishuWritePreview> {
        let operation = parse_write_operation(&request.operation)?;
        let command_args = build_operation_args(operation, &request.args, false)?;
        let dry_run_args = build_operation_args(operation, &request.args, true)?;
        let dry_run_output = self.run_command(&dry_run_args)?;
        let operation_id = generate_operation_id();
        let now = Utc::now();
        let expires_at = now + Duration::minutes(PREVIEW_TTL_MINUTES);
        let dry_run_response = response_from_output(
            request.operation.clone(),
            self.command_for_display(&dry_run_args),
            dry_run_output,
        );
        let command = self.command_for_display(&command_args);
        let dry_run_command = self.command_for_display(&dry_run_args);
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
        let output = self.run_command(&command_args);
        let executed_at = Utc::now().to_rfc3339();

        match output {
            Ok(output) => {
                let response = response_from_output(
                    log.operation.clone(),
                    self.command_for_display(&command_args),
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

    fn run_command(&self, args: &[String]) -> AppResult<ProcessOutput> {
        self.run_command_with_stdin(args, None)
    }

    fn run_command_with_stdin(
        &self,
        args: &[String],
        stdin_text: Option<String>,
    ) -> AppResult<ProcessOutput> {
        fs::create_dir_all(&self.cli_home).map_err(|error| {
            AppError::message(format!(
                "Failed to create lark-cli app data dir {}: {error}",
                self.cli_home.display()
            ))
        })?;

        let mut command = Command::new(&self.cli_path);
        command
            .args(args)
            .env("LARK_CLI_HOME", &self.cli_home)
            .env("LARK_CLI_CONFIG_HOME", &self.cli_home)
            .env("XDG_CONFIG_HOME", &self.cli_home)
            .env("NO_COLOR", "1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if stdin_text.is_some() {
            command.stdin(Stdio::piped());
        }

        let mut child = command.spawn().map_err(|error| {
            AppError::message(format!(
                "Failed to run bundled lark-cli {}: {error}",
                self.cli_path.display()
            ))
        })?;

        if let Some(stdin_text) = stdin_text {
            let mut stdin = child
                .stdin
                .take()
                .ok_or_else(|| AppError::message("Failed to open lark-cli stdin"))?;
            stdin.write_all(stdin_text.as_bytes())?;
        }

        let output = child.wait_with_output()?;
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

    fn command_for_display(&self, args: &[String]) -> Vec<String> {
        let mut command = vec![self.cli_path.display().to_string()];
        command.extend(args.iter().cloned());
        command
    }
}

pub fn resolve_bundled_cli_paths(app: &tauri::AppHandle) -> AppResult<(PathBuf, PathBuf)> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::message(format!("Failed to resolve app data dir: {error}")))?;
    let cli_home = app_data_dir.join("lark-cli");

    #[cfg(windows)]
    let cli_path = app
        .path()
        .resolve(
            "resources/lark-cli/windows/lark-cli.exe",
            tauri::path::BaseDirectory::Resource,
        )
        .or_else(|_| {
            app.path().resolve(
                "lark-cli/windows/lark-cli.exe",
                tauri::path::BaseDirectory::Resource,
            )
        })
        .unwrap_or_else(|_| app_data_dir.join("resources/lark-cli/windows/lark-cli.exe"));

    #[cfg(not(windows))]
    let cli_path = app_data_dir.join("unsupported-lark-cli");

    Ok((cli_path, cli_home))
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
        Operation::CalendarAgenda => vec!["calendar", "+agenda"],
        Operation::CalendarFreebusy => vec!["calendar", "+freebusy"],
        Operation::ContactSearch => vec!["contact", "+search-user"],
        Operation::TaskList => vec!["task", "+get-my-tasks"],
        Operation::DocSearch => vec!["drive", "+search"],
        Operation::MinutesSearch => vec!["minutes", "+search"],
        Operation::TaskCreate => vec!["task", "+create"],
        Operation::CalendarEventCreate => vec!["calendar", "+create"],
        Operation::DocCreateMarkdown => vec!["docs", "+create"],
    }
    .into_iter()
    .map(str::to_string)
    .collect::<Vec<_>>();

    append_common_args(&mut command_args, operation, args)?;
    if dry_run {
        command_args.push("--dry-run".to_string());
    }
    if operation_supports_json_format(operation) {
        command_args.push("--format".to_string());
        command_args.push("json".to_string());
    }
    Ok(command_args)
}

fn operation_supports_json_format(operation: Operation) -> bool {
    !matches!(
        operation,
        Operation::AuthStatus | Operation::DocCreateMarkdown
    )
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
            push_optional_string_or_first_array_item(
                command_args,
                "--user-id",
                args,
                "user_id",
                "user_ids",
            )?;
        }
        Operation::ContactSearch => {
            push_required_string(command_args, "--query", args, "query")?;
            push_optional_number_alias(command_args, "--page-size", args, "page_size", "limit")?;
            push_optional_csv_array(command_args, "--user-ids", args, "user_ids")?;
        }
        Operation::TaskList => {
            push_optional_task_status(command_args, args)?;
            push_optional_string(command_args, "--query", args, "query")?;
            push_optional_string(command_args, "--due-start", args, "due_start")?;
            push_optional_string(command_args, "--due-end", args, "due_end")?;
            push_optional_string(command_args, "--due-start", args, "due")?;
            push_optional_number_alias(command_args, "--page-limit", args, "page_limit", "limit")?;
        }
        Operation::DocSearch | Operation::MinutesSearch => {
            push_required_string(command_args, "--query", args, "query")?;
            push_optional_number_alias(command_args, "--page-size", args, "page_size", "limit")?;
        }
        Operation::TaskCreate => {
            push_required_string(command_args, "--summary", args, "title")?;
            push_optional_string(command_args, "--description", args, "description")?;
            push_optional_string(command_args, "--due", args, "due")?;
            push_optional_array(command_args, "--assignee", args, "assignee_ids")?;
            push_optional_array(command_args, "--follower", args, "follower_ids")?;
        }
        Operation::CalendarEventCreate => {
            push_required_string(command_args, "--summary", args, "title")?;
            push_required_string(command_args, "--start", args, "start")?;
            push_required_string(command_args, "--end", args, "end")?;
            push_optional_string(command_args, "--description", args, "description")?;
            push_optional_csv_array(command_args, "--attendee-ids", args, "attendee_ids")?;
        }
        Operation::DocCreateMarkdown => {
            push_required_markdown_content(command_args, args)?;
            push_optional_string(command_args, "--parent-token", args, "folder_token")?;
            push_optional_string(command_args, "--parent-token", args, "parent_token")?;
            command_args.push("--api-version".to_string());
            command_args.push("v2".to_string());
            command_args.push("--doc-format".to_string());
            command_args.push("markdown".to_string());
        }
    }
    Ok(())
}

fn push_required_markdown_content(command_args: &mut Vec<String>, args: &Value) -> AppResult<()> {
    let title = args
        .get("title")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::message("Feishu CLI argument is required: title"))?;
    let markdown = args
        .get("markdown")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::message("Feishu CLI argument is required: markdown"))?;

    command_args.push("--content".to_string());
    if markdown
        .lines()
        .next()
        .map(str::trim)
        .is_some_and(|line| line == format!("# {title}"))
    {
        command_args.push(markdown.to_string());
    } else {
        command_args.push(format!("# {title}\n\n{markdown}"));
    }
    Ok(())
}

fn required_text(value: &str, label: &str) -> AppResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::message(format!(
            "Feishu CLI argument is required: {label}"
        )));
    }
    Ok(trimmed.to_string())
}

fn push_optional_task_status(command_args: &mut Vec<String>, args: &Value) -> AppResult<()> {
    let Some(status) = args
        .get("status")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(());
    };

    match status {
        "complete" | "completed" | "done" => command_args.push("--complete".to_string()),
        "incomplete" | "open" | "todo" | "pending" => {
            command_args.push("--complete=false".to_string())
        }
        _ => {
            return Err(AppError::message(format!(
                "Unsupported Feishu task status: {status}"
            )))
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

fn push_optional_number_alias(
    command_args: &mut Vec<String>,
    flag: &str,
    args: &Value,
    preferred_key: &str,
    fallback_key: &str,
) -> AppResult<()> {
    if args.get(preferred_key).and_then(Value::as_i64).is_some() {
        push_optional_number(command_args, flag, args, preferred_key)?;
    } else {
        push_optional_number(command_args, flag, args, fallback_key)?;
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

fn push_optional_csv_array(
    command_args: &mut Vec<String>,
    flag: &str,
    args: &Value,
    key: &str,
) -> AppResult<()> {
    if let Some(values) = args.get(key).and_then(Value::as_array) {
        let mut texts = Vec::with_capacity(values.len());
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
            texts.push(text.to_string());
        }
        if !texts.is_empty() {
            command_args.push(flag.to_string());
            command_args.push(texts.join(","));
        }
    }
    Ok(())
}

fn push_optional_string_or_first_array_item(
    command_args: &mut Vec<String>,
    flag: &str,
    args: &Value,
    string_key: &str,
    array_key: &str,
) -> AppResult<()> {
    if args
        .get(string_key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some()
    {
        return push_optional_string(command_args, flag, args, string_key);
    }

    if let Some(values) = args.get(array_key).and_then(Value::as_array) {
        if values.len() > 1 {
            return Err(AppError::message(format!(
                "Feishu CLI argument supports only one value: {array_key}"
            )));
        }
        if let Some(value) = values.first() {
            let Some(text) = value
                .as_str()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            else {
                return Err(AppError::message(format!(
                    "Feishu CLI array argument must contain strings: {array_key}"
                )));
            };
            command_args.push(flag.to_string());
            command_args.push(text.to_string());
        }
    }
    Ok(())
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
    fn read_operations_use_current_lark_cli_shortcuts() {
        let agenda_args = serde_json::json!({
            "start": "2026-05-18T00:00:00+08:00",
            "end": "2026-05-19T00:00:00+08:00"
        });
        let agenda =
            build_operation_args(Operation::CalendarAgenda, &agenda_args, false).expect("agenda");
        assert_eq!(
            agenda,
            vec![
                "calendar",
                "+agenda",
                "--start",
                "2026-05-18T00:00:00+08:00",
                "--end",
                "2026-05-19T00:00:00+08:00",
                "--format",
                "json"
            ]
        );

        let contact_args = serde_json::json!({
            "query": "张三",
            "limit": 5
        });
        let contact =
            build_operation_args(Operation::ContactSearch, &contact_args, false).expect("contact");
        assert_eq!(
            contact,
            vec![
                "contact",
                "+search-user",
                "--query",
                "张三",
                "--page-size",
                "5",
                "--format",
                "json"
            ]
        );
    }

    #[test]
    fn write_operations_use_current_lark_cli_flags() {
        let task_args = serde_json::json!({
            "title": "跟进回款",
            "description": "明早处理",
            "assignee_ids": ["ou_1", "ou_2"]
        });
        let task = build_operation_args(Operation::TaskCreate, &task_args, true).expect("task");
        assert_eq!(
            task,
            vec![
                "task",
                "+create",
                "--summary",
                "跟进回款",
                "--description",
                "明早处理",
                "--assignee",
                "ou_1",
                "--assignee",
                "ou_2",
                "--dry-run",
                "--format",
                "json"
            ]
        );

        let event_args = serde_json::json!({
            "title": "项目会",
            "start": "2026-05-18T10:00:00+08:00",
            "end": "2026-05-18T11:00:00+08:00",
            "attendee_ids": ["ou_1", "ou_2"]
        });
        let event =
            build_operation_args(Operation::CalendarEventCreate, &event_args, true).expect("event");
        assert_eq!(
            event,
            vec![
                "calendar",
                "+create",
                "--summary",
                "项目会",
                "--start",
                "2026-05-18T10:00:00+08:00",
                "--end",
                "2026-05-18T11:00:00+08:00",
                "--attendee-ids",
                "ou_1,ou_2",
                "--dry-run",
                "--format",
                "json"
            ]
        );
    }

    #[test]
    fn docs_create_uses_v2_markdown_without_format_flag() {
        let args = serde_json::json!({
            "title": "会议纪要",
            "markdown": "# 会议纪要"
        });
        let command_args =
            build_operation_args(Operation::DocCreateMarkdown, &args, true).expect("docs");
        assert_eq!(
            command_args,
            vec![
                "docs",
                "+create",
                "--content",
                "# 会议纪要",
                "--api-version",
                "v2",
                "--doc-format",
                "markdown",
                "--dry-run"
            ]
        );
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

    #[test]
    fn auth_status_uses_supported_flags_only() {
        let command_args = build_operation_args(
            Operation::AuthStatus,
            &Value::Object(serde_json::Map::new()),
            false,
        )
        .expect("build args");
        assert_eq!(command_args, vec!["auth", "status"]);
    }

    #[test]
    fn required_text_trims_and_rejects_empty_values() {
        assert_eq!(required_text(" cli_a123 ", "appId").unwrap(), "cli_a123");
        assert!(required_text(" ", "appId").is_err());
    }

    #[test]
    fn config_init_command_shape_does_not_include_secret() {
        let args = [
            "config".to_string(),
            "init".to_string(),
            "--app-id".to_string(),
            "cli_a123".to_string(),
            "--app-secret-stdin".to_string(),
            "--brand".to_string(),
            "feishu".to_string(),
        ];
        assert!(args.contains(&"--app-secret-stdin".to_string()));
        assert!(!args.contains(&"secret-value".to_string()));
    }
}
