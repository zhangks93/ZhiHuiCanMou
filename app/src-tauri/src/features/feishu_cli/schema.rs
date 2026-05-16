use crate::infra::error::AppResult;
use rusqlite::Connection;

pub fn ensure(connection: &Connection) -> AppResult<()> {
    connection.execute_batch(
        r#"
        create table if not exists feishu_cli_operation_logs (
          id text primary key,
          operation text not null,
          args_json text not null,
          dry_run_json text,
          command_json text,
          status text not null,
          stdout text,
          stderr text,
          created_at text not null,
          executed_at text
        );

        create index if not exists idx_feishu_cli_operation_logs_created_at
          on feishu_cli_operation_logs(created_at);
        "#,
    )?;

    Ok(())
}
