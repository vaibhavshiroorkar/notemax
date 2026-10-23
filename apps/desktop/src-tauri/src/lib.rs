use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    AppHandle, Emitter, Manager, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_opener::OpenerExt;
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

// Google refuses to sign in inside an embedded webview, so sign-in happens in
// the user's browser. Supabase then redirects to this port, where the app is
// listening. Must match SIGN_IN_REDIRECT in apps/app/src/account/google.ts and
// be listed under Redirect URLs in the Supabase dashboard.
const SIGN_IN_PORT: u16 = 47820;
static LISTENING: AtomicBool = AtomicBool::new(false);

const SIGNED_IN_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Notemax</title>\
<body style=\"font:16px system-ui;text-align:center;padding-top:20vh\">\
<p>You can close this tab and go back to Notemax.</p>";

/// How long Quit waits for the main window to save and send before quitting anyway.
const QUIT_WAIT: std::time::Duration = std::time::Duration::from_secs(8);

/// Quit from the tray: the main window first saves open pages and sends waiting
/// edits, then calls quit_now. A window that cannot answer does not hold Quit up.
fn quit_softly(app: &AppHandle) {
    if app.emit_to("main", "quit-requested", ()).is_err() {
        app.exit(0);
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(QUIT_WAIT);
        app.exit(0);
    });
}

#[tauri::command]
fn quit_now(app: AppHandle) {
    app.exit(0);
}

/// Opens the sign-in page in the browser and waits for its redirect.
/// A listener left over from an abandoned attempt is reused, not doubled.
#[tauri::command]
fn open_sign_in(app: AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("the sign-in address must use https".into());
    }
    if !LISTENING.swap(true, Ordering::SeqCst) {
        let listener = TcpListener::bind(("127.0.0.1", SIGN_IN_PORT)).map_err(|err| {
            LISTENING.store(false, Ordering::SeqCst);
            format!("port {SIGN_IN_PORT} is in use by another program: {err}")
        })?;
        let app = app.clone();
        std::thread::spawn(move || {
            wait_for_redirect(&app, listener);
            LISTENING.store(false, Ordering::SeqCst);
        });
    }
    app.opener().open_url(url, None::<&str>).map_err(|err| err.to_string())
}

/// Answers requests until one carries the sign-in result, then hands its query
/// string to the main window. The code in it is useless without the secret the
/// app kept when sign-in started, so a stray local request can do no harm.
fn wait_for_redirect(app: &AppHandle, listener: TcpListener) {
    for stream in listener.incoming() {
        let Ok(mut stream) = stream else { continue };
        // Browsers sometimes open a connection early and send nothing on it.
        // Without a timeout that one connection would block the real redirect.
        let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(5)));
        let mut request_line = String::new();
        // The redirect is the browser opening a page. A web page can also send
        // requests here, but those say so in their headers, and must not end
        // the wait before the real redirect comes.
        let mut navigation = true;
        {
            let mut reader = BufReader::new(&stream);
            if reader.read_line(&mut request_line).is_err() {
                continue;
            }
            let mut header = String::new();
            while reader.read_line(&mut header).is_ok_and(|n| n > 2) {
                let lower = header.to_ascii_lowercase();
                if lower.starts_with("origin:") || (lower.starts_with("sec-fetch-mode:") && !lower.contains("navigate")) {
                    navigation = false;
                }
                header.clear();
            }
        }
        // For example "GET /?code=abc HTTP/1.1".
        let target = request_line.split_whitespace().nth(1).unwrap_or("");
        let query = target.split_once('?').map_or("", |(_, query)| query);
        let done = navigation && query.split('&').any(|pair| pair.starts_with("code=") || pair.starts_with("error="));
        let (status, body) = if done { ("200 OK", SIGNED_IN_PAGE) } else { ("404 Not Found", "") };
        let _ = write!(
            stream,
            "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        if done {
            let _ = app.emit_to("main", "sign-in-redirect", query.to_string());
            show_main(app);
            return;
        }
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
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_sign_in, quit_now])
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
                    "quit" => quit_softly(app),
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
