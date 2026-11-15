use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg(desktop)]
mod browser;
#[cfg(desktop)]
mod desktop;

// Must match DESKTOP_DB_URL in apps/app/src/platform/platform.ts.
const DB_URL: &str = "sqlite:notemax.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create updates log",
        sql: include_str!("../../../../packages/core/src/schema.sql"),
        kind: MigrationKind::Up,
    }];

    let mut builder = tauri::Builder::default();

    // Registered first, so a second launch shows the running app instead of
    // starting another copy that would write to the same database.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| desktop::show_main(app)))
            .invoke_handler(tauri::generate_handler![
                desktop::open_sign_in,
                desktop::quit_now,
                browser::browser_show,
                browser::browser_place,
                browser::browser_hide,
                browser::browser_step,
                browser::browser_close
            ])
            .on_window_event(desktop::on_window_event);
    }

    // On a phone, sign-in comes back as a notemax:// link, and files are saved
    // through the system's own Save dialog, since the web view cannot download.
    #[cfg(mobile)]
    {
        builder = builder
            .plugin(tauri_plugin_deep_link::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_fs::init());
    }

    builder
        .plugin(tauri_plugin_sql::Builder::default().add_migrations(DB_URL, migrations).build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(desktop)]
            desktop::setup(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Notemax");
}
