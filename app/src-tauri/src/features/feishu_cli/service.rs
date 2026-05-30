use crate::features::feishu_cli::cli_runtime::{
    apply_platform_process_options, check_update, resolve_active_cli, update_status_key,
    version_is_usable, CliRuntimePaths, FeishuCliUpdateCheck, FeishuCliUpdateResult,
    REQUIRED_LARK_CLI_VERSION,
};
use crate::features::feishu_cli::cli_update::update_cli;
use crate::features::feishu_cli::{
    schema, FeishuAuthBeginRequest, FeishuAuthCompleteRequest, FeishuAuthDomainOption,
    FeishuAuthEffectiveState, FeishuAuthPreferences, FeishuAuthPreferencesSaveRequest,
    FeishuAuthPreset, FeishuAuthPresetCatalog, FeishuAuthScopeCatalog, FeishuAuthSyncRequest,
    FeishuAuthSyncResult, FeishuCliHealth, FeishuCliOperationLog, FeishuCliRequest,
    FeishuCliResponse, FeishuConfigInitRequest, FeishuWritePreview,
};
use crate::features::settings::SettingsRepository;
use crate::infra::error::{AppError, AppResult};
use crate::infra::sqlite::AppDatabase;
use chrono::{Duration, Utc};
use rusqlite::{params, Connection};
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const PREVIEW_TTL_MINUTES: i64 = 15;
const FEISHU_SETTINGS_PATH: &str = "/settings?tab=feishu-cli";
const KEY_FEISHU_SELECTED_DOMAINS: &str = "feishu_cli.auth.selected_domains";
const KEY_FEISHU_LAST_SYNCED_DOMAINS: &str = "feishu_cli.auth.last_synced_domains";
const KEY_FEISHU_PENDING_SYNC_DOMAINS: &str = "feishu_cli.auth.pending_sync_domains";
const KEY_FEISHU_PENDING_DEVICE_CODE: &str = "feishu_cli.auth.pending_device_code";
const KEY_FEISHU_PENDING_VERIFICATION_URL: &str = "feishu_cli.auth.pending_verification_url";
const KEY_FEISHU_LAST_UPDATE_ERROR: &str = "feishu_cli.update.last_error";
const DEFAULT_AUTH_DOMAINS: &[&str] = &["calendar", "contact", "docs", "drive", "minutes", "task"];
const AUTH_DOMAINS: &[AuthDomain] = &[
    AuthDomain::new(
        "approval",
        "审批",
        "审批实例与审批任务。",
        &["approval:"],
        false,
    ),
    AuthDomain::new(
        "attendance",
        "考勤",
        "考勤打卡与出勤记录。",
        &["attendance:"],
        false,
    ),
    AuthDomain::new(
        "base",
        "多维表格",
        "Base 表、字段、记录、视图与工作流。",
        &["base:"],
        false,
    ),
    AuthDomain::new(
        "calendar",
        "日历与日程",
        "查看日程、忙闲并创建会议。",
        &["calendar:"],
        true,
    ),
    AuthDomain::new(
        "contact",
        "通讯录",
        "搜索同事并识别协作成员。",
        &["contact:"],
        true,
    ),
    AuthDomain::new(
        "docs",
        "云文档",
        "创建、读取和整理文档内容。",
        &["docs:", "docx:"],
        true,
    ),
    AuthDomain::new(
        "drive",
        "云空间",
        "搜索、上传、下载和管理云空间文件。",
        &["drive:", "space:"],
        true,
    ),
    AuthDomain::new(
        "event",
        "事件订阅",
        "订阅与消费飞书事件。",
        &["event:", "docs:event:"],
        false,
    ),
    AuthDomain::new(
        "im",
        "即时消息",
        "读取、发送消息和管理群聊。",
        &["im:"],
        false,
    ),
    AuthDomain::new(
        "mail",
        "邮箱",
        "邮件读取、草稿、发送和规则管理。",
        &["mail:"],
        false,
    ),
    AuthDomain::new(
        "markdown",
        "Markdown 文件",
        "云空间 Markdown 文件创建与更新。",
        &["markdown:"],
        false,
    ),
    AuthDomain::new(
        "minutes",
        "妙记",
        "搜索会议妙记和读取总结产物。",
        &["minutes:"],
        true,
    ),
    AuthDomain::new("okr", "OKR", "OKR 目标、关键结果和进展。", &["okr:"], false),
    AuthDomain::new(
        "sheets",
        "电子表格",
        "表格读取、写入和工作表管理。",
        &["sheets:"],
        false,
    ),
    AuthDomain::new(
        "slides",
        "幻灯片",
        "演示文稿创建、读取和编辑。",
        &["slides:"],
        false,
    ),
    AuthDomain::new(
        "task",
        "任务与待办",
        "查看、创建和跟进飞书任务。",
        &["task:"],
        true,
    ),
    AuthDomain::new(
        "vc",
        "视频会议",
        "历史会议、参会人和纪要产物。",
        &["vc:"],
        false,
    ),
    AuthDomain::new(
        "wiki",
        "知识库",
        "知识空间、节点和成员管理。",
        &["wiki:"],
        false,
    ),
    AuthDomain::new(
        "all",
        "全部范围",
        "请求 lark-cli 支持的全部业务域。",
        &[],
        false,
    ),
];

#[derive(Clone)]
pub struct FeishuCliService {
    database: AppDatabase,
    runtime_paths: CliRuntimePaths,
}

impl FeishuCliService {
    pub fn new(database: AppDatabase, runtime_paths: CliRuntimePaths) -> Self {
        Self {
            database,
            runtime_paths,
        }
    }

    fn active_cli(&self) -> (PathBuf, String, Option<String>, Option<String>) {
        resolve_active_cli(&self.runtime_paths)
    }

    fn active_cli_path(&self) -> PathBuf {
        self.active_cli().0
    }

    fn cli_home(&self) -> &PathBuf {
        &self.runtime_paths.cli_home
    }

    pub fn check_cli_update(&self) -> AppResult<FeishuCliUpdateCheck> {
        check_update(&self.runtime_paths)
    }

    pub fn run_cli_update(&self) -> AppResult<FeishuCliUpdateResult> {
        let database = self.database.clone();
        let result = update_cli(&self.runtime_paths, move |status| {
            let connection = database.open_connection()?;
            SettingsRepository::set_value(&connection, update_status_key(), status)
        });
        let connection = self.database.open_connection()?;
        match &result {
            Ok(_) => {
                SettingsRepository::delete_keys(&connection, &[KEY_FEISHU_LAST_UPDATE_ERROR])?;
            }
            Err(error) => {
                SettingsRepository::set_value(
                    &connection,
                    KEY_FEISHU_LAST_UPDATE_ERROR,
                    &error.to_string(),
                )?;
            }
        }
        result
    }

    pub fn read_update_status(&self) -> AppResult<Option<String>> {
        let connection = self.database.open_connection()?;
        SettingsRepository::get_value(&connection, update_status_key())
    }

    pub fn auto_ensure_ready(&self) -> FeishuCliHealth {
        let health = self.health();
        if health.installed && !health.update_available {
            return health;
        }
        if matches!(
            health.update_status.as_deref(),
            Some("checking" | "downloading" | "verifying")
        ) {
            return health;
        }
        if health.update_available || !health.installed {
            let _ = self.run_cli_update();
        }
        self.health()
    }

    pub fn auth_presets(&self) -> FeishuAuthPresetCatalog {
        FeishuAuthPresetCatalog {
            default_preset_id: "basic".to_string(),
            presets: vec![
                FeishuAuthPreset {
                    id: "basic".to_string(),
                    label: "基础助手".to_string(),
                    description: "日程、联系人、文档、云空间、妙记和任务。".to_string(),
                    domains: DEFAULT_AUTH_DOMAINS
                        .iter()
                        .map(|item| item.to_string())
                        .collect(),
                    recommended: true,
                },
                FeishuAuthPreset {
                    id: "docs".to_string(),
                    label: "文档协作".to_string(),
                    description: "文档、云空间、电子表格、知识库和 Markdown 文件。".to_string(),
                    domains: vec!["docs", "drive", "sheets", "wiki", "markdown"]
                        .into_iter()
                        .map(str::to_string)
                        .collect(),
                    recommended: false,
                },
                FeishuAuthPreset {
                    id: "meeting".to_string(),
                    label: "会议日程".to_string(),
                    description: "日历、联系人、妙记、任务和视频会议。".to_string(),
                    domains: vec!["calendar", "contact", "minutes", "task", "vc"]
                        .into_iter()
                        .map(str::to_string)
                        .collect(),
                    recommended: false,
                },
                FeishuAuthPreset {
                    id: "all".to_string(),
                    label: "全部能力".to_string(),
                    description: "请求 lark-cli 支持的全部业务域。".to_string(),
                    domains: vec!["all".to_string()],
                    recommended: false,
                },
            ],
        }
    }

    pub fn auth_effective_state(&self) -> AppResult<FeishuAuthEffectiveState> {
        let preferences = self.auth_preferences()?;
        let health = self.health();
        let granted_domains = self.fetch_granted_domains().unwrap_or_default();
        let needs_sync = domains_changed(
            &preferences.last_synced_domains,
            &preferences.selected_domains,
        ) || !preferences.pending_sync_domains.is_empty()
            || preferences.pending_device_code.is_some();
        Ok(FeishuAuthEffectiveState {
            selected_domains: preferences.selected_domains.clone(),
            synced_domains: preferences.last_synced_domains.clone(),
            pending_sync_domains: preferences.pending_sync_domains.clone(),
            granted_domains,
            needs_sync,
            pending_auth_url: preferences.pending_verification_url.clone(),
            authenticated: health.authenticated,
            configured: health.configured,
        })
    }

    fn ensure_cli_ready(&self) -> AppResult<()> {
        let (cli_path, source, active_version, _) = self.active_cli();
        if source == "missing" || !cli_path.exists() {
            return Err(feishu_cli_error(
                "CLI_MISSING",
                format!("lark-cli not found: {}", cli_path.display()),
            ));
        }
        match active_version {
            Some(version) if version_is_usable(&version) => Ok(()),
            Some(version) => Err(feishu_cli_error(
                "CLI_OUTDATED",
                format!("lark-cli {version} is below required {REQUIRED_LARK_CLI_VERSION}"),
            )),
            None => Err(feishu_cli_error(
                "CLI_OUTDATED",
                "Unable to read lark-cli version; update required",
            )),
        }
    }

    fn ensure_domain_for_operation(&self, operation: Operation) -> AppResult<()> {
        let Some(domain) = operation_to_domain(operation) else {
            return Ok(());
        };
        let health = self.health();
        if !health.configured {
            return Err(feishu_cli_error(
                "AUTH_REQUIRED",
                "Configure Feishu app first",
            ));
        }
        if !health.authenticated {
            return Err(feishu_cli_error(
                "AUTH_REQUIRED",
                "Feishu authorization required",
            ));
        }
        let preferences = self.auth_preferences()?;
        if !preferences
            .selected_domains
            .iter()
            .any(|item| item == &domain)
            && !preferences.selected_domains.contains(&"all".to_string())
        {
            return Err(feishu_cli_error_with_domains(
                "AUTH_SCOPE_MISSING",
                format!("Domain {domain} is not selected"),
                &[domain],
            ));
        }
        let granted_domains = self.fetch_granted_domains()?;
        if granted_domains.contains(&"all".to_string())
            || granted_domains.iter().any(|item| item == &domain)
        {
            return Ok(());
        }
        Err(feishu_cli_error_with_domains(
            "AUTH_SCOPE_MISSING",
            format!("Missing granted domain: {domain}"),
            &[domain],
        ))
    }

    pub fn fetch_granted_domains(&self) -> AppResult<Vec<String>> {
        let args = vec![
            "auth".to_string(),
            "status".to_string(),
            "--format".to_string(),
            "json".to_string(),
        ];
        let output = self.run_command_raw(&args, None)?;
        if !output.success {
            return Err(feishu_cli_error(
                "AUTH_REQUIRED",
                "Unable to read auth status",
            ));
        }
        parse_granted_domains(&output.stdout)
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
        let (cli_path, source, active_version, bundled_version) = self.active_cli();
        let update_status = self.read_update_status().ok().flatten();
        let last_update_error = self.read_last_update_error().ok().flatten();
        let update_available = self
            .check_cli_update()
            .map(|check| check.update_available)
            .unwrap_or(false);
        let bundled = self.runtime_paths.bundled_cli_path.exists();
        let path = Some(cli_path.display().to_string());
        let source_label = if source == "missing" {
            None
        } else {
            Some(source.clone())
        };

        if source == "missing" || !cli_path.exists() {
            return FeishuCliHealth {
                installed: false,
                bundled,
                configured: false,
                authenticated: false,
                path,
                version: active_version.clone(),
                source: source_label,
                error: Some(format!("lark-cli not found: {}", cli_path.display())),
                bundled_version: bundled_version.clone(),
                active_version: active_version.clone(),
                required_version: REQUIRED_LARK_CLI_VERSION.to_string(),
                update_available,
                auto_update_status: update_status.clone(),
                update_status,
                last_update_error,
                recommended_action: "update".to_string(),
            };
        }

        if active_version
            .as_ref()
            .is_none_or(|version| !version_is_usable(version))
        {
            return FeishuCliHealth {
                installed: true,
                bundled,
                configured: false,
                authenticated: false,
                path,
                version: active_version.clone(),
                source: source_label,
                error: Some(format!(
                    "lark-cli below required version {REQUIRED_LARK_CLI_VERSION}"
                )),
                bundled_version: bundled_version.clone(),
                active_version: active_version.clone(),
                required_version: REQUIRED_LARK_CLI_VERSION.to_string(),
                update_available: true,
                auto_update_status: update_status.clone(),
                update_status,
                last_update_error,
                recommended_action: "update".to_string(),
            };
        }

        let configured = self
            .run_command(&["config".to_string(), "show".to_string()])
            .is_ok();
        let authenticated = self
            .run_command(&[
                "auth".to_string(),
                "status".to_string(),
                "--format".to_string(),
                "json".to_string(),
            ])
            .is_ok();

        FeishuCliHealth {
            installed: true,
            bundled,
            configured,
            authenticated,
            path,
            version: active_version.clone(),
            source: source_label,
            error: None,
            bundled_version,
            active_version,
            required_version: REQUIRED_LARK_CLI_VERSION.to_string(),
            update_available,
            auto_update_status: update_status.clone(),
            update_status,
            last_update_error,
            recommended_action: recommended_action(configured, authenticated, update_available),
        }
    }

    fn read_last_update_error(&self) -> AppResult<Option<String>> {
        let connection = self.database.open_connection()?;
        SettingsRepository::get_value(&connection, KEY_FEISHU_LAST_UPDATE_ERROR)
    }

    pub fn auth_scope_catalog(&self) -> FeishuAuthScopeCatalog {
        let mut app_scopes = Vec::new();
        let mut app_id = None;
        let mut brand = None;
        let mut error = None;

        if !self.active_cli_path().exists() {
            error = Some(format!(
                "未找到随应用打包的 lark-cli：{}",
                self.active_cli_path().display()
            ));
        } else {
            let args = vec![
                "auth".to_string(),
                "scopes".to_string(),
                "--format".to_string(),
                "json".to_string(),
            ];
            match self.run_command(&args) {
                Ok(output) => match serde_json::from_str::<Value>(&output.stdout) {
                    Ok(value) => {
                        app_id = value
                            .get("appId")
                            .and_then(Value::as_str)
                            .map(str::to_string);
                        brand = value
                            .get("brand")
                            .and_then(Value::as_str)
                            .map(str::to_string);
                        if let Some(scopes) = value.get("userScopes").and_then(Value::as_array) {
                            app_scopes = scopes
                                .iter()
                                .filter_map(Value::as_str)
                                .map(str::to_string)
                                .collect();
                            app_scopes.sort();
                        }
                    }
                    Err(parse_error) => {
                        error = Some(format!("飞书授权范围解析失败：{parse_error}"));
                    }
                },
                Err(command_error) => {
                    error = Some(command_error.to_string());
                }
            }
        }

        FeishuAuthScopeCatalog {
            domains: build_domain_options(&app_scopes),
            app_scopes,
            recommended_domains: DEFAULT_AUTH_DOMAINS
                .iter()
                .map(|value| value.to_string())
                .collect(),
            app_id,
            brand,
            error,
        }
    }

    pub fn auth_preferences(&self) -> AppResult<FeishuAuthPreferences> {
        let connection = self.database.open_connection()?;
        let selected_domains = read_domain_list_setting(
            &connection,
            KEY_FEISHU_SELECTED_DOMAINS,
            default_auth_domains(),
        )?;
        let last_synced_domains =
            read_domain_list_setting(&connection, KEY_FEISHU_LAST_SYNCED_DOMAINS, Vec::new())?;
        let pending_sync_domains =
            read_domain_list_setting(&connection, KEY_FEISHU_PENDING_SYNC_DOMAINS, Vec::new())?;
        let pending_device_code =
            SettingsRepository::get_value(&connection, KEY_FEISHU_PENDING_DEVICE_CODE)?;
        let pending_verification_url =
            SettingsRepository::get_value(&connection, KEY_FEISHU_PENDING_VERIFICATION_URL)?;

        Ok(FeishuAuthPreferences {
            selected_domains,
            last_synced_domains,
            pending_sync_domains,
            pending_device_code,
            pending_verification_url,
        })
    }

    pub fn save_auth_preferences(
        &self,
        request: FeishuAuthPreferencesSaveRequest,
    ) -> AppResult<FeishuAuthPreferences> {
        let selected_domains = normalize_auth_domains(&request.selected_domains)?;
        if selected_domains.is_empty() {
            return Err(AppError::message("请至少选择一个飞书授权范围"));
        }

        let connection = self.database.open_connection()?;
        SettingsRepository::set_value(
            &connection,
            KEY_FEISHU_SELECTED_DOMAINS,
            &serde_json::to_string(&selected_domains)?,
        )?;
        drop(connection);

        self.auth_preferences()
    }

    pub fn auth_sync(&self, request: FeishuAuthSyncRequest) -> AppResult<FeishuAuthSyncResult> {
        let selected_domains = normalize_auth_domains(&request.selected_domains)?;
        if selected_domains.is_empty() {
            return Err(AppError::message("请至少选择一个飞书授权范围"));
        }

        let health = self.health();
        if !health.installed {
            return Err(AppError::message(
                health
                    .error
                    .unwrap_or_else(|| "未检测到 lark-cli".to_string()),
            ));
        }
        if !health.configured {
            return Err(AppError::message("请先配置飞书应用"));
        }

        let preferences = self.auth_preferences()?;
        let reauth_required = health.authenticated
            && domains_changed(&preferences.last_synced_domains, &selected_domains);

        if reauth_required {
            self.auth_logout()?;
        }

        let response = self.auth_begin(FeishuAuthBeginRequest {
            domains: selected_domains.clone(),
            scopes: Vec::new(),
            excludes: Vec::new(),
        })?;
        let payload = response
            .parsed_json
            .as_ref()
            .and_then(Value::as_object)
            .cloned();
        let pending_device_code = payload
            .as_ref()
            .and_then(|value| pick_nested_string_in_map(value, &["device_code"]));
        let verification_url = payload.as_ref().and_then(|value| {
            pick_nested_string_in_map(
                value,
                &[
                    "verification_uri_complete",
                    "verification_url",
                    "verification_uri",
                    "console_url",
                ],
            )
        });

        let connection = self.database.open_connection()?;
        SettingsRepository::set_value(
            &connection,
            KEY_FEISHU_SELECTED_DOMAINS,
            &serde_json::to_string(&selected_domains)?,
        )?;
        SettingsRepository::set_value(
            &connection,
            KEY_FEISHU_PENDING_SYNC_DOMAINS,
            &serde_json::to_string(&selected_domains)?,
        )?;
        save_optional_setting(
            &connection,
            KEY_FEISHU_PENDING_DEVICE_CODE,
            pending_device_code.as_deref(),
        )?;
        save_optional_setting(
            &connection,
            KEY_FEISHU_PENDING_VERIFICATION_URL,
            verification_url.as_deref(),
        )?;

        Ok(FeishuAuthSyncResult {
            selected_domains: selected_domains.clone(),
            last_synced_domains: preferences.last_synced_domains,
            verification_url,
            pending_device_code: pending_device_code.clone(),
            has_device_code: pending_device_code.is_some(),
            reauth_required,
            status: "waiting_browser_authorization".to_string(),
        })
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
        self.clear_pending_auth_state()?;
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
                .map(|value| validate_auth_domain(value))
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

        if !request.excludes.is_empty() {
            args.push("--exclude".to_string());
            args.push(
                request
                    .excludes
                    .iter()
                    .map(|value| required_text(value, "exclude"))
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
        self.ensure_cli_ready()?;
        let output = self.run_command(&args)?;
        let preferences = self.auth_preferences()?;
        let synced_domains = if preferences.pending_sync_domains.is_empty() {
            preferences.selected_domains.clone()
        } else {
            preferences.pending_sync_domains.clone()
        };
        let connection = self.database.open_connection()?;
        SettingsRepository::set_value(
            &connection,
            KEY_FEISHU_LAST_SYNCED_DOMAINS,
            &serde_json::to_string(&synced_domains)?,
        )?;
        self.clear_pending_auth_state()?;
        Ok(response_from_output(
            "auth_complete".to_string(),
            self.command_for_display(&args),
            output,
        ))
    }

    pub fn config_remove(&self) -> AppResult<FeishuCliResponse> {
        self.ensure_cli_ready()?;
        let args = vec!["config".to_string(), "remove".to_string()];
        let output = self.run_command(&args)?;
        self.clear_pending_auth_state()?;
        let connection = self.database.open_connection()?;
        SettingsRepository::delete_keys(
            &connection,
            &[
                KEY_FEISHU_SELECTED_DOMAINS,
                KEY_FEISHU_LAST_SYNCED_DOMAINS,
                KEY_FEISHU_PENDING_SYNC_DOMAINS,
            ],
        )?;
        SettingsRepository::set_value(
            &connection,
            KEY_FEISHU_SELECTED_DOMAINS,
            &serde_json::to_string(&default_auth_domains())?,
        )?;
        Ok(response_from_output(
            "config_remove".to_string(),
            self.command_for_display(&args),
            output,
        ))
    }

    pub fn auth_logout(&self) -> AppResult<FeishuCliResponse> {
        let args = vec!["auth".to_string(), "logout".to_string()];
        let output = self.run_command(&args)?;
        self.clear_pending_auth_state()?;
        Ok(response_from_output(
            "auth_logout".to_string(),
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

    fn clear_pending_auth_state(&self) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        SettingsRepository::delete_keys(
            &connection,
            &[
                KEY_FEISHU_PENDING_DEVICE_CODE,
                KEY_FEISHU_PENDING_VERIFICATION_URL,
                KEY_FEISHU_PENDING_SYNC_DOMAINS,
            ],
        )
    }

    pub fn read_operation(&self, request: FeishuCliRequest) -> AppResult<FeishuCliResponse> {
        self.ensure_cli_ready()?;
        let operation = parse_read_operation(&request.operation)?;
        if operation != Operation::AuthStatus {
            self.ensure_domain_for_operation(operation)?;
        }
        let command_args = build_operation_args(operation, &request.args, false)?;
        let output = self.run_command(&command_args)?;
        Ok(response_from_output(
            request.operation,
            self.command_for_display(&command_args),
            output,
        ))
    }

    pub fn write_preview(&self, request: FeishuCliRequest) -> AppResult<FeishuWritePreview> {
        self.ensure_cli_ready()?;
        let operation = parse_write_operation(&request.operation)?;
        self.ensure_domain_for_operation(operation)?;
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

    pub fn write_confirm(&self, operation_id: String) -> AppResult<FeishuCliResponse> {
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
        self.ensure_cli_ready()?;
        self.ensure_domain_for_operation(operation)?;
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

    fn run_command_raw(
        &self,
        args: &[String],
        stdin_text: Option<String>,
    ) -> AppResult<RawCommandOutput> {
        fs::create_dir_all(self.cli_home()).map_err(|error| {
            AppError::message(format!(
                "Failed to create lark-cli app data dir {}: {error}",
                self.cli_home().display()
            ))
        })?;

        let cli_path = self.active_cli_path();
        let mut command = Command::new(&cli_path);
        command
            .args(args)
            .env("LARK_CLI_HOME", self.cli_home())
            .env("LARK_CLI_CONFIG_HOME", self.cli_home())
            .env("XDG_CONFIG_HOME", self.cli_home())
            .env("NO_COLOR", "1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if stdin_text.is_some() {
            command.stdin(Stdio::piped());
        }

        apply_platform_process_options(&mut command);

        let mut child = command.spawn().map_err(|error| {
            feishu_cli_error(
                "CLI_MISSING",
                format!("Failed to run lark-cli {}: {error}", cli_path.display()),
            )
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
        Ok(RawCommandOutput {
            success: output.status.success(),
            stdout,
            stderr,
        })
    }

    fn run_command_with_stdin(
        &self,
        args: &[String],
        stdin_text: Option<String>,
    ) -> AppResult<ProcessOutput> {
        let raw = self.run_command_raw(args, stdin_text)?;
        if raw.success {
            return Ok(ProcessOutput {
                stdout: raw.stdout,
                stderr: raw.stderr,
            });
        }

        let combined = format!(
            "{}{}{}",
            raw.stdout,
            if raw.stdout.is_empty() || raw.stderr.is_empty() {
                ""
            } else {
                "
"
            },
            raw.stderr
        );
        let lowered = combined.to_ascii_lowercase();
        if lowered.contains("scope") || lowered.contains("permission") || lowered.contains("403") {
            return Err(feishu_cli_error(
                "AUTH_SCOPE_MISSING",
                combined.trim().to_string(),
            ));
        }
        if lowered.contains("not authenticated")
            || lowered.contains("login")
            || lowered.contains("unauthorized")
            || lowered.contains("401")
        {
            return Err(feishu_cli_error(
                "AUTH_REQUIRED",
                combined.trim().to_string(),
            ));
        }
        Err(AppError::message(format!("lark-cli failed: {combined}")))
    }

    fn command_for_display(&self, args: &[String]) -> Vec<String> {
        let mut command = vec![self.active_cli_path().display().to_string()];
        command.extend(args.iter().cloned());
        command
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
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

struct RawCommandOutput {
    success: bool,
    stdout: String,
    stderr: String,
}

struct AuthDomain {
    id: &'static str,
    label: &'static str,
    description: &'static str,
    scope_prefixes: &'static [&'static str],
    recommended: bool,
}

impl AuthDomain {
    const fn new(
        id: &'static str,
        label: &'static str,
        description: &'static str,
        scope_prefixes: &'static [&'static str],
        recommended: bool,
    ) -> Self {
        Self {
            id,
            label,
            description,
            scope_prefixes,
            recommended,
        }
    }
}

fn build_domain_options(app_scopes: &[String]) -> Vec<FeishuAuthDomainOption> {
    AUTH_DOMAINS
        .iter()
        .map(|domain| {
            let enabled_scope_count = if domain.id == "all" {
                app_scopes.len()
            } else {
                app_scopes
                    .iter()
                    .filter(|scope| {
                        domain
                            .scope_prefixes
                            .iter()
                            .any(|prefix| scope.starts_with(prefix))
                    })
                    .count()
            };
            FeishuAuthDomainOption {
                id: domain.id.to_string(),
                label: domain.label.to_string(),
                description: domain.description.to_string(),
                enabled_scope_count,
                available: domain.id == "all" || enabled_scope_count > 0 || app_scopes.is_empty(),
                recommended: domain.recommended,
            }
        })
        .collect()
}

fn default_auth_domains() -> Vec<String> {
    DEFAULT_AUTH_DOMAINS
        .iter()
        .map(|value| value.to_string())
        .collect()
}

fn read_domain_list_setting(
    connection: &Connection,
    key: &str,
    default_value: Vec<String>,
) -> AppResult<Vec<String>> {
    match SettingsRepository::get_value(connection, key)? {
        Some(raw) => {
            let values = serde_json::from_str::<Vec<String>>(raw.as_str())?;
            normalize_auth_domains(&values)
        }
        None => Ok(default_value),
    }
}

fn save_optional_setting(connection: &Connection, key: &str, value: Option<&str>) -> AppResult<()> {
    if let Some(value) = value.filter(|value| !value.trim().is_empty()) {
        SettingsRepository::set_value(connection, key, value)
    } else {
        SettingsRepository::delete_keys(connection, &[key])
    }
}

fn normalize_auth_domains(values: &[String]) -> AppResult<Vec<String>> {
    let mut normalized = Vec::new();
    for value in values {
        let domain = validate_auth_domain(value)?;
        if !normalized.contains(&domain) {
            normalized.push(domain);
        }
    }
    Ok(normalized)
}

fn domains_changed(previous: &[String], next: &[String]) -> bool {
    let mut left = previous.to_vec();
    let mut right = next.to_vec();
    left.sort();
    right.sort();
    left != right
}

fn operation_to_domain(operation: Operation) -> Option<&'static str> {
    match operation {
        Operation::AuthStatus => None,
        Operation::CalendarAgenda
        | Operation::CalendarFreebusy
        | Operation::CalendarEventCreate => Some("calendar"),
        Operation::ContactSearch => Some("contact"),
        Operation::TaskList | Operation::TaskCreate => Some("task"),
        Operation::DocSearch | Operation::DocCreateMarkdown => Some("docs"),
        Operation::MinutesSearch => Some("minutes"),
    }
}

fn recommended_action(configured: bool, authenticated: bool, update_available: bool) -> String {
    if update_available {
        "update"
    } else if !configured {
        "configure"
    } else if !authenticated {
        "authorize"
    } else {
        "ready"
    }
    .to_string()
}

fn parse_granted_domains(stdout: &str) -> AppResult<Vec<String>> {
    let value: Value = serde_json::from_str(stdout.trim())
        .map_err(|error| AppError::message(format!("Failed to parse auth status JSON: {error}")))?;
    if let Some(domains) = value.get("domains").and_then(Value::as_array) {
        let parsed = domains
            .iter()
            .filter_map(Value::as_str)
            .map(str::trim)
            .filter(|item| !item.is_empty())
            .map(str::to_string)
            .collect::<Vec<_>>();
        if !parsed.is_empty() {
            return Ok(parsed);
        }
    }
    if let Some(domains) = value.get("grantedDomains").and_then(Value::as_array) {
        let parsed = domains
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect::<Vec<_>>();
        if !parsed.is_empty() {
            return Ok(parsed);
        }
    }
    if let Some(scopes) = value
        .get("scopes")
        .or_else(|| value.get("userScopes"))
        .and_then(Value::as_array)
    {
        let mut domains = scopes
            .iter()
            .filter_map(Value::as_str)
            .filter_map(|scope| scope.split(':').next())
            .map(str::to_string)
            .collect::<Vec<_>>();
        domains.sort();
        domains.dedup();
        if !domains.is_empty() {
            return Ok(domains);
        }
    }
    Ok(Vec::new())
}

fn feishu_cli_error(code: &str, message: impl Into<String>) -> AppError {
    AppError::message(
        serde_json::json!({
            "code": code,
            "message": message.into(),
            "settingsPath": FEISHU_SETTINGS_PATH,
        })
        .to_string(),
    )
}

fn feishu_cli_error_with_domains(
    code: &str,
    message: impl Into<String>,
    missing_domains: &[&str],
) -> AppError {
    AppError::message(
        serde_json::json!({
            "code": code,
            "message": message.into(),
            "settingsPath": FEISHU_SETTINGS_PATH,
            "missingDomains": missing_domains,
        })
        .to_string(),
    )
}

fn pick_nested_string_in_map(
    value: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<String> {
    for key in keys {
        if let Some(text) = value
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
        {
            return Some(text.to_string());
        }
    }

    for nested in value.values() {
        if let Some(object) = nested.as_object() {
            if let Some(found) = pick_nested_string_in_map(object, keys) {
                return Some(found);
            }
        }
    }

    None
}

fn validate_auth_domain(value: &str) -> AppResult<String> {
    let domain = required_text(value, "domain")?;
    if AUTH_DOMAINS.iter().any(|item| item.id == domain) {
        Ok(domain)
    } else {
        Err(AppError::message(format!(
            "Unsupported Feishu auth domain: {domain}"
        )))
    }
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
    !matches!(operation, Operation::DocCreateMarkdown)
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
        assert_eq!(command_args, vec!["auth", "status", "--format", "json"]);
    }

    #[test]
    fn auth_domain_validation_matches_lark_cli_help() {
        assert_eq!(validate_auth_domain(" calendar ").unwrap(), "calendar");
        assert_eq!(validate_auth_domain("sheets").unwrap(), "sheets");
        assert_eq!(validate_auth_domain("all").unwrap(), "all");
        assert!(validate_auth_domain("unknown").is_err());
    }

    #[test]
    fn scope_catalog_counts_domain_prefixes() {
        let scopes = vec![
            "calendar:calendar:read".to_string(),
            "calendar:calendar.event:create".to_string(),
            "docx:document:create".to_string(),
            "docs:document.content:read".to_string(),
            "drive:file:download".to_string(),
        ];
        let domains = build_domain_options(&scopes);
        let calendar = domains.iter().find(|item| item.id == "calendar").unwrap();
        let docs = domains.iter().find(|item| item.id == "docs").unwrap();
        let drive = domains.iter().find(|item| item.id == "drive").unwrap();
        let task = domains.iter().find(|item| item.id == "task").unwrap();
        assert_eq!(calendar.enabled_scope_count, 2);
        assert_eq!(docs.enabled_scope_count, 2);
        assert_eq!(drive.enabled_scope_count, 1);
        assert_eq!(task.enabled_scope_count, 0);
        assert!(!task.available);
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
