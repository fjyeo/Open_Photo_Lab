// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri::Builder;

pub fn run() {
    Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
