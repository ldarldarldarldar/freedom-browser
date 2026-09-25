use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    pub success: bool,
}

#[tauri::command]
pub async fn start_download(
    _app: AppHandle,
    url: String,
    suggested_filename: Option<String>,
) -> Result<DownloadResult, String> {
    let filename = suggested_filename.unwrap_or_else(|| {
        url.split('/')
            .last()
            .unwrap_or("downloaded_file")
            .split('?')
            .next()
            .unwrap_or("downloaded_file")
            .to_string()
    });

    let download_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));
    let target_path = download_dir.join(&filename);

    Ok(DownloadResult {
        id: format!("dl-{}", chrono::Utc::now().timestamp_millis()),
        filename,
        filepath: target_path.to_string_lossy().to_string(),
        success: true,
    })
}

#[tauri::command]
pub async fn open_download_folder() -> Result<bool, String> {
    let download_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(download_dir)
            .spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(download_dir)
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(download_dir)
            .spawn();
    }
    Ok(true)
}
