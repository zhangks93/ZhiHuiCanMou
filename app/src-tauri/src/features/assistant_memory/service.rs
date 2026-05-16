use crate::features::assistant_memory::model::{
    AssistantMemoryEntry, AssistantMemoryHealth, AssistantMemoryInput, AssistantMemoryRecallQuery,
    AssistantMemoryRecallResult, AssistantMemorySource,
};
use crate::features::assistant_memory::{repository::AssistantMemoryRepository, schema};
use crate::infra::error::{AppError, AppResult};
use crate::infra::sqlite::AppDatabase;
use chrono::Utc;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;

const MAX_MEMORY_CONTENT_CHARS: usize = 24_000;
const DEFAULT_IMPORTANCE: i64 = 50;

#[derive(Clone)]
pub struct AssistantMemoryService {
    database: AppDatabase,
    vault_path: PathBuf,
}

impl AssistantMemoryService {
    pub fn new(database: AppDatabase, vault_path: PathBuf) -> Self {
        Self {
            database,
            vault_path,
        }
    }

    pub fn ensure_schema(&self) -> AppResult<()> {
        let connection = self.database.open_connection()?;
        schema::ensure(&connection)
    }

    pub fn store(&self, input: AssistantMemoryInput) -> AppResult<AssistantMemoryEntry> {
        let namespace = normalize_required("namespace", &input.namespace)?;
        let title = normalize_required("title", &input.title)?;
        let content = normalize_required("content", &input.content)?;
        if content.chars().count() > MAX_MEMORY_CONTENT_CHARS {
            return Err(AppError::message(format!(
                "memory content exceeds {MAX_MEMORY_CONTENT_CHARS} characters"
            )));
        }

        fs::create_dir_all(&self.vault_path)?;

        let tags = normalize_tags(input.tags.unwrap_or_default());
        let content_sha = stable_hash(&format!(
            "{}\n{}\n{}\n{}",
            namespace,
            input.category.as_str(),
            title,
            content
        ));
        let now = Utc::now().timestamp_millis();
        let id = format!("mem_{content_sha}");
        let file_path = self.write_markdown(
            &id,
            &namespace,
            input.category.as_str(),
            &title,
            &content,
            &tags,
        )?;
        let entry = AssistantMemoryEntry {
            id: id.clone(),
            namespace,
            category: input.category,
            title,
            content: build_search_content(&content),
            importance: input.importance.unwrap_or(DEFAULT_IMPORTANCE).clamp(0, 100),
            source_agent_id: input.source_agent_id,
            source_conversation_id: input.source_conversation_id,
            source_message_id: input.source_message_id,
            content_sha,
            file_path: file_path.display().to_string(),
            tags,
            created_at: now,
            updated_at: now,
        };
        let source = AssistantMemorySource {
            memory_id: id,
            content,
            file_path: entry.file_path.clone(),
            content_sha: entry.content_sha.clone(),
        };

        let mut connection = self.database.open_connection()?;
        let transaction = connection.transaction()?;
        AssistantMemoryRepository::upsert(&transaction, &entry, &source)?;
        transaction.commit()?;

        Ok(entry)
    }

    pub fn recall(
        &self,
        query: AssistantMemoryRecallQuery,
    ) -> AppResult<Vec<AssistantMemoryRecallResult>> {
        let connection = self.database.open_connection()?;
        AssistantMemoryRepository::recall(&connection, &query)
    }

    pub fn get(&self, memory_id: &str) -> AppResult<Option<AssistantMemoryEntry>> {
        validate_required("memory_id", memory_id)?;
        let connection = self.database.open_connection()?;
        AssistantMemoryRepository::get(&connection, memory_id)
    }

    pub fn get_source(&self, memory_id: &str) -> AppResult<Option<AssistantMemorySource>> {
        validate_required("memory_id", memory_id)?;
        let connection = self.database.open_connection()?;
        AssistantMemoryRepository::get_source(&connection, memory_id)
    }

    pub fn forget(&self, memory_id: &str) -> AppResult<()> {
        validate_required("memory_id", memory_id)?;
        let connection = self.database.open_connection()?;
        let deleted = AssistantMemoryRepository::forget(&connection, memory_id)?;
        if !deleted {
            return Err(AppError::message(format!("memory not found: {memory_id}")));
        }
        Ok(())
    }

    pub fn list_namespaces(&self) -> AppResult<Vec<String>> {
        let connection = self.database.open_connection()?;
        AssistantMemoryRepository::list_namespaces(&connection)
    }

    pub fn health(&self) -> AppResult<AssistantMemoryHealth> {
        let connection = self.database.open_connection()?;
        AssistantMemoryRepository::health(&connection, &self.vault_path)
    }

    fn write_markdown(
        &self,
        id: &str,
        namespace: &str,
        category: &str,
        title: &str,
        content: &str,
        tags: &[String],
    ) -> AppResult<PathBuf> {
        let namespace_dir = self.vault_path.join(sanitize_path_segment(namespace));
        fs::create_dir_all(&namespace_dir)?;
        let path = namespace_dir.join(format!("{id}.md"));
        let markdown = format!(
            "---\nid: {id}\nnamespace: {namespace}\ncategory: {category}\ntitle: \"{}\"\ntags: [{}]\n---\n\n{}",
            title.replace('"', "\\\""),
            tags.iter()
                .map(|tag| format!("\"{}\"", tag.replace('"', "\\\"")))
                .collect::<Vec<_>>()
                .join(", "),
            content
        );
        fs::write(&path, markdown)?;
        Ok(path)
    }
}

fn normalize_required(field: &str, value: &str) -> AppResult<String> {
    let trimmed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if trimmed.is_empty() {
        return Err(AppError::message(format!("{field} is required")));
    }
    Ok(trimmed)
}

fn validate_required(field: &str, value: &str) -> AppResult<()> {
    if value.trim().is_empty() {
        return Err(AppError::message(format!("{field} is required")));
    }
    Ok(())
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut normalized = tags
        .into_iter()
        .map(|tag| tag.trim().to_lowercase())
        .filter(|tag| !tag.is_empty())
        .take(12)
        .collect::<Vec<_>>();
    normalized.sort();
    normalized.dedup();
    normalized
}

fn stable_hash(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn build_search_content(content: &str) -> String {
    let normalized = content.trim();
    if normalized.chars().count() <= 4000 {
        return normalized.to_string();
    }

    normalized.chars().take(4000).collect::<String>()
}

fn sanitize_path_segment(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect()
}
