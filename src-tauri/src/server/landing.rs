use axum::body::Body;
use axum::extract::Path;
use axum::http::{header, StatusCode};
use axum::response::{Html, Response};
use axum::Json;
use serde::Serialize;
use std::path::PathBuf;

const LANDING_HTML: &str = include_str!("../../assets/landing.html");

fn installers_dir() -> PathBuf {
    // Look for installers in ~/.transport/installers/
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".transport")
        .join("installers")
}

pub async fn landing_page() -> Html<&'static str> {
    Html(LANDING_HTML)
}

#[derive(Serialize)]
pub struct InstallerInfo {
    available: Vec<String>,
}

pub async fn list_installers() -> Json<InstallerInfo> {
    let dir = installers_dir();
    let mut available = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if (name.ends_with(".exe") || name.ends_with(".msi"))
                && !available.contains(&"windows".to_string())
            {
                available.push("windows".to_string());
            } else if name.ends_with(".dmg") && !available.contains(&"macos".to_string()) {
                available.push("macos".to_string());
            } else if name.ends_with(".apk") && !available.contains(&"android".to_string()) {
                available.push("android".to_string());
            }
        }
    }

    Json(InstallerInfo { available })
}

pub async fn download_installer(
    Path(platform): Path<String>,
) -> Result<Response, (StatusCode, String)> {
    let dir = installers_dir();
    let extensions: &[&str] = match platform.as_str() {
        "windows" => &["exe", "msi"],
        "macos" => &["dmg"],
        "android" => &["apk"],
        _ => return Err((StatusCode::BAD_REQUEST, "Invalid platform".to_string())),
    };

    let file_path = std::fs::read_dir(&dir)
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?
        .flatten()
        .find(|entry| {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            extensions.iter().any(|ext| name.ends_with(ext))
        })
        .map(|e| e.path())
        .ok_or((StatusCode::NOT_FOUND, "Installer not found".to_string()))?;

    let file = tokio::fs::File::open(&file_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let file_name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "installer".to_string());

    let stream = tokio_util::io::ReaderStream::new(file);
    let body = Body::from_stream(stream);

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file_name),
        )
        .body(body)
        .unwrap())
}
