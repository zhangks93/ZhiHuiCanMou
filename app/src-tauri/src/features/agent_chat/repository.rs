use crate::features::agent_chat::model::{StoredArtifactPayloadRecord, StoredConversation};
use crate::infra::error::{AppError, AppResult};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

pub struct AgentChatRepository;

impl AgentChatRepository {
    pub fn list_conversations(
        connection: &Connection,
        agent_id: &str,
    ) -> AppResult<Vec<StoredConversation>> {
        let mut statement = connection.prepare(
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
        )?;

        let rows = statement.query_map(params![agent_id], |row| {
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
        })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn get_artifact_payload(
        connection: &Connection,
        agent_id: &str,
        artifact_id: &str,
    ) -> AppResult<Option<StoredArtifactPayloadRecord>> {
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
            .map_err(AppError::from)
    }

    pub fn upsert_conversations(
        transaction: &Transaction<'_>,
        agent_id: &str,
        conversations: &[StoredConversation],
    ) -> AppResult<()> {
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

            transaction.execute(
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
            )?;
        }

        Ok(())
    }

    pub fn upsert_conversation(
        transaction: &Transaction<'_>,
        agent_id: &str,
        conversation: &StoredConversation,
    ) -> AppResult<()> {
        Self::upsert_conversations(transaction, agent_id, std::slice::from_ref(conversation))
    }

    pub fn prune_conversations(
        transaction: &Transaction<'_>,
        agent_id: &str,
        conversations: &[StoredConversation],
    ) -> AppResult<()> {
        if conversations.is_empty() {
            transaction.execute(
                "delete from agent_conversations where agent_id = ?1",
                params![agent_id],
            )?;
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
            .collect::<HashSet<_>>();

        for id in existing_ids {
            if keep_ids.contains(id.as_str()) {
                continue;
            }

            transaction.execute(
                "delete from agent_artifact_payloads where agent_id = ?1 and conversation_id = ?2",
                params![agent_id, id],
            )?;
            transaction.execute(
                "delete from agent_conversations where agent_id = ?1 and id = ?2",
                params![agent_id, id],
            )?;
        }

        Ok(())
    }

    pub fn upsert_payloads(
        transaction: &Transaction<'_>,
        agent_id: &str,
        payload_records: &[StoredArtifactPayloadRecord],
    ) -> AppResult<()> {
        for payload in payload_records {
            transaction.execute(
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
            )?;
        }

        Ok(())
    }

    pub fn prune_payloads(
        transaction: &Transaction<'_>,
        agent_id: &str,
        payload_records: &[StoredArtifactPayloadRecord],
    ) -> AppResult<()> {
        if payload_records.is_empty() {
            transaction.execute(
                "delete from agent_artifact_payloads where agent_id = ?1",
                params![agent_id],
            )?;
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
            .collect::<HashSet<_>>();

        for id in existing_ids {
            if keep_ids.contains(id.as_str()) {
                continue;
            }

            transaction.execute(
                "delete from agent_artifact_payloads where agent_id = ?1 and id = ?2",
                params![agent_id, id],
            )?;
        }

        Ok(())
    }

    pub fn prune_payloads_for_conversation(
        transaction: &Transaction<'_>,
        agent_id: &str,
        conversation_id: &str,
        payload_records: &[StoredArtifactPayloadRecord],
    ) -> AppResult<()> {
        let keep_ids = payload_records
            .iter()
            .map(|payload| payload.id.as_str())
            .collect::<HashSet<_>>();

        let existing_ids = select_ids(
            transaction,
            "select id from agent_artifact_payloads where agent_id = ?1 and conversation_id = ?2",
            params![agent_id, conversation_id],
        )?;

        for id in existing_ids {
            if keep_ids.contains(id.as_str()) {
                continue;
            }

            transaction.execute(
                "delete from agent_artifact_payloads where agent_id = ?1 and id = ?2",
                params![agent_id, id],
            )?;
        }

        Ok(())
    }

    pub fn delete_conversation(
        transaction: &Transaction<'_>,
        agent_id: &str,
        conversation_id: &str,
    ) -> AppResult<bool> {
        transaction.execute(
            "delete from agent_artifact_payloads where agent_id = ?1 and conversation_id = ?2",
            params![agent_id, conversation_id],
        )?;

        let affected = transaction.execute(
            "delete from agent_conversations where agent_id = ?1 and id = ?2",
            params![agent_id, conversation_id],
        )?;

        Ok(affected > 0)
    }

    pub fn cleanup_orphan_payloads(transaction: &Transaction<'_>, agent_id: &str) -> AppResult<()> {
        transaction.execute(
            r#"
            delete from agent_artifact_payloads
            where agent_id = ?1
              and conversation_id not in (
                select id from agent_conversations where agent_id = ?1
              )
            "#,
            params![agent_id],
        )?;

        Ok(())
    }
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

fn serialize_json_field<T>(value: &T) -> AppResult<String>
where
    T: Serialize,
{
    serde_json::to_string(value).map_err(AppError::from)
}

fn select_ids<P>(transaction: &Transaction<'_>, sql: &str, params: P) -> AppResult<Vec<String>>
where
    P: rusqlite::Params,
{
    let mut statement = transaction.prepare(sql)?;
    let rows = statement.query_map(params, |row| row.get::<_, String>(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}
