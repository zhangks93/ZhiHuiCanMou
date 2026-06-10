use crate::infra::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::Manager;

pub const REQUIRED_LARK_CLI_VERSION: &str = "1.0.50";
const NPM_REGISTRY_LATEST: &str = "https://registry.npmjs.org/@larksuite/cli/latest";
const KEY_FEISHU_CLI_UPDATE_STATUS: &str = "feishu_cli.update_status";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LarkCliManifest {
    pub version: String,
    pub sha256: Option<String>,
    pub updated_at: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuCliUpdateCheck {
    pub active_version: Option<String>,
    pub bundled_version: Option<String>,
    pub latest_version: Option<String>,
    pub required_version: String,
    pub update_available: bool,
    pub active_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeishuCliUpdateResult {
    pub success: bool,
    pub active_version: Option<String>,
    pub active_source: String,
    pub message: String,
    pub update_status: String,
}

#[derive(Debug, Clone)]
pub struct CliRuntimePaths {
    pub cli_home: PathBuf,
    pub bundled_cli_path: PathBuf,
    pub bundled_manifest_path: PathBuf,
    pub runtime_cli_path: PathBuf,
    pub runtime_manifest_path: PathBuf,
}

pub fn resolve_cli_paths(app: &tauri::AppHandle) -> AppResult<CliRuntimePaths> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::message(format!("Failed to resolve app data dir: {error}")))?;
    let cli_home = app_data_dir.join("lark-cli");
    let runtime_cli_path = cli_home.join("bin").join("lark-cli.exe");
    let runtime_manifest_path = cli_home.join("bin").join("lark-cli.manifest.json");

    #[cfg(windows)]
    let (bundled_cli_path, bundled_manifest_path) = {
        let bundled_cli_path = app
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
        let bundled_manifest_path = bundled_cli_path
            .parent()
            .map(|dir| dir.join("lark-cli.manifest.json"))
            .unwrap_or_else(|| {
                app_data_dir.join("resources/lark-cli/windows/lark-cli.manifest.json")
            });
        (bundled_cli_path, bundled_manifest_path)
    };

    #[cfg(not(windows))]
    let (bundled_cli_path, bundled_manifest_path) = (
        app_data_dir.join("unsupported-lark-cli"),
        app_data_dir.join("unsupported-lark-cli.manifest.json"),
    );

    Ok(CliRuntimePaths {
        cli_home,
        bundled_cli_path,
        bundled_manifest_path,
        runtime_cli_path,
        runtime_manifest_path,
    })
}

pub fn read_manifest(path: &Path) -> Option<LarkCliManifest> {
    if !path.exists() {
        return None;
    }
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn read_version_from_manifest(path: &Path) -> Option<String> {
    read_manifest(path).map(|manifest| manifest.version)
}

pub fn resolve_active_cli(
    paths: &CliRuntimePaths,
) -> (PathBuf, String, Option<String>, Option<String>) {
    let bundled_version = read_version_from_manifest(&paths.bundled_manifest_path)
        .or_else(|| probe_cli_version(&paths.bundled_cli_path, &paths.cli_home));
    let runtime_version = read_version_from_manifest(&paths.runtime_manifest_path)
        .or_else(|| probe_cli_version(&paths.runtime_cli_path, &paths.cli_home));

    if paths.runtime_cli_path.exists() {
        if let Some(ref version) = runtime_version {
            if version_is_usable(version) {
                return (
                    paths.runtime_cli_path.clone(),
                    "runtime".to_string(),
                    runtime_version,
                    bundled_version,
                );
            }
        }
    }

    if paths.bundled_cli_path.exists() {
        return (
            paths.bundled_cli_path.clone(),
            "bundled".to_string(),
            bundled_version.clone(),
            bundled_version,
        );
    }

    (
        paths.bundled_cli_path.clone(),
        "missing".to_string(),
        None,
        bundled_version,
    )
}

pub fn probe_cli_version(cli_path: &Path, cli_home: &Path) -> Option<String> {
    if !cli_path.exists() {
        return None;
    }
    let mut command = Command::new(cli_path);
    command
        .arg("--version")
        .env("LARK_CLI_HOME", cli_home)
        .env("LARK_CLI_CONFIG_HOME", cli_home)
        .env("XDG_CONFIG_HOME", cli_home)
        .env("NO_COLOR", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_platform_process_options(&mut command);
    let output = command.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let fallback = String::from_utf8_lossy(&output.stderr);
    parse_version_text(&text).or_else(|| parse_version_text(&fallback))
}

#[cfg(windows)]
pub fn apply_platform_process_options(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
pub fn apply_platform_process_options(_command: &mut Command) {}

pub fn parse_version_text(text: &str) -> Option<String> {
    for token in text.split_whitespace() {
        if token.chars().next()?.is_ascii_digit() {
            return Some(normalize_version(token));
        }
    }
    None
}

pub fn normalize_version(value: &str) -> String {
    value.trim_start_matches('v').trim().to_string()
}

pub fn version_is_usable(version: &str) -> bool {
    compare_versions(version, REQUIRED_LARK_CLI_VERSION) >= 0
}

pub fn compare_versions(left: &str, right: &str) -> i32 {
    let left_parts = parse_version_parts(left);
    let right_parts = parse_version_parts(right);
    let max_len = left_parts.len().max(right_parts.len());
    for index in 0..max_len {
        let left_value = *left_parts.get(index).unwrap_or(&0);
        let right_value = *right_parts.get(index).unwrap_or(&0);
        if left_value != right_value {
            return left_value.cmp(&right_value) as i32;
        }
    }
    0
}

fn parse_version_parts(value: &str) -> Vec<u64> {
    normalize_version(value)
        .split('.')
        .map(|part| part.parse::<u64>().unwrap_or(0))
        .collect()
}

pub fn check_update(paths: &CliRuntimePaths) -> AppResult<FeishuCliUpdateCheck> {
    let (_active_path, active_source, active_version, bundled_version) = resolve_active_cli(paths);
    let latest_version = fetch_latest_registry_version()?;
    let update_available = match (&active_version, &latest_version) {
        (Some(active), Some(latest)) => compare_versions(active, latest) < 0,
        (None, Some(_)) => true,
        _ => false,
    };

    Ok(FeishuCliUpdateCheck {
        active_version,
        bundled_version,
        latest_version,
        required_version: REQUIRED_LARK_CLI_VERSION.to_string(),
        update_available,
        active_source,
    })
}

pub fn update_status_key() -> &'static str {
    KEY_FEISHU_CLI_UPDATE_STATUS
}

pub(crate) fn fetch_latest_registry_version() -> AppResult<Option<String>> {
    let mut response = ureq::get(NPM_REGISTRY_LATEST)
        .call()
        .map_err(|error| AppError::message(format!("查询 npm registry 失败: {error}")))?;
    let value: serde_json::Value = response
        .body_mut()
        .read_json()
        .map_err(|error| AppError::message(format!("解析 npm registry 响应失败: {error}")))?;
    Ok(value
        .get("version")
        .and_then(serde_json::Value::as_str)
        .map(normalize_version))
}

pub(crate) fn download_npm_tarball(version: &str) -> AppResult<Vec<u8>> {
    let tarball_url = format!("https://registry.npmjs.org/@larksuite/cli/-/cli-{version}.tgz");
    let mut response = ureq::get(&tarball_url)
        .call()
        .map_err(|error| AppError::message(format!("下载 lark-cli 失败: {error}")))?;
    response
        .body_mut()
        .with_config()
        .limit(128 * 1024 * 1024)
        .read_to_vec()
        .map_err(|error| AppError::message(format!("读取 lark-cli 安装包失败: {error}")))
}

pub(crate) fn extract_lark_cli_from_tarball(tarball: &[u8], target: &Path) -> AppResult<()> {
    use flate2::read::GzDecoder;
    use tar::Archive;

    let decoder = GzDecoder::new(tarball);
    let mut archive = Archive::new(decoder);
    for entry in archive.entries().map_err(AppError::from)? {
        let mut entry = entry.map_err(AppError::from)?;
        let path = entry.path().map_err(AppError::from)?;
        let normalized = path
            .components()
            .map(|component| component.as_os_str())
            .collect::<PathBuf>();
        let relative = normalized
            .strip_prefix("package")
            .or_else(|_| normalized.strip_prefix("package/"))
            .unwrap_or(&normalized);
        if relative == Path::new("bin/lark-cli.exe") {
            let mut bytes = Vec::new();
            entry.read_to_end(&mut bytes).map_err(AppError::from)?;
            fs::write(target, bytes)?;
            return Ok(());
        }
    }
    Err(AppError::message(
        "安装包中未找到 bin/lark-cli.exe，可能 npm 包结构已变化",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compare_versions_orders_semver_like_values() {
        assert!(compare_versions("1.0.33", "1.0.32") > 0);
        assert!(compare_versions("1.0.32", "1.0.32") == 0);
        assert!(compare_versions("1.0.9", "1.0.10") < 0);
    }
}
