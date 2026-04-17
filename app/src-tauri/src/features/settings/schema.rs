use crate::infra::error::AppResult;
use rusqlite::Connection;

pub fn ensure(connection: &Connection) -> AppResult<()> {
    connection.execute_batch(
        r#"
        create table if not exists app_settings (
          key text primary key,
          value text not null,
          updated_at text not null
        );
        "#,
    )?;

    Ok(())
}
