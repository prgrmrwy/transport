pub mod server;
pub mod transfer;

use tauri::async_runtime::spawn;
use transfer::throttle::Throttle;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|_app| {
            let throttle = Throttle::new(0); // 0 = unlimited
            spawn(server::start_server(8090, throttle));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
