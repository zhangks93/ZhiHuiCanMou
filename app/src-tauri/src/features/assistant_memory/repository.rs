use crate::features::assistant_memory::model::{
    AssistantMemoryEntry, AssistantMemoryHealth, AssistantMemoryRecallQuery,
    AssistantMemoryRecallResult, AssistantMemorySource, MemoryCategory,
};
use crate::infra::error::{AppError, AppResult};
use rusqlite::{params, Connection, OptionalExtension, ToSql, Transaction};
use std::path::Path;

pub struct AssistantMemoryRepository;

impl AssistantMemoryRepository {
    pub fn upsert(
        transaction: &Transaction<'_>,
        entry: &AssistantMemoryEntry,
        source: &AssistantMemorySource,
    ) -> AppResult<()> {
        let tags_json = serde_json::to_string(&entry.tags)?;
        transaction.execute(
            r#"
            insert into assistant_memories (
              id,
              namespace,
              category,
              title,
              content,
              importance,
              source_agent_id,
              source_conversation_id,
              source_message_id,
              content_sha,
              file_path,
              tags_json,
              created_at,
              updated_at
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            on conflict(namespace, content_sha) do update set
              title = excluded.title,
              content = excluded.content,
              importance = max(assistant_memories.importance, excluded.importance),
              source_agent_id = coalesce(excluded.source_agent_id, assistant_memories.source_agent_id),
              source_conversation_id = coalesce(excluded.source_conversation_id, assistant_memories.source_conversation_id),
              source_message_id = coalesce(excluded.source_message_id, assistant_memories.source_message_id),
              file_path = excluded.file_path,
              tags_json = excluded.tags_json,
              updated_at = excluded.updated_at
            "#,
            params![
                &entry.id,
                &entry.namespace,
                entry.category.as_str(),
                &entry.title,
                &entry.content,
                entry.importance,
                &entry.source_agent_id,
                &entry.source_conversation_id,
                &entry.source_message_id,
                &entry.content_sha,
                &entry.file_path,
                tags_json,
                entry.created_at,
                entry.updated_at,
            ],
        )?;

        transaction.execute(
            r#"
            insert into assistant_memory_sources (
              memory_id,
              content,
              file_path,
              content_sha,
              created_at
            ) values (?1, ?2, ?3, ?4, ?5)
            on conflict(memory_id) do update set
              content = excluded.content,
              file_path = excluded.file_path,
              content_sha = excluded.content_sha
            "#,
            params![
                &source.memory_id,
                &source.content,
                &source.file_path,
                &source.content_sha,
                entry.created_at,
            ],
        )?;

        Ok(())
    }

    pub fn get(
        connection: &Connection,
        memory_id: &str,
    ) -> AppResult<Option<AssistantMemoryEntry>> {
        connection
            .query_row(
                r#"
                select id, namespace, category, title, content, importance,
                  source_agent_id, source_conversation_id, source_message_id,
                  content_sha, file_path, tags_json, created_at, updated_at
                from assistant_memories
                where id = ?1
                "#,
                params![memory_id],
                map_memory_entry,
            )
            .optional()
            .map_err(AppError::from)
    }

    pub fn recall(
        connection: &Connection,
        query: &AssistantMemoryRecallQuery,
    ) -> AppResult<Vec<AssistantMemoryRecallResult>> {
        let sanitized_query = build_fts_query(&query.query);
        if sanitized_query.is_empty() {
            return Self::list_recent(connection, query);
        }

        let limit = normalize_limit(query.limit);
        let namespace_filter = query.namespaces.as_deref().unwrap_or(&[]);
        let category_filter = query.categories.as_deref().unwrap_or(&[]);

        let mut sql = String::from(
            r#"
            select m.id, m.namespace, m.category, m.title, m.content, m.importance,
              m.source_agent_id, m.source_conversation_id, m.source_message_id,
              m.content_sha, m.file_path, m.tags_json, m.created_at, m.updated_at,
              bm25(f) as rank
            from assistant_memories_fts f
            join assistant_memories m on m.id = f.id
            where assistant_memories_fts match ?1
            "#,
        );
        let mut boxed_params: Vec<Box<dyn ToSql>> = vec![Box::new(sanitized_query)];

        append_in_filter(&mut sql, &mut boxed_params, "m.namespace", namespace_filter);
        let categories = category_filter
            .iter()
            .map(|category| category.as_str().to_string())
            .collect::<Vec<_>>();
        append_in_filter(&mut sql, &mut boxed_params, "m.category", &categories);
        sql.push_str(" order by (m.importance * 0.03) - rank desc, m.updated_at desc limit ?");
        boxed_params.push(Box::new(limit));

        let params = boxed_params
            .iter()
            .map(|value| value.as_ref() as &dyn ToSql)
            .collect::<Vec<_>>();

        let mut statement = connection.prepare(&sql)?;
        let rows = statement.query_map(params.as_slice(), |row| {
            let entry = map_memory_entry(row)?;
            let rank: f64 = row.get(14)?;
            Ok(AssistantMemoryRecallResult {
                snippet: build_snippet(&entry.content),
                score: entry.importance as f64 - rank,
                entry,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn list_recent(
        connection: &Connection,
        query: &AssistantMemoryRecallQuery,
    ) -> AppResult<Vec<AssistantMemoryRecallResult>> {
        let limit = normalize_limit(query.limit);
        let namespace_filter = query.namespaces.as_deref().unwrap_or(&[]);
        let category_filter = query.categories.as_deref().unwrap_or(&[]);
        let mut sql = String::from(
            r#"
            select id, namespace, category, title, content, importance,
              source_agent_id, source_conversation_id, source_message_id,
              content_sha, file_path, tags_json, created_at, updated_at
            from assistant_memories
            where 1 = 1
            "#,
        );
        let mut boxed_params: Vec<Box<dyn ToSql>> = Vec::new();

        append_in_filter(&mut sql, &mut boxed_params, "namespace", namespace_filter);
        let categories = category_filter
            .iter()
            .map(|category| category.as_str().to_string())
            .collect::<Vec<_>>();
        append_in_filter(&mut sql, &mut boxed_params, "category", &categories);
        sql.push_str(" order by importance desc, updated_at desc limit ?");
        boxed_params.push(Box::new(limit));

        let params = boxed_params
            .iter()
            .map(|value| value.as_ref() as &dyn ToSql)
            .collect::<Vec<_>>();

        let mut statement = connection.prepare(&sql)?;
        let rows = statement.query_map(params.as_slice(), |row| {
            let entry = map_memory_entry(row)?;
            Ok(AssistantMemoryRecallResult {
                snippet: build_snippet(&entry.content),
                score: entry.importance as f64,
                entry,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn forget(connection: &Connection, memory_id: &str) -> AppResult<bool> {
        let affected = connection.execute(
            "delete from assistant_memories where id = ?1",
            params![memory_id],
        )?;
        Ok(affected > 0)
    }

    pub fn get_source(
        connection: &Connection,
        memory_id: &str,
    ) -> AppResult<Option<AssistantMemorySource>> {
        connection
            .query_row(
                r#"
                select memory_id, content, file_path, content_sha
                from assistant_memory_sources
                where memory_id = ?1
                "#,
                params![memory_id],
                |row| {
                    Ok(AssistantMemorySource {
                        memory_id: row.get(0)?,
                        content: row.get(1)?,
                        file_path: row.get(2)?,
                        content_sha: row.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(AppError::from)
    }

    pub fn list_namespaces(connection: &Connection) -> AppResult<Vec<String>> {
        let mut statement = connection
            .prepare("select distinct namespace from assistant_memories order by namespace")?;
        let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn health(connection: &Connection, vault_path: &Path) -> AppResult<AssistantMemoryHealth> {
        let memory_count =
            connection.query_row("select count(*) from assistant_memories", [], |row| {
                row.get::<_, i64>(0)
            })?;
        let source_count =
            connection.query_row("select count(*) from assistant_memory_sources", [], |row| {
                row.get::<_, i64>(0)
            })?;

        Ok(AssistantMemoryHealth {
            memory_count,
            source_count,
            vault_path: vault_path.display().to_string(),
        })
    }
}

fn map_memory_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<AssistantMemoryEntry> {
    let category: String = row.get(2)?;
    let tags_json: String = row.get(11)?;
    let tags = serde_json::from_str::<Vec<String>>(&tags_json).unwrap_or_default();

    Ok(AssistantMemoryEntry {
        id: row.get(0)?,
        namespace: row.get(1)?,
        category: MemoryCategory::from(category),
        title: row.get(3)?,
        content: row.get(4)?,
        importance: row.get(5)?,
        source_agent_id: row.get(6)?,
        source_conversation_id: row.get(7)?,
        source_message_id: row.get(8)?,
        content_sha: row.get(9)?,
        file_path: row.get(10)?,
        tags,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

fn normalize_limit(limit: Option<i64>) -> i64 {
    limit.unwrap_or(6).clamp(1, 20)
}

fn append_in_filter<T: ToSql + Clone + 'static>(
    sql: &mut String,
    params: &mut Vec<Box<dyn ToSql>>,
    column: &str,
    values: &[T],
) {
    if values.is_empty() {
        return;
    }

    sql.push_str(" and ");
    sql.push_str(column);
    sql.push_str(" in (");
    sql.push_str(
        &std::iter::repeat("?")
            .take(values.len())
            .collect::<Vec<_>>()
            .join(", "),
    );
    sql.push(')');

    for value in values {
        params.push(Box::new(value.clone()));
    }
}

fn build_fts_query(query: &str) -> String {
    query
        .split(|character: char| !character.is_alphanumeric())
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .take(12)
        .map(|token| format!("{}*", token.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" OR ")
}

fn build_snippet(content: &str) -> String {
    let normalized = content.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.chars().count() <= 220 {
        return normalized;
    }

    normalized.chars().take(220).collect::<String>() + "..."
}
