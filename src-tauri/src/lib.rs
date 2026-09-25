pub mod browser;
pub mod commands;
pub mod system;
pub mod taskmanager;

use browser::manager::NativeTabManager;
use commands::browser::BrowserManagerState;
use commands::taskmanager::AppMetricsState;
use std::sync::Arc;
use system::metrics::MetricsCollector;

pub fn run() {
    let metrics = Arc::new(MetricsCollector::new());
    let tab_manager = Arc::new(NativeTabManager::new());

    tauri::Builder::default()
        .manage(AppMetricsState(metrics))
        .manage(BrowserManagerState(tab_manager))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::browser::browser_create_or_switch_tab,
            commands::browser::browser_hide_native_views,
            commands::browser::browser_close_tab,
            commands::browser::browser_navigate,
            commands::browser::browser_go_back,
            commands::browser::browser_go_forward,
            commands::browser::browser_reload,
            commands::browser::browser_update_bounds,
            commands::browser::open_devtools,
            commands::browser::set_window_title,
            commands::browser::close_app,
            commands::taskmanager::get_system_task_manager_stats,
            commands::taskmanager::terminate_process,
            commands::downloads::start_download,
            commands::downloads::open_download_folder,
            commands::logging::write_local_log,
            commands::logging::clear_local_logs,
            commands::settings::save_native_settings,
            commands::settings::load_native_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Freedom Browser");
}
