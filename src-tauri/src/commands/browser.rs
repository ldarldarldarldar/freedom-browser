use crate::browser::manager::{NativeTabManager, WebviewBounds};
use std::sync::Arc;
use tauri::{AppHandle, State, WebviewWindow, Window};

pub struct BrowserManagerState(pub Arc<NativeTabManager>);

#[tauri::command]
pub async fn browser_create_or_switch_tab(
    app: AppHandle,
    window: Window,
    state: State<'_, BrowserManagerState>,
    tab_id: String,
    url: String,
    bounds: WebviewBounds,
) -> Result<bool, String> {
    state.0.create_or_switch_tab(&app, &window, &tab_id, &url, bounds)
}

#[tauri::command]
pub async fn browser_hide_native_views(
    app: AppHandle,
    state: State<'_, BrowserManagerState>,
) -> Result<(), String> {
    state.0.hide_all_webviews(&app)
}

#[tauri::command]
pub async fn browser_close_tab(
    app: AppHandle,
    state: State<'_, BrowserManagerState>,
    tab_id: String,
) -> Result<bool, String> {
    state.0.close_tab(&app, &tab_id)
}

#[tauri::command]
pub async fn browser_navigate(
    app: AppHandle,
    state: State<'_, BrowserManagerState>,
    tab_id: String,
    url: String,
) -> Result<bool, String> {
    state.0.navigate_tab(&app, &tab_id, &url)
}

#[tauri::command]
pub async fn browser_go_back(
    app: AppHandle,
    state: State<'_, BrowserManagerState>,
    tab_id: String,
) -> Result<bool, String> {
    state.0.go_back(&app, &tab_id)
}

#[tauri::command]
pub async fn browser_go_forward(
    app: AppHandle,
    state: State<'_, BrowserManagerState>,
    tab_id: String,
) -> Result<bool, String> {
    state.0.go_forward(&app, &tab_id)
}

#[tauri::command]
pub async fn browser_reload(
    app: AppHandle,
    state: State<'_, BrowserManagerState>,
    tab_id: String,
) -> Result<bool, String> {
    state.0.reload(&app, &tab_id)
}

#[tauri::command]
pub async fn browser_update_bounds(
    app: AppHandle,
    state: State<'_, BrowserManagerState>,
    tab_id: String,
    bounds: WebviewBounds,
) -> Result<bool, String> {
    state.0.update_bounds(&app, &tab_id, bounds)
}

#[tauri::command]
pub async fn open_devtools(window: WebviewWindow) -> Result<bool, String> {
    window.open_devtools();
    Ok(true)
}

#[tauri::command]
pub async fn set_window_title(window: WebviewWindow, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}
