use crate::features::agent_chat::model::{StoredArtifactPayloadRecord, StoredConversation};
use crate::features::agent_chat::{repository::AgentChatRepository, schema};
use crate::infra::error::{AppError, AppResult};
use crate::infra::sqlite::AppDatabase;

#[derive(Clone)]
pub struct AgentChatService {
    database: AppDatabase,
}

impl AgentChatService {
    pub fn new(database: AppDatabase) -> Self {
        Self { database }
    }

    pub fn list_conversations(&self, agent_id: &str) -> AppResult<Vec<StoredConversation>> {
        validate_required("agent_id", agent_id)?;
        let connection = self.database.open_connection()?;
        AgentChatRepository::list_conversations(&connection, agent_id)
    }

    pub fn save_conversations(
        &self,
        agent_id: &str,
        conversations: Vec<StoredConversation>,
        payload_records: Vec<StoredArtifactPayloadRecord>,
    ) -> AppResult<()> {
        validate_required("agent_id", agent_id)?;
        validate_conversations(&conversations)?;
        validate_payload_records(&payload_records)?;

        let mut connection = self.database.open_connection()?;
        let transaction = connection.transaction()?;

        AgentChatRepository::upsert_conversations(&transaction, agent_id, &conversations)?;
        AgentChatRepository::prune_conversations(&transaction, agent_id, &conversations)?;
        AgentChatRepository::upsert_payloads(&transaction, agent_id, &payload_records)?;
        AgentChatRepository::prune_payloads(&transaction, agent_id, &payload_records)?;
        AgentChatRepository::cleanup_orphan_payloads(&transaction, agent_id)?;

        transaction.commit()?;
        Ok(())
    }

    pub fn upsert_conversation(
        &self,
        agent_id: &str,
        conversation: StoredConversation,
        payload_records: Vec<StoredArtifactPayloadRecord>,
    ) -> AppResult<()> {
        validate_required("agent_id", agent_id)?;
        validate_conversations(std::slice::from_ref(&conversation))?;
        validate_payload_records(&payload_records)?;

        let mut connection = self.database.open_connection()?;
        let transaction = connection.transaction()?;

        AgentChatRepository::upsert_conversation(&transaction, agent_id, &conversation)?;
        AgentChatRepository::upsert_payloads(&transaction, agent_id, &payload_records)?;
        AgentChatRepository::prune_payloads_for_conversation(
            &transaction,
            agent_id,
            &conversation.id,
            &payload_records,
        )?;

        transaction.commit()?;
        Ok(())
    }

    pub fn prune_conversations(
        &self,
        agent_id: &str,
        keep_conversation_ids: Vec<String>,
    ) -> AppResult<()> {
        validate_required("agent_id", agent_id)?;

        let conversations = keep_conversation_ids
            .into_iter()
            .map(|id| StoredConversation {
                id,
                title: "__keep__".to_string(),
                messages: Vec::new(),
                memory: None,
                context: None,
                created_at: 0,
                updated_at: 0,
            })
            .collect::<Vec<_>>();

        let mut connection = self.database.open_connection()?;
        let transaction = connection.transaction()?;
        AgentChatRepository::prune_conversations(&transaction, agent_id, &conversations)?;
        AgentChatRepository::cleanup_orphan_payloads(&transaction, agent_id)?;
        transaction.commit()?;
        Ok(())
    }

    pub fn delete_conversation(&self, agent_id: &str, conversation_id: &str) -> AppResult<()> {
        validate_required("agent_id", agent_id)?;
        validate_required("conversation_id", conversation_id)?;

        let mut connection = self.database.open_connection()?;
        let transaction = connection.transaction()?;
        let deleted =
            AgentChatRepository::delete_conversation(&transaction, agent_id, conversation_id)?;

        if !deleted {
            return Err(AppError::message(format!(
                "Agent conversation not found: {conversation_id}"
            )));
        }

        transaction.commit()?;
        Ok(())
    }

    pub fn get_artifact_payload(
        &self,
        agent_id: &str,
        artifact_id: &str,
    ) -> AppResult<Option<StoredArtifactPayloadRecord>> {
        validate_required("agent_id", agent_id)?;
        validate_required("artifact_id", artifact_id)?;

        let connection = self.database.open_connection()?;
        AgentChatRepository::get_artifact_payload(&connection, agent_id, artifact_id)
    }

    pub fn ensure_schema(&self) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        schema::ensure(&connection)
    }
}

fn validate_required(field: &str, value: &str) -> AppResult<()> {
    if value.trim().is_empty() {
        return Err(AppError::message(format!("{field} is required")));
    }
    Ok(())
}

fn validate_conversations(conversations: &[StoredConversation]) -> AppResult<()> {
    for conversation in conversations {
        validate_required("conversation.id", &conversation.id)?;
        validate_required("conversation.title", &conversation.title)?;
    }

    Ok(())
}

fn validate_payload_records(payload_records: &[StoredArtifactPayloadRecord]) -> AppResult<()> {
    for payload in payload_records {
        validate_required("payload.id", &payload.id)?;
        validate_required("payload.artifact_id", &payload.artifact_id)?;
        validate_required("payload.conversation_id", &payload.conversation_id)?;
        validate_required("payload.tool_name", &payload.tool_name)?;
    }

    Ok(())
}
