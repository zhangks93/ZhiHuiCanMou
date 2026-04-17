use std::fs;
use std::path::PathBuf;

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

#[derive(Clone)]
pub struct AgentChatStore {
    db_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredConversation {
    pub id: String,
    pub title: String,
    pub messages: Vec<Value>,
    pub memory: Option<Value>,
    pub context: Option<Value>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredArtifactPayloadRecord {
    pub id: String,
    pub artifact_id: String,
    pub conversation_id: String,
    pub payload: String,
    pub tool_name: String,
    pub created_at: i64,
}

impl AgentChatStore {
    pub fn initialize(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("Failed to resolve app data dir: {error}"))?;

        fs::create_dir_all(&app_data_dir)
            .map_err(|error| format!("Failed to create app data dir: {error}"))?;

        let db_path = app_data_dir.join("canmou.db");
        let store = Self { db_path };
        store.ensure_schema()?;
        Ok(store)
    }

    fn open_connection(&self) -> Result<Connection, String> {
        Connection::open(&self.db_path).map_err(|error| {
            format!(
                "Failed to open SQLite database {}: {error}",
                self.db_path.display()
            )
        })
    }

    fn ensure_schema(&self) -> Result<(), String> {
        let connection = self.open_connection()?;
        connection
            .execute_batch(
                r#"
                create table if not exists agent_conversations (
                  id text primary key,
                  agent_id text not null,
                  title text not null check(length(trim(title)) > 0),
                  messages_json text not null,
                  memory_json text,
                  context_json text,
                  created_at integer not null,
                  updated_at integer not null
                );

                create index if not exists idx_agent_conversations_agent_updated
                  on agent_conversations(agent_id, updated_at desc);

                create table if not exists agent_artifact_payloads (
                  id text primary key,
                  agent_id text not null,
                  artifact_id text not null,
                  conversation_id text not null,
                  tool_name text not null,
                  payload text not null,
                  created_at integer not null
                );

                create index if not exists idx_agent_artifact_payloads_agent_artifact
                  on agent_artifact_payloads(agent_id, artifact_id);

                create index if not exists idx_agent_artifact_payloads_agent_conversation
                  on agent_artifact_payloads(agent_id, conversation_id);
                "#,
            )
            .map_err(|error| format!("Failed to initialize agent chat schema: {error}"))?;

        Ok(())
    }

    pub fn list_conversations(&self, agent_id: &str) -> Result<Vec<StoredConversation>, String> {
        validate_agent_id(agent_id)?;

        let connection = self.open_connection()?;
        let mut statement = connection
            .prepare(
                r#"
                select
                  id,
                  title,
                  messages_json,
                  memory_json,
                  context_json,
                  created_at,
                  updated_at
                from agent_conversations
                where agent_id = ?1
                order by updated_at desc, created_at desc
                "#,
            )
            .map_err(|error| format!("Failed to prepare agent conversation query: {error}"))?;

        let rows = statement
            .query_map(params![agent_id], |row| {
                let messages_json: String = row.get(2)?;
                let memory_json: Option<String> = row.get(3)?;
                let context_json: Option<String> = row.get(4)?;

                Ok(StoredConversation {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    messages: deserialize_json_field(&messages_json)
                        .map_err(rusqlite::Error::ToSqlConversionFailure)?,
                    memory: deserialize_optional_json_field(memory_json)
                        .map_err(rusqlite::Error::ToSqlConversionFailure)?,
                    context: deserialize_optional_json_field(context_json)
                        .map_err(rusqlite::Error::ToSqlConversionFailure)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .map_err(|error| format!("Failed to query agent conversations: {error}"))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to decode agent conversations: {error}"))
    }

    pub fn save_conversations(
        &self,
        agent_id: &str,
        conversations: Vec<StoredConversation>,
        payload_records: Vec<StoredArtifactPayloadRecord>,
    ) -> Result<(), String> {
        validate_agent_id(agent_id)?;
        validate_conversations(&conversations)?;
        validate_payload_records(&payload_records)?;

        let mut connection = self.open_connection()?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Failed to start agent chat transaction: {error}"))?;

        upsert_conversations(&transaction, agent_id, &conversations)?;
        prune_conversations(&transaction, agent_id, &conversations)?;
        upsert_payloads(&transaction, agent_id, &payload_records)?;
        prune_payloads(&transaction, agent_id, &payload_records)?;
        cleanup_orphan_payloads(&transaction, agent_id)?;

        transaction
            .commit()
            .map_err(|error| format!("Failed to commit agent chat transaction: {error}"))?;

        Ok(())
    }

    pub fn delete_conversation(&self, agent_id: &str, conversation_id: &str) -> Result<(), String> {
        validate_agent_id(agent_id)?;
        validate_required("conversation_id", conversation_id)?;

        let mut connection = self.open_connection()?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Failed to start agent chat delete transaction: {error}"))?;

        transaction
            .execute(
                "delete from agent_artifact_payloads where agent_id = ?1 and conversation_id = ?2",
                params![agent_id, conversation_id],
            )
            .map_err(|error| format!("Failed to delete agent artifact payloads: {error}"))?;

        let affected = transaction
            .execute(
                "delete from agent_conversations where agent_id = ?1 and id = ?2",
                params![agent_id, conversation_id],
            )
            .map_err(|error| format!("Failed to delete agent conversation: {error}"))?;

        if affected == 0 {
            return Err(format!("Agent conversation not found: {conversation_id}"));
        }

        transaction
            .commit()
            .map_err(|error| format!("Failed to commit agent chat delete transaction: {error}"))?;

        Ok(())
    }

    pub fn get_artifact_payload(
        &self,
        agent_id: &str,
        artifact_id: &str,
    ) -> Result<Option<StoredArtifactPayloadRecord>, String> {
        validate_agent_id(agent_id)?;
        validate_required("artifact_id", artifact_id)?;

        let connection = self.open_connection()?;
        connection
            .query_row(
                r#"
                select
                  id,
                  artifact_id,
                  conversation_id,
                  payload,
                  tool_name,
                  created_at
                from agent_artifact_payloads
                where agent_id = ?1 and artifact_id = ?2
                limit 1
                "#,
                params![agent_id, artifact_id],
                |row| {
                    Ok(StoredArtifactPayloadRecord {
                        id: row.get(0)?,
                        artifact_id: row.get(1)?,
                        conversation_id: row.get(2)?,
                        payload: row.get(3)?,
                        tool_name: row.get(4)?,
                        created_at: row.get(5)?,
                    })
                },
            )
            .optional()
            .map_err(|error| format!("Failed to query agent artifact payload: {error}"))
    }
}

fn validate_agent_id(agent_id: &str) -> Result<(), String> {
    validate_required("agent_id", agent_id)
}

fn validate_required(field: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{field} is required"));
    }
    Ok(())
}

fn validate_conversations(conversations: &[StoredConversation]) -> Result<(), String> {
    for conversation in conversations {
        validate_required("conversation.id", &conversation.id)?;
        validate_required("conversation.title", &conversation.title)?;
    }
    Ok(())
}

fn validate_payload_records(payload_records: &[StoredArtifactPayloadRecord]) -> Result<(), String> {
    for payload in payload_records {
        validate_required("payload.id", &payload.id)?;
        validate_required("payload.artifact_id", &payload.artifact_id)?;
        validate_required("payload.conversation_id", &payload.conversation_id)?;
        validate_required("payload.tool_name", &payload.tool_name)?;
    }
    Ok(())
}

fn deserialize_json_field<T>(raw: &str) -> Result<T, Box<dyn std::error::Error + Send + Sync>>
where
    T: for<'de> Deserialize<'de>,
{
    serde_json::from_str(raw)
        .map_err(|error| Box::new(error) as Box<dyn std::error::Error + Send + Sync>)
}

fn deserialize_optional_json_field(
    raw: Option<String>,
) -> Result<Option<Value>, Box<dyn std::error::Error + Send + Sync>> {
    match raw {
        Some(value) => deserialize_json_field(&value).map(Some),
        None => Ok(None),
    }
}

fn serialize_json_field<T>(value: &T) -> Result<String, String>
where
    T: Serialize,
{
    serde_json::to_string(value).map_err(|error| format!("Failed to encode JSON field: {error}"))
}

fn upsert_conversations(
    transaction: &Transaction<'_>,
    agent_id: &str,
    conversations: &[StoredConversation],
) -> Result<(), String> {
    for conversation in conversations {
        let messages_json = serialize_json_field(&conversation.messages)?;
        let memory_json = conversation
            .memory
            .as_ref()
            .map(serialize_json_field)
            .transpose()?;
        let context_json = conversation
            .context
            .as_ref()
            .map(serialize_json_field)
            .transpose()?;

        transaction
            .execute(
                r#"
                insert into agent_conversations (
                  id,
                  agent_id,
                  title,
                  messages_json,
                  memory_json,
                  context_json,
                  created_at,
                  updated_at
                ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                on conflict(id) do update set
                  agent_id = excluded.agent_id,
                  title = excluded.title,
                  messages_json = excluded.messages_json,
                  memory_json = excluded.memory_json,
                  context_json = excluded.context_json,
                  created_at = excluded.created_at,
                  updated_at = excluded.updated_at
                "#,
                params![
                    &conversation.id,
                    agent_id,
                    &conversation.title,
                    messages_json,
                    memory_json,
                    context_json,
                    conversation.created_at,
                    conversation.updated_at,
                ],
            )
            .map_err(|error| {
                format!(
                    "Failed to upsert agent conversation {}: {error}",
                    conversation.id
                )
            })?;
    }

    Ok(())
}

fn prune_conversations(
    transaction: &Transaction<'_>,
    agent_id: &str,
    conversations: &[StoredConversation],
) -> Result<(), String> {
    if conversations.is_empty() {
        transaction
            .execute(
                "delete from agent_conversations where agent_id = ?1",
                params![agent_id],
            )
            .map_err(|error| format!("Failed to clear agent conversations: {error}"))?;
        return Ok(());
    }

    let existing_ids = select_ids(
        transaction,
        "select id from agent_conversations where agent_id = ?1",
        params![agent_id],
    )?;
    let keep_ids = conversations
        .iter()
        .map(|conversation| conversation.id.as_str())
        .collect::<std::collections::HashSet<_>>();

    for id in existing_ids {
        if keep_ids.contains(id.as_str()) {
            continue;
        }

        transaction
            .execute(
                "delete from agent_artifact_payloads where agent_id = ?1 and conversation_id = ?2",
                params![agent_id, id],
            )
            .map_err(|error| {
                format!("Failed to delete stale agent payloads for conversation {id}: {error}")
            })?;
        transaction
            .execute(
                "delete from agent_conversations where agent_id = ?1 and id = ?2",
                params![agent_id, id],
            )
            .map_err(|error| format!("Failed to delete stale agent conversation {id}: {error}"))?;
    }

    Ok(())
}

fn upsert_payloads(
    transaction: &Transaction<'_>,
    agent_id: &str,
    payload_records: &[StoredArtifactPayloadRecord],
) -> Result<(), String> {
    for payload in payload_records {
        transaction
            .execute(
                r#"
                insert into agent_artifact_payloads (
                  id,
                  agent_id,
                  artifact_id,
                  conversation_id,
                  tool_name,
                  payload,
                  created_at
                ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                on conflict(id) do update set
                  agent_id = excluded.agent_id,
                  artifact_id = excluded.artifact_id,
                  conversation_id = excluded.conversation_id,
                  tool_name = excluded.tool_name,
                  payload = excluded.payload,
                  created_at = excluded.created_at
                "#,
                params![
                    &payload.id,
                    agent_id,
                    &payload.artifact_id,
                    &payload.conversation_id,
                    &payload.tool_name,
                    &payload.payload,
                    payload.created_at,
                ],
            )
            .map_err(|error| {
                format!(
                    "Failed to upsert agent artifact payload {}: {error}",
                    payload.id
                )
            })?;
    }

    Ok(())
}

fn prune_payloads(
    transaction: &Transaction<'_>,
    agent_id: &str,
    payload_records: &[StoredArtifactPayloadRecord],
) -> Result<(), String> {
    if payload_records.is_empty() {
        transaction
            .execute(
                "delete from agent_artifact_payloads where agent_id = ?1",
                params![agent_id],
            )
            .map_err(|error| format!("Failed to clear agent artifact payloads: {error}"))?;
        return Ok(());
    }

    let existing_ids = select_ids(
        transaction,
        "select id from agent_artifact_payloads where agent_id = ?1",
        params![agent_id],
    )?;
    let keep_ids = payload_records
        .iter()
        .map(|payload| payload.id.as_str())
        .collect::<std::collections::HashSet<_>>();

    for id in existing_ids {
        if keep_ids.contains(id.as_str()) {
            continue;
        }

        transaction
            .execute(
                "delete from agent_artifact_payloads where agent_id = ?1 and id = ?2",
                params![agent_id, id],
            )
            .map_err(|error| {
                format!("Failed to delete stale agent artifact payload {id}: {error}")
            })?;
    }

    Ok(())
}

fn cleanup_orphan_payloads(transaction: &Transaction<'_>, agent_id: &str) -> Result<(), String> {
    transaction
        .execute(
            r#"
            delete from agent_artifact_payloads
            where agent_id = ?1
              and conversation_id not in (
                select id from agent_conversations where agent_id = ?1
              )
            "#,
            params![agent_id],
        )
        .map_err(|error| format!("Failed to cleanup orphan agent artifact payloads: {error}"))?;

    Ok(())
}

fn select_ids<P>(transaction: &Transaction<'_>, sql: &str, params: P) -> Result<Vec<String>, String>
where
    P: rusqlite::Params,
{
    let mut statement = transaction
        .prepare(sql)
        .map_err(|error| format!("Failed to prepare id query: {error}"))?;
    let rows = statement
        .query_map(params, |row| row.get::<_, String>(0))
        .map_err(|error| format!("Failed to execute id query: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to collect ids: {error}"))
}
