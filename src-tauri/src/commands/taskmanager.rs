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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanRamResultDto {
    pub reclaimed_mb: u64,
    pub reclaimed_bytes: u64,
    pub success: bool,
}

#[tauri::command]
pub async fn clean_system_ram(
    state: State<'_, AppMetricsState>,
) -> Result<CleanRamResultDto, String> {
    let (bytes, mb) = state.0.clean_ram();
    Ok(CleanRamResultDto {
        reclaimed_mb: mb,
        reclaimed_bytes: bytes,
        success: true,
    })
}
