use crate::system::metrics::{MetricsCollector, TaskManagerSnapshotDto};
use crate::taskmanager::process_info::ProcessManager;
use std::sync::Arc;
use tauri::State;

pub struct AppMetricsState(pub Arc<MetricsCollector>);

#[tauri::command]
pub async fn get_system_task_manager_stats(
    state: State<'_, AppMetricsState>,
) -> Result<TaskManagerSnapshotDto, String> {
    let snapshot = state.0.collect_snapshot();
    Ok(snapshot)
}

#[tauri::command]
pub async fn terminate_process(pid: u32) -> Result<bool, String> {
    let success = ProcessManager::terminate_process(pid);
    Ok(success)
}
