use super::cli_runtime::{
    compare_versions, download_npm_tarball, extract_lark_cli_from_tarball,
    fetch_latest_registry_version, probe_cli_version, CliRuntimePaths, FeishuCliUpdateResult,
    LarkCliManifest, REQUIRED_LARK_CLI_VERSION,
};
use crate::infra::error::{AppError, AppResult};
use std::fs;

pub fn update_cli(
    paths: &CliRuntimePaths,
    set_update_status: impl Fn(&str) -> AppResult<()>,
) -> AppResult<FeishuCliUpdateResult> {
    #[cfg(not(windows))]
    {
        return Ok(FeishuCliUpdateResult {
            success: false,
            active_version: None,
            active_source: "unsupported".to_string(),
            message: "lark-cli update is Windows-only".to_string(),
            update_status: "failed".to_string(),
        });
    }

    set_update_status("checking")?;
    let latest_version = fetch_latest_registry_version()?.ok_or_else(|| {
        AppError::message("missing latest version")
    })?;
    set_update_status("downloading")?;
    let tarball = download_npm_tarball(&latest_version)?;
    set_update_status("verifying")?;
    fs::create_dir_all(paths.runtime_cli_path.parent().unwrap())?;
    let previous_runtime = paths.runtime_cli_path.exists();
    let backup_path = paths.runtime_cli_path.with_extension("exe.bak");
    if previous_runtime {
        let _ = fs::remove_file(&backup_path);
        fs::rename(&paths.runtime_cli_path, &backup_path)?;
    }
    if let Err(error) = extract_lark_cli_from_tarball(&tarball, &paths.runtime_cli_path) {
        if previous_runtime && backup_path.exists() {
            let _ = fs::rename(&backup_path, &paths.runtime_cli_path);
        }
        set_update_status("failed")?;
        return Err(error);
    }
    let verified_version = probe_cli_version(&paths.runtime_cli_path, &paths.cli_home)
        .ok_or_else(|| AppError::message("updated cli failed to run"))?;
    if compare_versions(&verified_version, REQUIRED_LARK_CLI_VERSION) < 0 {
        let _ = fs::remove_file(&paths.runtime_cli_path);
        if previous_runtime && backup_path.exists() {
            let _ = fs::rename(&backup_path, &paths.runtime_cli_path);
        }
        set_update_status("failed")?;
        return Err(AppError::message("downloaded cli below required version"));
    }
    let manifest = LarkCliManifest {
        version: verified_version.clone(),
        sha256: None,
        updated_at: Some(chrono::Utc::now().to_rfc3339()),
        source: Some("runtime".to_string()),
    };
    fs::write(
        &paths.runtime_manifest_path,
        serde_json::to_string_pretty(&manifest)?,
    )?;
    let _ = fs::remove_file(&backup_path);
    set_update_status("done")?;
    Ok(FeishuCliUpdateResult {
        success: true,
        active_version: Some(verified_version),
        active_source: "runtime".to_string(),
        message: format!("lark-cli updated to {latest_version}"),
        update_status: "done".to_string(),
    })
}