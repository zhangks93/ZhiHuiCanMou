use crate::features::{
    agent_chat::AgentChatService, assistant_memory::AssistantMemoryService,
    schedule::ScheduleService, settings::SettingsService,
};
use crate::infra::error::{AppError, AppResult};
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager};

#[derive(Clone)]
pub struct AppDatabase {
    db_path: PathBuf,
}

impl AppDatabase {
    pub fn initialize(app: &AppHandle) -> AppResult<Self> {
        let db_path = resolve_db_path(app)?;
        let database = Self { db_path };
        database.ensure_all_schemas()?;
        Ok(database)
    }

    pub fn open_connection(&self) -> AppResult<Connection> {
        let connection = Connection::open(&self.db_path).map_err(|error| {
            AppError::message(format!(
                "Failed to open SQLite database {}: {error}",
                self.db_path.display()
            ))
        })?;

        configure_connection(&connection)?;

        Ok(connection)
    }

    fn ensure_all_schemas(&self) -> AppResult<()> {
        AgentChatService::new(self.clone()).ensure_schema()?;
        AssistantMemoryService::new(self.clone(), self.memory_vault_path()?).ensure_schema()?;
        ScheduleService::new(self.clone()).ensure_schema()?;
        SettingsService::new(self.clone()).ensure_schema()?;
        Ok(())
    }

    pub fn memory_vault_path(&self) -> AppResult<PathBuf> {
        let parent = self
            .db_path
            .parent()
            .ok_or_else(|| AppError::message("Failed to resolve SQLite database parent dir"))?;
        Ok(parent.join("assistant-memory"))
    }
}

fn configure_connection(connection: &Connection) -> AppResult<()> {
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(AppError::from)?;
    connection.execute_batch(
        r#"
        pragma foreign_keys = on;
        pragma journal_mode = wal;
        pragma synchronous = normal;
        "#,
    )?;
    Ok(())
}

pub fn resolve_db_path(app: &AppHandle) -> AppResult<PathBuf> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::message(format!("Failed to resolve app data dir: {error}")))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|error| AppError::message(format!("Failed to create app data dir: {error}")))?;

    Ok(app_data_dir.join("canmou.db"))
}
