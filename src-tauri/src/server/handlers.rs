use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct DeviceInfo {
    pub name: String,
    pub platform: String,
    pub ip: String,
    pub port: u16,
}

pub async fn device_info() -> Json<DeviceInfo> {
    let ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    Json(DeviceInfo {
        name: hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string()),
        platform: std::env::consts::OS.to_string(),
        ip,
        port: 8090,
    })
}
