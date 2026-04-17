use crate::infra::error::{AppError, AppResult};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};

pub const KEY_LLM_ACTIVE_PROVIDER: &str = "llm.active_provider";
pub const KEY_LLM_PROVIDERS: &str = "llm.providers";
pub const KEY_THRESHOLDS_DEFAULT: &str = "thresholds.default";
pub const KEY_MODULES_ENABLED: &str = "modules.enabled";

pub struct SettingsRepository;

impl SettingsRepository {
    pub fn get_value(connection: &Connection, key: &str) -> AppResult<Option<String>> {
        connection
            .query_row(
                "select value from app_settings where key = ?1",
                params![key],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(AppError::from)
    }

    pub fn set_value(connection: &Connection, key: &str, value: &str) -> AppResult<()> {
        connection.execute(
            r#"
            insert into app_settings (key, value, updated_at)
            values (?1, ?2, ?3)
            on conflict(key) do update set
              value = excluded.value,
              updated_at = excluded.updated_at
            "#,
            params![key, value, Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    pub fn delete_keys(connection: &Connection, keys: &[&str]) -> AppResult<()> {
        let mut statement = connection.prepare("delete from app_settings where key = ?1")?;

        for key in keys {
            statement.execute(params![key])?;
        }

        Ok(())
    }
}
