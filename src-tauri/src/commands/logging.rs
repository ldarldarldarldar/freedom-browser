use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub category: String,
    pub message: String,
}

fn get_local_log_path() -> PathBuf {
    let mut config_dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    config_dir.push("freedom-browser");
    let _ = fs::create_dir_all(&config_dir);
    config_dir.push("diagnostic.log");
    config_dir
}

#[tauri::command]
pub async fn write_local_log(entry: LogEntry) -> Result<bool, String> {
    let log_path = get_local_log_path();
    let line = format!(
        "[{}] [{}] [{}] {}\n",
        entry.timestamp, entry.level, entry.category, entry.message
    );

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = file.write_all(line.as_bytes());
        Ok(true)
    } else {
        Err("Failed to open local diagnostic log file".to_string())
    }
}

#[tauri::command]
pub async fn clear_local_logs() -> Result<bool, String> {
    let log_path = get_local_log_path();
    if log_path.exists() {
        let _ = fs::remove_file(log_path);
    }
    Ok(true)
}
