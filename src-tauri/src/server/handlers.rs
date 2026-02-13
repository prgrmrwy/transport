use axum::body::Body;
use axum::extract::{Multipart, Query};
use axum::http::{header, StatusCode};
use axum::response::Response;
use axum::Json;
use serde::Serialize;
use tokio::io::AsyncWriteExt;
use tokio_util::io::ReaderStream;

// --- Device Info ---

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

// --- File Listing ---

#[derive(serde::Deserialize)]
pub struct FileListQuery {
    pub path: String,
}

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

pub async fn list_files(
    Query(query): Query<FileListQuery>,
) -> Result<Json<Vec<FileEntry>>, (StatusCode, String)> {
    let path = std::path::Path::new(&query.path);
    let mut entries = Vec::new();

    let mut read_dir = tokio::fs::read_dir(path)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    {
        let metadata = entry
            .metadata()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified,
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(Json(entries))
}

// --- File Download (streaming) ---

#[derive(serde::Deserialize)]
pub struct FilePathQuery {
    pub path: String,
}

pub async fn download_file(
    Query(query): Query<FilePathQuery>,
) -> Result<Response, (StatusCode, String)> {
    let path = std::path::Path::new(&query.path);

    if !path.is_file() {
        return Err((StatusCode::NOT_FOUND, "File not found".to_string()));
    }

    let file = tokio::fs::File::open(path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let metadata = file
        .metadata()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "download".to_string());

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CONTENT_LENGTH, metadata.len())
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file_name),
        )
        .body(body)
        .unwrap())
}

// --- File Upload (multipart) ---

pub async fn upload_file(
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mut target_dir = String::new();
    let mut files_saved: Vec<String> = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    {
        let field_name = field.name().unwrap_or("").to_string();

        if field_name == "path" {
            target_dir = field
                .text()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
            continue;
        }

        if field_name == "file" {
            let file_name = field.file_name().unwrap_or("unnamed").to_string();

            let dest = std::path::Path::new(&target_dir).join(&file_name);

            let mut file = tokio::fs::File::create(&dest)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let bytes = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

            file.write_all(&bytes)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            files_saved.push(file_name);
        }
    }

    Ok(Json(serde_json::json!({
        "saved": files_saved,
        "count": files_saved.len()
    })))
}

// --- File Operations: Delete, Rename, Mkdir ---

#[derive(serde::Deserialize)]
pub struct MkdirRequest {
    pub path: String,
}

#[derive(serde::Deserialize)]
pub struct RenameRequest {
    pub old_path: String,
    pub new_path: String,
}

pub async fn create_directory(
    Json(body): Json<MkdirRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    tokio::fs::create_dir_all(&body.path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(serde_json::json!({"ok": true})))
}

pub async fn rename_file(
    Json(body): Json<RenameRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    tokio::fs::rename(&body.old_path, &body.new_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(serde_json::json!({"ok": true})))
}

pub async fn delete_file(
    Query(query): Query<FilePathQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let path = std::path::Path::new(&query.path);
    if path.is_dir() {
        tokio::fs::remove_dir_all(path).await
    } else {
        tokio::fs::remove_file(path).await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(serde_json::json!({"ok": true})))
}

// --- Tests ---

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_list_files_returns_entries() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("test.txt"), "hello").unwrap();
        fs::create_dir(dir.path().join("subdir")).unwrap();

        let query = FileListQuery {
            path: dir.path().to_string_lossy().to_string(),
        };
        let Json(entries) = list_files(Query(query)).await.unwrap();

        assert_eq!(entries.len(), 2);
        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"test.txt"));
        assert!(names.contains(&"subdir"));
    }

    #[tokio::test]
    async fn test_list_files_invalid_path_returns_error() {
        let query = FileListQuery {
            path: "/nonexistent/path/xyz".to_string(),
        };
        let result = list_files(Query(query)).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_create_directory() {
        let dir = tempdir().unwrap();
        let new_dir = dir.path().join("new_folder");
        let body = MkdirRequest {
            path: new_dir.to_string_lossy().to_string(),
        };
        let result = create_directory(Json(body)).await;
        assert!(result.is_ok());
        assert!(new_dir.exists());
    }

    #[tokio::test]
    async fn test_rename_file() {
        let dir = tempdir().unwrap();
        let old = dir.path().join("old.txt");
        let new_path = dir.path().join("new.txt");
        fs::write(&old, "test").unwrap();

        let body = RenameRequest {
            old_path: old.to_string_lossy().to_string(),
            new_path: new_path.to_string_lossy().to_string(),
        };
        let result = rename_file(Json(body)).await;
        assert!(result.is_ok());
        assert!(!old.exists());
        assert!(new_path.exists());
    }

    #[tokio::test]
    async fn test_delete_file() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("to_delete.txt");
        fs::write(&file, "test").unwrap();

        let query = FilePathQuery {
            path: file.to_string_lossy().to_string(),
        };
        let result = delete_file(Query(query)).await;
        assert!(result.is_ok());
        assert!(!file.exists());
    }
}
