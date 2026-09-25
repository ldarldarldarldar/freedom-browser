use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl, Window};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebviewBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTabInfo {
    pub id: String,
    pub url: String,
    pub webview_label: String,
    pub is_active: bool,
    pub is_suspended: bool,
}

pub struct NativeTabManager {
    tabs: Arc<Mutex<HashMap<String, NativeTabInfo>>>,
    active_tab_id: Arc<Mutex<Option<String>>>,
}

impl NativeTabManager {
    pub fn new() -> Self {
        Self {
            tabs: Arc::new(Mutex::new(HashMap::new())),
            active_tab_id: Arc::new(Mutex::new(None)),
        }
    }

    /// Creates a native child Webview attached to the main window or switches to an existing one.
    /// External websites (https://github.com, https://youtube.com, etc.) are rendered here as TOP-LEVEL
    /// WebKitGTK / WebView2 pages, completely independent of iframes.
    pub fn create_or_switch_tab(
        &self,
        app: &AppHandle,
        window: &Window,
        tab_id: &str,
        url: &str,
        bounds: WebviewBounds,
    ) -> Result<bool, String> {
        let label = format!("tab-webview-{}", tab_id.replace('-', "_"));
        let mut tabs = self.tabs.lock().map_err(|e| e.to_string())?;

        // 1. Hide any currently active webviews first
        for (existing_id, info) in tabs.iter_mut() {
            if existing_id != tab_id {
                info.is_active = false;
                if let Some(existing_wv) = app.get_webview(&info.webview_label) {
                    let _ = existing_wv.hide();
                }
            }
        }

        // 2. Check if this webview already exists
        if let Some(existing_wv) = app.get_webview(&label) {
            // Update position and size
            let _ = existing_wv.set_position(LogicalPosition::new(bounds.x, bounds.y));
            let _ = existing_wv.set_size(LogicalSize::new(bounds.width, bounds.height));

            // Navigate if URL changed
            if let Ok(parsed_url) = url.parse() {
                let _ = existing_wv.navigate(parsed_url);
            }

            let _ = existing_wv.show();

            if let Some(info) = tabs.get_mut(tab_id) {
                info.url = url.to_string();
                info.is_active = true;
                info.is_suspended = false;
            }
        } else {
            // 3. Create a brand new native child Webview attached to the window
            let parsed_url: url::Url = url
                .parse()
                .map_err(|e: url::ParseError| format!("Invalid URL '{}': {}", url, e))?;

            let webview_builder = WebviewBuilder::new(&label, WebviewUrl::External(parsed_url))
                .auto_resize();

            let position = LogicalPosition::new(bounds.x, bounds.y);
            let size = LogicalSize::new(bounds.width, bounds.height);

            let new_wv = window
                .add_child(webview_builder, position, size)
                .map_err(|e| format!("Failed to create native child webview: {}", e))?;

            let _ = new_wv.show();

            tabs.insert(
                tab_id.to_string(),
                NativeTabInfo {
                    id: tab_id.to_string(),
                    url: url.to_string(),
                    webview_label: label,
                    is_active: true,
                    is_suspended: false,
                },
            );
        }

        let mut active = self.active_tab_id.lock().map_err(|e| e.to_string())?;
        *active = Some(tab_id.to_string());

        Ok(true)
    }

    /// Hides all native webviews (used when showing freedom://newtab, settings, or task manager)
    pub fn hide_all_webviews(&self, app: &AppHandle) -> Result<(), String> {
        let tabs = self.tabs.lock().map_err(|e| e.to_string())?;
        for info in tabs.values() {
            if let Some(wv) = app.get_webview(&info.webview_label) {
                let _ = wv.hide();
            }
        }
        let mut active = self.active_tab_id.lock().map_err(|e| e.to_string())?;
        *active = None;
        Ok(())
    }

    /// Closes and destroys the native webview associated with a tab
    pub fn close_tab(&self, app: &AppHandle, tab_id: &str) -> Result<bool, String> {
        let mut tabs = self.tabs.lock().map_err(|e| e.to_string())?;
        if let Some(info) = tabs.remove(tab_id) {
            if let Some(wv) = app.get_webview(&info.webview_label) {
                let _ = wv.close();
            }
            return Ok(true);
        }
        Ok(false)
    }

    /// Navigates the active native webview to a new URL
    pub fn navigate_tab(&self, app: &AppHandle, tab_id: &str, url: &str) -> Result<bool, String> {
        let tabs = self.tabs.lock().map_err(|e| e.to_string())?;
        if let Some(info) = tabs.get(tab_id) {
            if let Some(wv) = app.get_webview(&info.webview_label) {
                let parsed_url: url::Url = url
                    .parse()
                    .map_err(|e: url::ParseError| format!("Invalid URL '{}': {}", url, e))?;
                let _ = wv.navigate(parsed_url);
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Executes window.history.back() in the native webview
    pub fn go_back(&self, app: &AppHandle, tab_id: &str) -> Result<bool, String> {
        let tabs = self.tabs.lock().map_err(|e| e.to_string())?;
        if let Some(info) = tabs.get(tab_id) {
            if let Some(wv) = app.get_webview(&info.webview_label) {
                let _ = wv.eval("window.history.back();");
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Executes window.history.forward() in the native webview
    pub fn go_forward(&self, app: &AppHandle, tab_id: &str) -> Result<bool, String> {
        let tabs = self.tabs.lock().map_err(|e| e.to_string())?;
        if let Some(info) = tabs.get(tab_id) {
            if let Some(wv) = app.get_webview(&info.webview_label) {
                let _ = wv.eval("window.history.forward();");
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Executes window.location.reload() in the native webview
    pub fn reload(&self, app: &AppHandle, tab_id: &str) -> Result<bool, String> {
        let tabs = self.tabs.lock().map_err(|e| e.to_string())?;
        if let Some(info) = tabs.get(tab_id) {
            if let Some(wv) = app.get_webview(&info.webview_label) {
                let _ = wv.eval("window.location.reload();");
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Updates bounds for active webviews during window resize
    pub fn update_bounds(&self, app: &AppHandle, tab_id: &str, bounds: WebviewBounds) -> Result<bool, String> {
        let tabs = self.tabs.lock().map_err(|e| e.to_string())?;
        if let Some(info) = tabs.get(tab_id) {
            if let Some(wv) = app.get_webview(&info.webview_label) {
                let _ = wv.set_position(LogicalPosition::new(bounds.x, bounds.y));
                let _ = wv.set_size(LogicalSize::new(bounds.width, bounds.height));
                return Ok(true);
            }
        }
        Ok(false)
    }
}
