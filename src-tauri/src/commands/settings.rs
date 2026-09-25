use std::fs;
use std::path::PathBuf;

fn get_settings_path() -> PathBuf {
    let mut config_dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    config_dir.push("freedom-browser");
    let _ = fs::create_dir_all(&config_dir);
    config_dir.push("settings.json");
    config_dir
}

#[tauri::command]
pub async fn save_native_settings(json_data: String) -> Result<bool, String> {
    let path = get_settings_path();
    fs::write(path, json_data).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn load_native_settings() -> Result<String, String> {
    let path = get_settings_path();
    if path.exists() {
        fs::read_to_string(path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}
