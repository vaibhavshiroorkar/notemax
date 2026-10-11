use tauri_plugin_sql::{Migration, MigrationKind};

/// The local notes database. The front end opens the same URL in apps/app/src/useLocalDoc.ts.
const DB_URL: &str = "sqlite:notemax.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = vec![Migration {
    version: 1,
    description: "create updates log",
    // The same file the TypeScript tests run against, so the two cannot drift apart.
    sql: include_str!("../../../../packages/core/src/schema.sql"),
    kind: MigrationKind::Up,
  }];

  tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations(DB_URL, migrations)
        .build(),
    )
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running the Notemax desktop app");
}
