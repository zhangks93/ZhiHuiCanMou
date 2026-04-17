use crate::infra::error::AppResult;
use rusqlite::Connection;

pub fn ensure(connection: &Connection) -> AppResult<()> {
    connection.execute_batch(
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
    )?;

    Ok(())
}
