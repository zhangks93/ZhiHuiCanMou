use crate::infra::error::AppResult;
use rusqlite::Connection;

pub fn ensure(connection: &Connection) -> AppResult<()> {
    connection.execute_batch(
        r#"
        create table if not exists assistant_memories (
          id text primary key,
          namespace text not null,
          category text not null,
          title text not null check(length(trim(title)) > 0),
          content text not null check(length(trim(content)) > 0),
          importance integer not null default 50,
          source_agent_id text,
          source_conversation_id text,
          source_message_id text,
          content_sha text not null,
          file_path text not null,
          tags_json text not null default '[]',
          created_at integer not null,
          updated_at integer not null,
          unique(namespace, content_sha)
        );

        create index if not exists idx_assistant_memories_namespace_updated
          on assistant_memories(namespace, updated_at desc);

        create index if not exists idx_assistant_memories_category_importance
          on assistant_memories(category, importance desc, updated_at desc);

        create table if not exists assistant_memory_sources (
          memory_id text primary key,
          content text not null,
          file_path text not null,
          content_sha text not null,
          created_at integer not null,
          foreign key(memory_id) references assistant_memories(id) on delete cascade
        );

        create virtual table if not exists assistant_memories_fts using fts5(
          id unindexed,
          namespace,
          category,
          title,
          content,
          tags,
          tokenize='unicode61'
        );

        create trigger if not exists trg_assistant_memories_ai after insert on assistant_memories
        begin
          insert into assistant_memories_fts(id, namespace, category, title, content, tags)
          values (new.id, new.namespace, new.category, new.title, new.content, new.tags_json);
        end;

        create trigger if not exists trg_assistant_memories_ad after delete on assistant_memories
        begin
          delete from assistant_memories_fts where id = old.id;
        end;

        create trigger if not exists trg_assistant_memories_au after update on assistant_memories
        begin
          delete from assistant_memories_fts where id = old.id;
          insert into assistant_memories_fts(id, namespace, category, title, content, tags)
          values (new.id, new.namespace, new.category, new.title, new.content, new.tags_json);
        end;
        "#,
    )?;

    Ok(())
}
