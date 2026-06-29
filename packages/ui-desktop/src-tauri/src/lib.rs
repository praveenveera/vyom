use std::process::Child;
use std::sync::Mutex;
use tauri::State;

// ── State ─────────────────────────────────────────────────────────────────────

pub struct ServerProcess(pub Mutex<Option<Child>>);

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn start_server(state: State<ServerProcess>, bin_path: String) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("GarageBuild server is already running".to_string());
    }
    let child = std::process::Command::new(&bin_path)
        .spawn()
        .map_err(|e| format!("Failed to start server at {bin_path}: {e}"))?;
    *guard = Some(child);
    Ok(())
}

#[tauri::command]
pub fn stop_server(state: State<ServerProcess>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = guard.take() {
        child.kill().map_err(|e| format!("Failed to stop server: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_server_status(state: State<ServerProcess>) -> bool {
    let guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
    guard.is_some()
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ServerProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            start_server,
            stop_server,
            get_server_status
        ])
        .run(tauri::generate_context!())
        .expect("error running GarageBuild desktop application");
}
