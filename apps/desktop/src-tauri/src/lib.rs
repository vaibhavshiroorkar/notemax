use tauri::{
    AppHandle, Manager, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_sql::{Migration, MigrationKind};

// Must match DESKTOP_DB_URL in apps/app/src/platform.ts.
const DB_URL: &str = "sqlite:notemax.db";

// Ctrl+Shift+N would be the obvious choice, but Chrome and Edge use it for a
// private window, and a global shortcut would take it away from them.
const CAPTURE_SHORTCUT: &str = "Ctrl+Alt+N";

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// The shortcut opens the capture box, and pressing it again puts it away.
fn toggle_capture(app: &AppHandle) {
    let Some(window) = app.get_webview_window("capture") else { return };
    if window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

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
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)));
    }

    builder
        .plugin(tauri_plugin_sql::Builder::default().add_migrations(DB_URL, migrations).build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
                app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
                // Another program may already own the shortcut. The app still
                // works without it, through the tray menu.
                if let Err(err) = app.global_shortcut().on_shortcut(CAPTURE_SHORTCUT, |app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_capture(app);
                    }
                }) {
                    log::warn!("could not register {CAPTURE_SHORTCUT}: {err}");
                }
            }

            let open = MenuItem::with_id(app, "open", "Open Notemax", true, None::<&str>)?;
            let capture = MenuItem::with_id(app, "capture", format!("Quick capture ({CAPTURE_SHORTCUT})"), true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Notemax", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &capture, &quit])?;
            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().cloned().expect("bundle has an icon"))
                .tooltip("Notemax")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "capture" => toggle_capture(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing a window hides it. The app keeps running in the tray, so the
            // capture shortcut still works. "Quit Notemax" in the tray really quits.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the Notemax desktop app");
}
