//! Browser pages in the desktop app: a real web view laid over the page, so
//! sites that refuse to show inside a frame, like Google, still open. Links
//! that would open a new window open in the same view instead, so reading
//! stays inside the page. The page in the app says where the view goes and
//! hears back where it went.
//!
//! The commands are async so they run off the main thread: making a web view
//! waits for the main thread, and a command on it would wait forever.

use serde::Serialize;
use tauri::webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, WebviewUrl};

#[derive(Clone, Serialize)]
struct Visited {
    label: String,
    url: String,
}

#[derive(Clone, Serialize)]
struct Titled {
    label: String,
    title: String,
}

fn web_address(url: &str) -> Result<Url, String> {
    let parsed: Url = url.parse().map_err(|_| format!("not a web address: {url}"))?;
    match parsed.scheme() {
        "http" | "https" => Ok(parsed),
        _ => Err("only http and https pages open here".into()),
    }
}

fn place(view: &tauri::Webview, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    view.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    view.set_size(LogicalSize::new(width.max(1.0), height.max(1.0))).map_err(|e| e.to_string())
}

/// Shows the view named `label` at the given place in the main window, making
/// it first if there is none, and going to `url` when it is somewhere else.
#[tauri::command]
pub async fn browser_show(app: AppHandle, label: String, url: String, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    let target = web_address(&url)?;
    if let Some(view) = app.get_webview(&label) {
        place(&view, x, y, width, height)?;
        view.show().map_err(|e| e.to_string())?;
        if view.url().map(|now| now != target).unwrap_or(true) {
            view.navigate(target).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    let window = app.get_window("main").ok_or("no main window")?;
    let for_windows = app.clone();
    let for_loads = app.clone();
    let for_titles = app.clone();
    let name = label.clone();
    let builder = WebviewBuilder::new(&label, WebviewUrl::External(target))
        // A link or button that would open a new window opens here instead.
        .on_new_window(move |url, _features| {
            if let Some(view) = for_windows.get_webview(&name) {
                let _ = view.navigate(url);
            }
            NewWindowResponse::Deny
        })
        .on_page_load(move |view, payload| {
            if payload.event() == PageLoadEvent::Finished {
                let _ = for_loads.emit_to("main", "browser-visited", Visited { label: view.label().to_string(), url: payload.url().to_string() });
            }
        })
        .on_document_title_changed(move |view, title| {
            let _ = for_titles.emit_to("main", "browser-titled", Titled { label: view.label().to_string(), title });
        });
    window
        .add_child(builder, LogicalPosition::new(x, y), LogicalSize::new(width.max(1.0), height.max(1.0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Moves a view with its page, as the window or the split changes size.
#[tauri::command]
pub async fn browser_place(app: AppHandle, label: String, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    match app.get_webview(&label) {
        Some(view) => place(&view, x, y, width, height),
        None => Ok(()),
    }
}

/// Hides a view while its page is out of sight, or something must show over it, like a menu.
#[tauri::command]
pub async fn browser_hide(app: AppHandle, label: String) -> Result<(), String> {
    match app.get_webview(&label) {
        Some(view) => view.hide().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// Back, Forward and Reload, done by the page itself.
#[tauri::command]
pub async fn browser_step(app: AppHandle, label: String, step: String) -> Result<(), String> {
    let script = match step.as_str() {
        "back" => "history.back()",
        "forward" => "history.forward()",
        "reload" => "location.reload()",
        _ => return Err(format!("unknown step {step}")),
    };
    match app.get_webview(&label) {
        Some(view) => view.eval(script).map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// Closes a view for good, when its page is gone.
#[tauri::command]
pub async fn browser_close(app: AppHandle, label: String) -> Result<(), String> {
    match app.get_webview(&label) {
        Some(view) => view.close().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}
