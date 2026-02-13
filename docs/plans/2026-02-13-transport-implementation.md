# Transport 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个 Tauri 2 + React 跨平台内网文件传输与管理应用，支持 Win11 / macOS / Android。

**Architecture:** P2P 模式，每台设备运行 axum HTTP 服务端 + React 前端客户端。通过 mDNS 自动发现局域网设备，HTTP REST API 实现文件操作，流式传输大文件并支持令牌桶限速。

**Tech Stack:** Tauri 2, React 18, TypeScript, Vite, TailwindCSS, Zustand, axum, tokio, mdns-sd, serde

---

## Phase 1: 项目脚手架

### Task 1: 创建 Tauri 2 + React + Vite 项目

**Files:**
- Create: 整个项目骨架

**Step 1: 用 create-tauri-app 脚手架创建项目**

```bash
cd /mnt/d/apps/transport
pnpm create tauri-app . --template react-ts --manager pnpm
```

交互选择：
- Project name: `transport`
- Identifier: `com.transport.app`
- Frontend: TypeScript / JavaScript (pnpm)
- UI template: React
- UI flavor: TypeScript

**Step 2: 验证脚手架生成正确**

```bash
ls src/           # 应包含 App.tsx, main.tsx 等
ls src-tauri/     # 应包含 src/, Cargo.toml, tauri.conf.json
```

**Step 3: 安装依赖并验证能运行**

```bash
pnpm install
pnpm tauri dev
```

Expected: 窗口弹出显示 Tauri 默认欢迎页面。关闭窗口。

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: scaffold Tauri 2 + React + Vite project"
```

---

### Task 2: 添加前端依赖（TailwindCSS + Zustand + React Router）

**Files:**
- Modify: `package.json`
- Modify: `src/index.css`
- Modify: `vite.config.ts`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Step 1: 安装前端依赖**

```bash
pnpm add react-router zustand
pnpm add -D tailwindcss @tailwindcss/vite
```

**Step 2: 配置 TailwindCSS**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { usePolling: true },
  },
});
```

`src/index.css`:
```css
@import "tailwindcss";
```

**Step 3: 设置 React Router 基本路由**

`src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from "react-router";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

`src/pages/HomePage.tsx`:
```tsx
export default function HomePage() {
  return <div className="p-4 text-white">Transport Home</div>;
}
```

`src/pages/SettingsPage.tsx`:
```tsx
export default function SettingsPage() {
  return <div className="p-4 text-white">Settings</div>;
}
```

`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 4: 验证 TailwindCSS 和路由工作**

```bash
pnpm tauri dev
```

Expected: 看到 "Transport Home" 文字带有白色样式和 padding。

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add TailwindCSS, Zustand, React Router"
```

---

## Phase 2: Rust HTTP 服务端

### Task 3: axum HTTP 服务骨架

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/server/mod.rs`
- Create: `src-tauri/src/server/routes.rs`
- Create: `src-tauri/src/server/handlers.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 添加 Rust 依赖**

`src-tauri/Cargo.toml` 在 `[dependencies]` 下添加:
```toml
axum = "0.8"
tokio = { version = "1", features = ["full"] }
tower-http = { version = "0.6", features = ["cors"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
local-ip-address = "0.6"
```

**Step 2: 创建 axum 服务模块**

`src-tauri/src/server/mod.rs`:
```rust
pub mod routes;
pub mod handlers;

use std::net::SocketAddr;
use axum::Router;
use tower_http::cors::CorsLayer;

pub async fn start_server(port: u16) {
    let app = Router::new()
        .nest("/api", routes::api_routes())
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Transport server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

`src-tauri/src/server/routes.rs`:
```rust
use axum::{routing::get, Router};
use super::handlers;

pub fn api_routes() -> Router {
    Router::new()
        .route("/device/info", get(handlers::device_info))
}
```

`src-tauri/src/server/handlers.rs`:
```rust
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
```

**Step 3: 在 lib.rs 中注册 server 模块并启动**

`src-tauri/src/lib.rs`:
```rust
mod server;

use tauri::async_runtime::spawn;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            spawn(server::start_server(8090));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`src-tauri/Cargo.toml` 还需要添加 `hostname`:
```toml
hostname = "0.4"
```

**Step 4: 编译验证**

```bash
cd /mnt/d/apps/transport && pnpm tauri dev
```

在另一个终端验证:
```bash
curl http://localhost:8090/api/device/info
```

Expected: 返回 JSON `{"name":"...","platform":"linux","ip":"...","port":8090}`

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add axum HTTP server with device info endpoint"
```

---

### Task 4: 文件列表 API

**Files:**
- Modify: `src-tauri/src/server/handlers.rs`
- Modify: `src-tauri/src/server/routes.rs`

**Step 1: 写文件列表处理器的测试**

在 `src-tauri/src/server/handlers.rs` 底部:
```rust
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

        let query = FileListQuery { path: dir.path().to_string_lossy().to_string() };
        let Json(entries) = list_files(axum::extract::Query(query)).await.unwrap();

        assert_eq!(entries.len(), 2);
        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"test.txt"));
        assert!(names.contains(&"subdir"));
    }

    #[tokio::test]
    async fn test_list_files_invalid_path_returns_error() {
        let query = FileListQuery { path: "/nonexistent/path/xyz".to_string() };
        let result = list_files(axum::extract::Query(query)).await;
        assert!(result.is_err());
    }
}
```

`Cargo.toml` 添加 dev-dependency:
```toml
[dev-dependencies]
tempfile = "3"
```

**Step 2: 运行测试，验证失败**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo test
```

Expected: 编译错误，`FileListQuery` 和 `list_files` 未定义。

**Step 3: 实现文件列表 handler**

`src-tauri/src/server/handlers.rs` 添加:
```rust
use axum::extract::Query;
use std::path::Path;

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
) -> Result<Json<Vec<FileEntry>>, (axum::http::StatusCode, String)> {
    let path = Path::new(&query.path);
    let mut entries = Vec::new();

    let mut read_dir = tokio::fs::read_dir(path)
        .await
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    while let Some(entry) = read_dir.next_entry().await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))? {
        let metadata = entry.metadata().await
            .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let modified = metadata.modified()
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
        b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(Json(entries))
}
```

**Step 4: 注册路由**

`src-tauri/src/server/routes.rs`:
```rust
use axum::{routing::{get, delete, put, post}, Router};
use super::handlers;

pub fn api_routes() -> Router {
    Router::new()
        .route("/device/info", get(handlers::device_info))
        .route("/files", get(handlers::list_files))
}
```

**Step 5: 运行测试**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo test
```

Expected: 全部通过。

**Step 6: 提交**

```bash
git add -A
git commit -m "feat: add file listing API endpoint"
```

---

### Task 5: 文件下载 API（流式）

**Files:**
- Modify: `src-tauri/src/server/handlers.rs`
- Modify: `src-tauri/src/server/routes.rs`

**Step 1: 实现流式文件下载 handler**

`src-tauri/src/server/handlers.rs` 添加:
```rust
use axum::body::Body;
use axum::response::{Response, IntoResponse};
use axum::http::{header, StatusCode};
use tokio_util::io::ReaderStream;

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

    let metadata = file.metadata().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let file_name = path.file_name()
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
```

`Cargo.toml` 添加:
```toml
tokio-util = { version = "0.7", features = ["io"] }
```

**Step 2: 注册路由**

`routes.rs` 添加:
```rust
.route("/files/download", get(handlers::download_file))
```

**Step 3: 编译验证**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo build
```

**Step 4: 手动测试**

启动应用后，用 curl 下载一个已知文件:
```bash
curl -o /tmp/test_download.txt "http://localhost:8090/api/files/download?path=/tmp/some_test_file.txt"
diff /tmp/some_test_file.txt /tmp/test_download.txt
```

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add streaming file download endpoint"
```

---

### Task 6: 文件上传 API（multipart 流式）

**Files:**
- Modify: `src-tauri/src/server/handlers.rs`
- Modify: `src-tauri/src/server/routes.rs`
- Modify: `src-tauri/Cargo.toml`

**Step 1: 添加 multipart 依赖**

`Cargo.toml`:
```toml
axum = { version = "0.8", features = ["multipart"] }
```

**Step 2: 实现上传 handler**

`src-tauri/src/server/handlers.rs` 添加:
```rust
use axum::extract::Multipart;
use tokio::io::AsyncWriteExt;

pub async fn upload_file(
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mut target_dir = String::new();
    let mut files_saved: Vec<String> = Vec::new();

    while let Some(field) = multipart.next_field().await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? {

        let field_name = field.name().unwrap_or("").to_string();

        if field_name == "path" {
            target_dir = field.text().await
                .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
            continue;
        }

        if field_name == "file" {
            let file_name = field.file_name()
                .unwrap_or("unnamed")
                .to_string();

            let dest = std::path::Path::new(&target_dir).join(&file_name);

            let mut file = tokio::fs::File::create(&dest)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let bytes = field.bytes().await
                .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

            file.write_all(&bytes).await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            files_saved.push(file_name);
        }
    }

    Ok(Json(serde_json::json!({
        "saved": files_saved,
        "count": files_saved.len()
    })))
}
```

> 注意：上面的实现将整个文件读入内存再写入。对于超大文件（>几GB），后续 Task 9 的限速器会改为真正的流式写入。MVP 阶段先用这个简单实现。

**Step 3: 注册路由**

`routes.rs` 添加:
```rust
.route("/files/upload", post(handlers::upload_file))
```

**Step 4: 编译并手动测试**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo build
```

启动后测试:
```bash
curl -X POST http://localhost:8090/api/files/upload \
  -F "path=/tmp" \
  -F "file=@/tmp/some_test_file.txt"
```

Expected: `{"saved":["some_test_file.txt"],"count":1}`

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add multipart file upload endpoint"
```

---

### Task 7: 文件操作 API（删除 / 重命名 / 新建文件夹）

**Files:**
- Modify: `src-tauri/src/server/handlers.rs`
- Modify: `src-tauri/src/server/routes.rs`

**Step 1: 写测试**

`handlers.rs` 的 `tests` 模块添加:
```rust
#[tokio::test]
async fn test_create_directory() {
    let dir = tempdir().unwrap();
    let new_dir = dir.path().join("new_folder");
    let body = MkdirRequest { path: new_dir.to_string_lossy().to_string() };
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

    let query = FilePathQuery { path: file.to_string_lossy().to_string() };
    let result = delete_file(axum::extract::Query(query)).await;
    assert!(result.is_ok());
    assert!(!file.exists());
}
```

**Step 2: 运行测试，验证失败**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo test
```

**Step 3: 实现 handlers**

```rust
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
```

**Step 4: 注册路由**

```rust
pub fn api_routes() -> Router {
    Router::new()
        .route("/device/info", get(handlers::device_info))
        .route("/files", get(handlers::list_files).delete(handlers::delete_file))
        .route("/files/download", get(handlers::download_file))
        .route("/files/upload", post(handlers::upload_file))
        .route("/files/rename", put(handlers::rename_file))
        .route("/files/mkdir", post(handlers::create_directory))
}
```

**Step 5: 运行测试**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo test
```

Expected: 全部通过。

**Step 6: 提交**

```bash
git add -A
git commit -m "feat: add delete, rename, mkdir file operation endpoints"
```

---

### Task 8: 带宽限速器

**Files:**
- Create: `src-tauri/src/transfer/mod.rs`
- Create: `src-tauri/src/transfer/throttle.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 写限速器测试**

`src-tauri/src/transfer/throttle.rs`:
```rust
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Instant, Duration, sleep};

pub struct Throttle {
    bytes_per_sec: Arc<Mutex<u64>>,
    tokens: Arc<Mutex<f64>>,
    last_refill: Arc<Mutex<Instant>>,
}

impl Throttle {
    pub fn new(bytes_per_sec: u64) -> Self {
        Self {
            bytes_per_sec: Arc::new(Mutex::new(bytes_per_sec)),
            tokens: Arc::new(Mutex::new(bytes_per_sec as f64)),
            last_refill: Arc::new(Mutex::new(Instant::now())),
        }
    }

    /// 0 means unlimited
    pub async fn set_rate(&self, bytes_per_sec: u64) {
        *self.bytes_per_sec.lock().await = bytes_per_sec;
    }

    pub async fn consume(&self, bytes: usize) {
        let rate = *self.bytes_per_sec.lock().await;
        if rate == 0 {
            return; // unlimited
        }

        loop {
            {
                let mut tokens = self.tokens.lock().await;
                let mut last = self.last_refill.lock().await;
                let now = Instant::now();
                let elapsed = now.duration_since(*last).as_secs_f64();
                *tokens += elapsed * rate as f64;
                if *tokens > rate as f64 {
                    *tokens = rate as f64;
                }
                *last = now;

                if *tokens >= bytes as f64 {
                    *tokens -= bytes as f64;
                    return;
                }
            }
            sleep(Duration::from_millis(10)).await;
        }
    }
}

impl Clone for Throttle {
    fn clone(&self) -> Self {
        Self {
            bytes_per_sec: self.bytes_per_sec.clone(),
            tokens: self.tokens.clone(),
            last_refill: self.last_refill.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_throttle_unlimited() {
        let throttle = Throttle::new(0);
        let start = Instant::now();
        throttle.consume(1_000_000).await;
        assert!(start.elapsed() < Duration::from_millis(50));
    }

    #[tokio::test]
    async fn test_throttle_limits_rate() {
        let throttle = Throttle::new(1000); // 1000 bytes/sec
        throttle.consume(1000).await; // exhaust initial tokens
        let start = Instant::now();
        throttle.consume(500).await; // should wait ~500ms
        let elapsed = start.elapsed();
        assert!(elapsed >= Duration::from_millis(400));
        assert!(elapsed <= Duration::from_millis(700));
    }
}
```

`src-tauri/src/transfer/mod.rs`:
```rust
pub mod throttle;
```

**Step 2: 运行测试**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo test transfer
```

Expected: 全部通过。

**Step 3: 在 lib.rs 注册模块**

```rust
mod server;
mod transfer;
```

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: add token bucket bandwidth throttle"
```

---

### Task 9: 将限速器集成到下载/上传流

**Files:**
- Modify: `src-tauri/src/server/mod.rs`
- Modify: `src-tauri/src/server/handlers.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 将 Throttle 注入 axum 状态**

`src-tauri/src/server/mod.rs`:
```rust
pub mod routes;
pub mod handlers;

use std::net::SocketAddr;
use axum::Router;
use tower_http::cors::CorsLayer;
use crate::transfer::throttle::Throttle;

pub async fn start_server(port: u16, throttle: Throttle) {
    let app = Router::new()
        .nest("/api", routes::api_routes())
        .layer(CorsLayer::permissive())
        .with_state(AppState { throttle });

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Transport server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[derive(Clone)]
pub struct AppState {
    pub throttle: Throttle,
}
```

**Step 2: 更新路由使用 State**

`routes.rs` 的 `api_routes` 返回值改为 `Router<AppState>` 并在无需 state 的 handler 上保持不变。

`handlers.rs` 下载 handler 改为:
```rust
use axum::extract::State;
use crate::server::AppState;

pub async fn download_file(
    State(state): State<AppState>,
    Query(query): Query<FilePathQuery>,
) -> Result<Response, (StatusCode, String)> {
    // ... 打开文件同之前 ...

    // 包装限速流
    let file = tokio::fs::File::open(path).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let throttle = state.throttle.clone();

    let stream = async_stream::stream! {
        let mut reader = tokio::io::BufReader::new(file);
        let mut buf = vec![0u8; 64 * 1024]; // 64KB chunks
        loop {
            use tokio::io::AsyncReadExt;
            let n = reader.read(&mut buf).await.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            if n == 0 { break; }
            throttle.consume(n).await;
            yield Ok::<_, std::io::Error>(bytes::Bytes::copy_from_slice(&buf[..n]));
        }
    };

    let body = Body::from_stream(stream);
    // ... 构造 response 同之前 ...
}
```

`Cargo.toml` 添加:
```toml
async-stream = "0.3"
bytes = "1"
```

**Step 3: 更新 lib.rs 传入 throttle**

```rust
use transfer::throttle::Throttle;

// 在 setup 中:
let throttle = Throttle::new(0); // 0 = unlimited by default
spawn(server::start_server(8090, throttle));
```

**Step 4: 编译验证**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo build
```

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: integrate bandwidth throttle into download stream"
```

---

### Task 10: mDNS 设备发现

**Files:**
- Create: `src-tauri/src/discovery/mod.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 添加依赖**

```toml
mdns-sd = "0.11"
```

**Step 2: 实现 mDNS 模块**

`src-tauri/src/discovery/mod.rs`:
```rust
use mdns_sd::{ServiceDaemon, ServiceInfo, ServiceEvent};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;

const SERVICE_TYPE: &str = "_transport._tcp.local.";

#[derive(Clone, Serialize, Debug)]
pub struct DiscoveredDevice {
    pub name: String,
    pub ip: String,
    pub port: u16,
    pub platform: String,
}

pub struct Discovery {
    daemon: ServiceDaemon,
    pub devices: Arc<Mutex<Vec<DiscoveredDevice>>>,
}

impl Discovery {
    pub fn new() -> Self {
        Self {
            daemon: ServiceDaemon::new().expect("Failed to create mDNS daemon"),
            devices: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn register(&self, device_name: &str, port: u16, platform: &str) {
        let ip = local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "0.0.0.0".to_string());

        let host = format!("{}.local.", device_name.replace(' ', "-"));
        let service_name = format!("{}._transport._tcp.local.", device_name.replace(' ', "-"));

        let mut properties = std::collections::HashMap::new();
        properties.insert("platform".to_string(), platform.to_string());

        let service = ServiceInfo::new(
            SERVICE_TYPE,
            &device_name.replace(' ', "-"),
            &host,
            &ip,
            port,
            Some(properties),
        ).expect("Failed to create service info");

        self.daemon.register(service).expect("Failed to register mDNS service");
    }

    pub async fn browse(&self) {
        let receiver = self.daemon.browse(SERVICE_TYPE).expect("Failed to browse");
        let devices = self.devices.clone();

        tokio::spawn(async move {
            loop {
                match receiver.recv() {
                    Ok(event) => match event {
                        ServiceEvent::ServiceResolved(info) => {
                            let device = DiscoveredDevice {
                                name: info.get_fullname()
                                    .split('.')
                                    .next()
                                    .unwrap_or("unknown")
                                    .replace('-', " ")
                                    .to_string(),
                                ip: info.get_addresses()
                                    .iter()
                                    .next()
                                    .map(|a| a.to_string())
                                    .unwrap_or_default(),
                                port: info.get_port(),
                                platform: info.get_properties()
                                    .get("platform")
                                    .map(|v| v.val_str().to_string())
                                    .unwrap_or_default(),
                            };

                            let mut devs = devices.lock().await;
                            if !devs.iter().any(|d| d.ip == device.ip) {
                                devs.push(device);
                            }
                        }
                        ServiceEvent::ServiceRemoved(_, name) => {
                            let mut devs = devices.lock().await;
                            devs.retain(|d| !name.contains(&d.name.replace(' ', "-")));
                        }
                        _ => {}
                    },
                    Err(_) => break,
                }
            }
        });
    }
}
```

**Step 3: 在 lib.rs 中启动 mDNS**

```rust
mod discovery;

// 在 setup 中:
let discovery = discovery::Discovery::new();
let device_name = hostname::get()
    .map(|h| h.to_string_lossy().to_string())
    .unwrap_or_else(|_| "Transport Device".to_string());
discovery.register(&device_name, 8090, std::env::consts::OS);

let discovery_clone = discovery.devices.clone();
spawn(async move { discovery.browse().await });

app.manage(discovery_clone); // Arc<Mutex<Vec<DiscoveredDevice>>> 供 IPC 使用
```

**Step 4: 编译验证**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo build
```

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add mDNS device discovery"
```

---

### Task 11: 应用分发落地页

**Files:**
- Create: `src-tauri/src/server/landing.rs`
- Create: `src-tauri/assets/landing.html`
- Modify: `src-tauri/src/server/mod.rs`
- Modify: `src-tauri/src/server/routes.rs`

**Step 1: 创建落地页 HTML**

`src-tauri/assets/landing.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transport - 下载</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0f172a; color: #e2e8f0; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; }
  .container { text-align: center; max-width: 480px; padding: 2rem; }
  h1 { font-size: 2rem; margin-bottom: 0.5rem; }
  .subtitle { color: #94a3b8; margin-bottom: 2rem; }
  .detected { background: #1e293b; border-radius: 12px; padding: 1.5rem;
    margin-bottom: 1.5rem; }
  .detected p { color: #94a3b8; font-size: 0.875rem; margin-bottom: 0.75rem; }
  .btn { display: inline-block; padding: 0.75rem 2rem; border-radius: 8px;
    text-decoration: none; font-weight: 600; font-size: 1rem;
    background: #3b82f6; color: white; transition: background 0.2s; }
  .btn:hover { background: #2563eb; }
  .others { margin-top: 1.5rem; }
  .others a { color: #60a5fa; text-decoration: none; margin: 0 0.75rem;
    font-size: 0.875rem; }
  .others a:hover { text-decoration: underline; }
  .hidden { display: none; }
</style>
</head>
<body>
<div class="container">
  <h1>Transport</h1>
  <p class="subtitle">家庭内网高速文件传输工具</p>
  <div class="detected">
    <p>检测到你正在使用 <strong id="platform">未知平台</strong></p>
    <a id="main-btn" class="btn hidden" href="#">下载</a>
    <p id="no-installer" class="hidden" style="color:#f87171;">该平台暂无可用安装包</p>
  </div>
  <div class="others">
    <span style="color:#64748b;font-size:0.875rem;">其他平台：</span>
    <a id="link-windows" class="hidden" href="/download/windows">Windows (.exe)</a>
    <a id="link-macos" class="hidden" href="/download/macos">macOS (.dmg)</a>
    <a id="link-android" class="hidden" href="/download/android">Android (.apk)</a>
  </div>
</div>
<script>
  const ua = navigator.userAgent.toLowerCase();
  const platformEl = document.getElementById('platform');
  const mainBtn = document.getElementById('main-btn');
  let detected = 'unknown';

  if (ua.includes('android')) detected = 'android';
  else if (ua.includes('mac')) detected = 'macos';
  else if (ua.includes('win')) detected = 'windows';

  const labels = { windows: 'Windows', macos: 'macOS', android: 'Android' };
  platformEl.textContent = labels[detected] || '未知平台';

  fetch('/api/installers').then(r => r.json()).then(data => {
    const available = data.available || [];
    // Show main download button
    if (available.includes(detected)) {
      mainBtn.href = '/download/' + detected;
      mainBtn.textContent = '下载 ' + labels[detected] + ' 版';
      mainBtn.classList.remove('hidden');
    } else {
      document.getElementById('no-installer').classList.remove('hidden');
    }
    // Show other platform links
    ['windows', 'macos', 'android'].forEach(p => {
      if (p !== detected && available.includes(p)) {
        document.getElementById('link-' + p).classList.remove('hidden');
      }
    });
  });
</script>
</body>
</html>
```

**Step 2: 实现落地页 handler**

`src-tauri/src/server/landing.rs`:
```rust
use axum::response::Html;
use axum::Json;
use serde::Serialize;
use std::path::PathBuf;

const LANDING_HTML: &str = include_str!("../../assets/landing.html");

fn installers_dir() -> PathBuf {
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
            if name.ends_with(".exe") || name.ends_with(".msi") {
                if !available.contains(&"windows".to_string()) { available.push("windows".to_string()); }
            } else if name.ends_with(".dmg") {
                if !available.contains(&"macos".to_string()) { available.push("macos".to_string()); }
            } else if name.ends_with(".apk") {
                if !available.contains(&"android".to_string()) { available.push("android".to_string()); }
            }
        }
    }

    Json(InstallerInfo { available })
}

pub async fn download_installer(
    axum::extract::Path(platform): axum::extract::Path<String>,
) -> Result<axum::response::Response, (axum::http::StatusCode, String)> {
    let dir = installers_dir();
    let ext = match platform.as_str() {
        "windows" => vec!["exe", "msi"],
        "macos" => vec!["dmg"],
        "android" => vec!["apk"],
        _ => return Err((axum::http::StatusCode::BAD_REQUEST, "Invalid platform".to_string())),
    };

    let file_path = std::fs::read_dir(&dir)
        .map_err(|e| (axum::http::StatusCode::NOT_FOUND, e.to_string()))?
        .flatten()
        .find(|entry| {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            ext.iter().any(|e| name.ends_with(e))
        })
        .map(|e| e.path())
        .ok_or((axum::http::StatusCode::NOT_FOUND, "Installer not found".to_string()))?;

    let file = tokio::fs::File::open(&file_path).await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let file_name = file_path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or("installer".to_string());

    let stream = tokio_util::io::ReaderStream::new(file);
    let body = axum::body::Body::from_stream(stream);

    Ok(axum::response::Response::builder()
        .header("content-type", "application/octet-stream")
        .header("content-disposition", format!("attachment; filename=\"{}\"", file_name))
        .body(body)
        .unwrap())
}
```

`Cargo.toml` 添加:
```toml
dirs = "6"
```

**Step 3: 注册路由**

在 `server/mod.rs` 的 Router 中，落地页路由放在 `/api` 之外:
```rust
use super::server::landing;

let app = Router::new()
    .route("/", get(landing::landing_page))
    .route("/download/{platform}", get(landing::download_installer))
    .nest("/api", routes::api_routes()
        .route("/installers", get(landing::list_installers)))
    .layer(CorsLayer::permissive())
    .with_state(AppState { throttle });
```

**Step 4: 编译验证**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo build
```

启动后浏览器打开 `http://localhost:8090/` 应看到落地页。

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add app distribution landing page"
```

---

## Phase 3: Tauri IPC 桥接

### Task 12: Tauri IPC 命令

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 实现 IPC 命令**

`src-tauri/src/commands.rs`:
```rust
use crate::discovery::DiscoveredDevice;
use crate::transfer::throttle::Throttle;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn get_devices(
    devices: State<'_, Arc<Mutex<Vec<DiscoveredDevice>>>>,
) -> Result<Vec<DiscoveredDevice>, String> {
    Ok(devices.lock().await.clone())
}

#[tauri::command]
pub async fn get_local_device_info() -> Result<serde_json::Value, String> {
    let ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let name = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "Transport Device".to_string());

    Ok(serde_json::json!({
        "name": name,
        "platform": std::env::consts::OS,
        "ip": ip,
        "port": 8090
    }))
}

#[tauri::command]
pub async fn set_throttle_rate(
    throttle: State<'_, Throttle>,
    bytes_per_sec: u64,
) -> Result<(), String> {
    throttle.set_rate(bytes_per_sec).await;
    Ok(())
}
```

**Step 2: 在 lib.rs 注册命令**

```rust
mod commands;

// Builder 中:
.invoke_handler(tauri::generate_handler![
    commands::get_devices,
    commands::get_local_device_info,
    commands::set_throttle_rate,
])
```

同时需要将 `Throttle` 也 manage:
```rust
let throttle = Throttle::new(0);
app.manage(throttle.clone());
spawn(server::start_server(8090, throttle));
```

**Step 3: 编译验证**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo build
```

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: add Tauri IPC commands for devices, device info, throttle"
```

---

## Phase 4: 前端状态与服务

### Task 13: Zustand 状态管理

**Files:**
- Create: `src/stores/deviceStore.ts`
- Create: `src/stores/transferStore.ts`
- Create: `src/types.ts`

**Step 1: 定义类型**

`src/types.ts`:
```ts
export interface Device {
  name: string;
  ip: string;
  port: number;
  platform: string;
}

export interface FileEntry {
  name: string;
  is_dir: boolean;
  size: number;
  modified: number;
}

export type TransferStatus = "queued" | "transferring" | "completed" | "failed" | "cancelled";
export type TransferDirection = "upload" | "download";

export interface TransferTask {
  id: string;
  fileName: string;
  fileSize: number;
  direction: TransferDirection;
  status: TransferStatus;
  progress: number; // 0-100
  speed: number; // bytes/sec
  sourceDevice: string;
  targetDevice: string;
}
```

**Step 2: 设备 store**

`src/stores/deviceStore.ts`:
```ts
import { create } from "zustand";
import { Device } from "../types";

interface DeviceStore {
  devices: Device[];
  localDevice: Device | null;
  selectedDevice: Device | null;
  setDevices: (devices: Device[]) => void;
  setLocalDevice: (device: Device) => void;
  selectDevice: (device: Device | null) => void;
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  devices: [],
  localDevice: null,
  selectedDevice: null,
  setDevices: (devices) => set({ devices }),
  setLocalDevice: (device) => set({ localDevice: device }),
  selectDevice: (device) => set({ selectedDevice: device }),
}));
```

**Step 3: 传输队列 store**

`src/stores/transferStore.ts`:
```ts
import { create } from "zustand";
import { TransferTask } from "../types";

interface TransferStore {
  tasks: TransferTask[];
  addTask: (task: TransferTask) => void;
  updateTask: (id: string, updates: Partial<TransferTask>) => void;
  removeTask: (id: string) => void;
}

export const useTransferStore = create<TransferStore>((set) => ({
  tasks: [],
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
}));
```

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: add Zustand stores for devices and transfers"
```

---

### Task 14: API 服务层

**Files:**
- Create: `src/services/localApi.ts`
- Create: `src/services/remoteApi.ts`

**Step 1: 本地 Tauri IPC 服务**

`src/services/localApi.ts`:
```ts
import { invoke } from "@tauri-apps/api/core";
import { Device } from "../types";

export async function getDevices(): Promise<Device[]> {
  return invoke("get_devices");
}

export async function getLocalDeviceInfo(): Promise<Device> {
  return invoke("get_local_device_info");
}

export async function setThrottleRate(bytesPerSec: number): Promise<void> {
  return invoke("set_throttle_rate", { bytesPerSec });
}
```

**Step 2: 远程设备 HTTP 服务**

`src/services/remoteApi.ts`:
```ts
import { FileEntry } from "../types";

function deviceUrl(ip: string, port: number, path: string): string {
  return `http://${ip}:${port}${path}`;
}

export async function listFiles(
  ip: string,
  port: number,
  dirPath: string
): Promise<FileEntry[]> {
  const res = await fetch(
    deviceUrl(ip, port, `/api/files?path=${encodeURIComponent(dirPath)}`)
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function downloadFile(
  ip: string,
  port: number,
  filePath: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob> {
  const res = await fetch(
    deviceUrl(ip, port, `/api/files/download?path=${encodeURIComponent(filePath)}`)
  );
  if (!res.ok) throw new Error(await res.text());

  const total = Number(res.headers.get("content-length") || 0);
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }

  return new Blob(chunks);
}

export async function uploadFile(
  ip: string,
  port: number,
  targetDir: string,
  file: File
): Promise<void> {
  const form = new FormData();
  form.append("path", targetDir);
  form.append("file", file);

  const res = await fetch(deviceUrl(ip, port, "/api/files/upload"), {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteFile(
  ip: string,
  port: number,
  filePath: string
): Promise<void> {
  const res = await fetch(
    deviceUrl(ip, port, `/api/files?path=${encodeURIComponent(filePath)}`),
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function renameFile(
  ip: string,
  port: number,
  oldPath: string,
  newPath: string
): Promise<void> {
  const res = await fetch(deviceUrl(ip, port, "/api/files/rename"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function createDirectory(
  ip: string,
  port: number,
  dirPath: string
): Promise<void> {
  const res = await fetch(deviceUrl(ip, port, "/api/files/mkdir"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: dirPath }),
  });
  if (!res.ok) throw new Error(await res.text());
}
```

**Step 3: 提交**

```bash
git add -A
git commit -m "feat: add local IPC and remote HTTP API service layers"
```

---

## Phase 5: 前端 UI

### Task 15: 应用外壳（布局 + 顶部栏）

**Files:**
- Create: `src/components/Layout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Step 1: 创建布局组件**

`src/components/Layout.tsx`:
```tsx
import { Link } from "react-router";
import { useDeviceStore } from "../stores/deviceStore";

export default function Layout({ children }: { children: React.ReactNode }) {
  const localDevice = useDeviceStore((s) => s.localDevice);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <Link to="/" className="text-lg font-bold text-white">
          Transport
        </Link>
        <div className="flex items-center gap-3">
          {localDevice && (
            <span className="text-sm text-slate-400">
              {localDevice.name} ({localDevice.ip})
            </span>
          )}
          <Link
            to="/settings"
            className="px-3 py-1 text-sm rounded bg-slate-700 hover:bg-slate-600"
          >
            设置
          </Link>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
```

**Step 2: 更新 App.tsx**

```tsx
import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
```

**Step 3: 更新 index.css 添加全局样式**

```css
@import "tailwindcss";

html, body, #root {
  height: 100%;
  margin: 0;
}
```

**Step 4: 验证**

```bash
pnpm tauri dev
```

Expected: 顶部栏显示 "Transport" 和设置按钮。

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add app layout with header bar"
```

---

### Task 16: 设备列表侧边栏

**Files:**
- Create: `src/components/DeviceList.tsx`
- Modify: `src/pages/HomePage.tsx`

**Step 1: 创建 DeviceList 组件**

`src/components/DeviceList.tsx`:
```tsx
import { useEffect } from "react";
import { useDeviceStore } from "../stores/deviceStore";
import { getDevices, getLocalDeviceInfo } from "../services/localApi";
import { Device } from "../types";

const platformIcons: Record<string, string> = {
  windows: "🖥",
  macos: "💻",
  linux: "🐧",
  android: "📱",
};

export default function DeviceList() {
  const { devices, localDevice, selectedDevice, setDevices, setLocalDevice, selectDevice } =
    useDeviceStore();

  useEffect(() => {
    getLocalDeviceInfo().then(setLocalDevice);

    const poll = setInterval(() => {
      getDevices().then(setDevices);
    }, 3000);

    getDevices().then(setDevices);
    return () => clearInterval(poll);
  }, []);

  const renderDevice = (device: Device, isLocal: boolean) => {
    const isSelected = selectedDevice?.ip === device.ip;
    return (
      <button
        key={device.ip}
        onClick={() => selectDevice(device)}
        className={`w-full text-left px-3 py-2 rounded-lg transition ${
          isSelected
            ? "bg-blue-600 text-white"
            : "hover:bg-slate-700 text-slate-300"
        }`}
      >
        <div className="flex items-center gap-2">
          <span>{platformIcons[device.platform] || "❓"}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{device.name}</div>
            <div className="text-xs text-slate-400">
              {device.ip}
              {isLocal && " (本机)"}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <aside className="w-56 flex-shrink-0 border-r border-slate-700 bg-slate-800 p-3 flex flex-col gap-1 overflow-y-auto">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 px-1">
        发现的设备
      </div>
      {devices.map((d) => renderDevice(d, false))}
      {devices.length === 0 && (
        <p className="text-xs text-slate-500 px-1">正在搜索设备...</p>
      )}

      {localDevice && (
        <>
          <div className="border-t border-slate-700 my-2" />
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 px-1">
            本机
          </div>
          {renderDevice(localDevice, true)}
        </>
      )}
    </aside>
  );
}
```

**Step 2: 更新 HomePage**

`src/pages/HomePage.tsx`:
```tsx
import DeviceList from "../components/DeviceList";
import FileBrowser from "../components/FileBrowser";

export default function HomePage() {
  return (
    <div className="flex h-full">
      <DeviceList />
      <div className="flex-1 flex flex-col overflow-hidden">
        <FileBrowser />
      </div>
    </div>
  );
}
```

先创建占位 FileBrowser:

`src/components/FileBrowser.tsx`:
```tsx
import { useDeviceStore } from "../stores/deviceStore";

export default function FileBrowser() {
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);

  if (!selectedDevice) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        选择一个设备开始浏览文件
      </div>
    );
  }

  return (
    <div className="p-4 text-slate-300">
      正在浏览: {selectedDevice.name} ({selectedDevice.ip})
    </div>
  );
}
```

**Step 3: 验证**

```bash
pnpm tauri dev
```

Expected: 左侧显示设备列表侧边栏，右侧显示 "选择一个设备开始浏览文件"。

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: add device list sidebar with auto-polling"
```

---

### Task 17: 文件浏览器

**Files:**
- Modify: `src/components/FileBrowser.tsx`
- Create: `src/components/PathNav.tsx`
- Create: `src/components/FileItem.tsx`
- Create: `src/components/Toolbar.tsx`

**Step 1: 路径导航组件**

`src/components/PathNav.tsx`:
```tsx
interface PathNavProps {
  path: string;
  onNavigate: (path: string) => void;
}

export default function PathNav({ path, onNavigate }: PathNavProps) {
  const parts = path.split("/").filter(Boolean);

  return (
    <div className="flex items-center gap-1 text-sm text-slate-400 px-4 py-2 bg-slate-800 border-b border-slate-700 overflow-x-auto">
      <button
        onClick={() => onNavigate("/")}
        className="hover:text-white shrink-0"
      >
        /
      </button>
      {parts.map((part, i) => {
        const fullPath = "/" + parts.slice(0, i + 1).join("/");
        return (
          <span key={fullPath} className="flex items-center gap-1 shrink-0">
            <span className="text-slate-600">&gt;</span>
            <button onClick={() => onNavigate(fullPath)} className="hover:text-white">
              {part}
            </button>
          </span>
        );
      })}
    </div>
  );
}
```

**Step 2: 文件项组件**

`src/components/FileItem.tsx`:
```tsx
import { FileEntry } from "../types";

interface FileItemProps {
  entry: FileEntry;
  selected: boolean;
  onOpen: () => void;
  onSelect: (multi: boolean) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

function formatDate(timestamp: number): string {
  if (timestamp === 0) return "-";
  return new Date(timestamp * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FileItem({
  entry,
  selected,
  onOpen,
  onSelect,
  onContextMenu,
}: FileItemProps) {
  return (
    <div
      className={`flex items-center px-4 py-1.5 cursor-pointer text-sm ${
        selected ? "bg-blue-600/30 text-white" : "hover:bg-slate-800 text-slate-300"
      }`}
      onClick={(e) => onSelect(e.ctrlKey || e.metaKey)}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <span className="mr-2">{entry.is_dir ? "📁" : "📄"}</span>
      <span className="flex-1 truncate">{entry.name}</span>
      <span className="w-24 text-right text-slate-500 text-xs">
        {entry.is_dir ? "-" : formatSize(entry.size)}
      </span>
      <span className="w-32 text-right text-slate-500 text-xs">
        {formatDate(entry.modified)}
      </span>
    </div>
  );
}
```

**Step 3: 工具栏组件**

`src/components/Toolbar.tsx`:
```tsx
interface ToolbarProps {
  onUpload: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  hasSelection: boolean;
}

export default function Toolbar({
  onUpload,
  onDownload,
  onDelete,
  onNewFolder,
  onRefresh,
  hasSelection,
}: ToolbarProps) {
  const btn =
    "px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
      <button className={btn} onClick={onUpload}>上传</button>
      <button className={btn} onClick={onDownload} disabled={!hasSelection}>下载</button>
      <button className={btn} onClick={onDelete} disabled={!hasSelection}>删除</button>
      <button className={btn} onClick={onNewFolder}>新建文件夹</button>
      <div className="flex-1" />
      <button className={btn} onClick={onRefresh}>刷新</button>
    </div>
  );
}
```

**Step 4: 完善 FileBrowser 主组件**

`src/components/FileBrowser.tsx`:
```tsx
import { useState, useEffect, useCallback } from "react";
import { useDeviceStore } from "../stores/deviceStore";
import { useTransferStore } from "../stores/transferStore";
import { listFiles, downloadFile, uploadFile, deleteFile, createDirectory } from "../services/remoteApi";
import { FileEntry } from "../types";
import PathNav from "./PathNav";
import FileItem from "./FileItem";
import Toolbar from "./Toolbar";

export default function FileBrowser() {
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);
  const addTask = useTransferStore((s) => s.addTask);
  const updateTask = useTransferStore((s) => s.updateTask);

  const [currentPath, setCurrentPath] = useState("/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!selectedDevice) return;
    setLoading(true);
    try {
      const files = await listFiles(selectedDevice.ip, selectedDevice.port, currentPath);
      setEntries(files);
    } catch (e) {
      console.error("Failed to load files:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, currentPath]);

  useEffect(() => {
    setCurrentPath("/");
    setSelected(new Set());
    setEntries([]);
  }, [selectedDevice?.ip]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  if (!selectedDevice) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        选择一个设备开始浏览文件
      </div>
    );
  }

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelected(new Set());
  };

  const openEntry = (entry: FileEntry) => {
    if (entry.is_dir) {
      navigateTo(
        currentPath === "/" ? `/${entry.name}` : `${currentPath}/${entry.name}`
      );
    }
  };

  const toggleSelect = (name: string, multi: boolean) => {
    setSelected((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files) return;
      for (const file of Array.from(input.files)) {
        const taskId = crypto.randomUUID();
        addTask({
          id: taskId,
          fileName: file.name,
          fileSize: file.size,
          direction: "upload",
          status: "transferring",
          progress: 0,
          speed: 0,
          sourceDevice: "local",
          targetDevice: selectedDevice.ip,
        });
        try {
          await uploadFile(selectedDevice.ip, selectedDevice.port, currentPath, file);
          updateTask(taskId, { status: "completed", progress: 100 });
        } catch {
          updateTask(taskId, { status: "failed" });
        }
      }
      loadFiles();
    };
    input.click();
  };

  const handleDownload = async () => {
    for (const name of selected) {
      const entry = entries.find((e) => e.name === name);
      if (!entry || entry.is_dir) continue;
      const filePath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
      const taskId = crypto.randomUUID();
      addTask({
        id: taskId,
        fileName: name,
        fileSize: entry.size,
        direction: "download",
        status: "transferring",
        progress: 0,
        speed: 0,
        sourceDevice: selectedDevice.ip,
        targetDevice: "local",
      });
      try {
        const blob = await downloadFile(
          selectedDevice.ip,
          selectedDevice.port,
          filePath,
          (loaded, total) => {
            updateTask(taskId, {
              progress: total > 0 ? Math.round((loaded / total) * 100) : 0,
            });
          }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        updateTask(taskId, { status: "completed", progress: 100 });
      } catch {
        updateTask(taskId, { status: "failed" });
      }
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除 ${selected.size} 个文件/文件夹？`)) return;
    for (const name of selected) {
      const filePath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
      await deleteFile(selectedDevice.ip, selectedDevice.port, filePath);
    }
    setSelected(new Set());
    loadFiles();
  };

  const handleNewFolder = async () => {
    const name = prompt("文件夹名称:");
    if (!name) return;
    const dirPath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
    await createDirectory(selectedDevice.ip, selectedDevice.port, dirPath);
    loadFiles();
  };

  return (
    <div className="flex flex-col h-full">
      <PathNav path={currentPath} onNavigate={navigateTo} />
      <Toolbar
        onUpload={handleUpload}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onNewFolder={handleNewFolder}
        onRefresh={loadFiles}
        hasSelection={selected.size > 0}
      />
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-500">
            加载中...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500">
            空文件夹
          </div>
        ) : (
          entries.map((entry) => (
            <FileItem
              key={entry.name}
              entry={entry}
              selected={selected.has(entry.name)}
              onOpen={() => openEntry(entry)}
              onSelect={(multi) => toggleSelect(entry.name, multi)}
              onContextMenu={(e) => e.preventDefault()}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 5: 验证**

```bash
pnpm tauri dev
```

Expected: 选择设备后能看到路径导航、工具栏和文件列表。

**Step 6: 提交**

```bash
git add -A
git commit -m "feat: add file browser with path nav, toolbar, and file operations"
```

---

### Task 18: 传输队列面板

**Files:**
- Create: `src/components/TransferQueue.tsx`
- Modify: `src/components/Layout.tsx`

**Step 1: 创建传输队列组件**

`src/components/TransferQueue.tsx`:
```tsx
import { useState } from "react";
import { useTransferStore } from "../stores/transferStore";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

export default function TransferQueue() {
  const { tasks, removeTask } = useTransferStore();
  const [collapsed, setCollapsed] = useState(false);

  const activeTasks = tasks.filter(
    (t) => t.status === "transferring" || t.status === "queued"
  );

  if (tasks.length === 0) return null;

  return (
    <div className="border-t border-slate-700 bg-slate-800">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-1.5 text-xs text-slate-400 hover:bg-slate-700 flex items-center justify-between"
      >
        <span>传输队列 ({activeTasks.length} 进行中 / {tasks.length} 总计)</span>
        <span>{collapsed ? "▲" : "▼"}</span>
      </button>

      {!collapsed && (
        <div className="max-h-40 overflow-y-auto">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 px-4 py-1 text-xs"
            >
              <span className="text-slate-500">
                {task.direction === "upload" ? "↑" : "↓"}
              </span>
              <span className="flex-1 truncate text-slate-300">
                {task.fileName}
              </span>
              <span className="text-slate-500 w-16 text-right">
                {formatSize(task.fileSize)}
              </span>
              <div className="w-24">
                {task.status === "transferring" ? (
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                ) : (
                  <span
                    className={
                      task.status === "completed"
                        ? "text-green-400"
                        : task.status === "failed"
                        ? "text-red-400"
                        : "text-slate-500"
                    }
                  >
                    {task.status === "completed"
                      ? "✓ 已完成"
                      : task.status === "failed"
                      ? "✗ 失败"
                      : task.status === "queued"
                      ? "排队中"
                      : "已取消"}
                  </span>
                )}
              </div>
              {(task.status === "completed" || task.status === "failed") && (
                <button
                  onClick={() => removeTask(task.id)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: 在 Layout 中添加传输队列**

`src/components/Layout.tsx` 的 `main` 下方添加:
```tsx
import TransferQueue from "./TransferQueue";

// 在 </main> 后面:
<TransferQueue />
```

**Step 3: 验证**

```bash
pnpm tauri dev
```

Expected: 底部传输队列在有传输任务时显示。

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: add transfer queue panel"
```

---

### Task 19: 设置页面

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

**Step 1: 实现设置页**

`src/pages/SettingsPage.tsx`:
```tsx
import { useState, useEffect } from "react";
import { useDeviceStore } from "../stores/deviceStore";
import { getLocalDeviceInfo, setThrottleRate } from "../services/localApi";
import { Link } from "react-router";

export default function SettingsPage() {
  const localDevice = useDeviceStore((s) => s.localDevice);
  const [speedLimit, setSpeedLimit] = useState(0); // 0 = unlimited, MB/s

  const handleSpeedChange = (value: number) => {
    setSpeedLimit(value);
    setThrottleRate(value === 0 ? 0 : value * 1024 * 1024);
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">设置</h1>
        <Link to="/" className="text-sm text-blue-400 hover:underline">
          返回
        </Link>
      </div>

      {/* 设备信息 */}
      <section className="mb-6">
        <h2 className="text-sm text-slate-400 uppercase tracking-wider mb-2">
          本机信息
        </h2>
        <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">设备名</span>
            <span>{localDevice?.name || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">IP 地址</span>
            <span>{localDevice?.ip || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">平台</span>
            <span>{localDevice?.platform || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">服务端口</span>
            <span>{localDevice?.port || "-"}</span>
          </div>
        </div>
      </section>

      {/* 带宽限速 */}
      <section className="mb-6">
        <h2 className="text-sm text-slate-400 uppercase tracking-wider mb-2">
          带宽限速
        </h2>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">传输速度上限</span>
            <span className="text-sm text-blue-400">
              {speedLimit === 0 ? "不限速" : `${speedLimit} MB/s`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            step="10"
            value={speedLimit}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>不限速</span>
            <span>200 MB/s</span>
          </div>
        </div>
      </section>

      {/* 服务信息 */}
      <section>
        <h2 className="text-sm text-slate-400 uppercase tracking-wider mb-2">
          应用分发
        </h2>
        <div className="bg-slate-800 rounded-lg p-4 text-sm">
          <p className="text-slate-400 mb-2">
            其他设备可以通过浏览器访问以下地址下载本应用：
          </p>
          <code className="text-blue-400">
            http://{localDevice?.ip || "..."}:{localDevice?.port || "8090"}
          </code>
        </div>
      </section>
    </div>
  );
}
```

**Step 2: 验证**

```bash
pnpm tauri dev
```

Expected: 设置页显示设备信息、限速滑块、分发地址。

**Step 3: 提交**

```bash
git add -A
git commit -m "feat: add settings page with throttle control"
```

---

## Phase 6: 集成与打磨

### Task 20: 安装 Tauri 插件

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `package.json`

**Step 1: 添加 Tauri 插件**

```bash
cd /mnt/d/apps/transport
pnpm tauri add fs
pnpm tauri add dialog
pnpm tauri add notification
```

**Step 2: 在 lib.rs 注册插件**

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_notification::init())
    // ... 其余配置
```

**Step 3: 配置权限**

在 `src-tauri/capabilities/default.json` 中确保包含:
```json
{
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read",
    "fs:allow-write",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "notification:default",
    "notification:allow-notify"
  ]
}
```

**Step 4: 编译验证**

```bash
pnpm tauri dev
```

**Step 5: 提交**

```bash
git add -A
git commit -m "feat: add Tauri fs, dialog, notification plugins"
```

---

### Task 21: 拖拽上传与文件操作右键菜单

**Files:**
- Modify: `src/components/FileBrowser.tsx`
- Create: `src/components/ContextMenu.tsx`

**Step 1: 创建右键菜单组件**

`src/components/ContextMenu.tsx`:
```tsx
import { useEffect, useRef } from "react";

interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed bg-slate-700 border border-slate-600 rounded-lg shadow-xl py-1 z-50 min-w-[140px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          disabled={item.disabled}
          className={`w-full text-left px-3 py-1.5 text-sm ${
            item.danger
              ? "text-red-400 hover:bg-red-600/20"
              : "text-slate-200 hover:bg-slate-600"
          } disabled:opacity-40`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: 在 FileBrowser 中集成拖拽上传和右键菜单**

在 `FileBrowser.tsx` 中:
- 添加 `onDragOver`, `onDrop` 到文件列表容器上
- 在 `FileItem` 的 `onContextMenu` 中弹出 `ContextMenu`，包含：下载、重命名、删除

拖拽上传:
```tsx
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  for (const file of files) {
    const taskId = crypto.randomUUID();
    addTask({ /* ... same as handleUpload ... */ });
    try {
      await uploadFile(selectedDevice.ip, selectedDevice.port, currentPath, file);
      updateTask(taskId, { status: "completed", progress: 100 });
    } catch {
      updateTask(taskId, { status: "failed" });
    }
  }
  loadFiles();
};
```

右键菜单（状态管理）:
```tsx
const [contextMenu, setContextMenu] = useState<{x: number; y: number; entry: FileEntry} | null>(null);

// 在 FileItem 的 onContextMenu:
onContextMenu={(e) => {
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY, entry });
}}
```

**Step 3: 验证**

```bash
pnpm tauri dev
```

Expected: 可以拖拽文件到浏览器上传，右键文件弹出操作菜单。

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: add drag-drop upload and context menu"
```

---

## Phase 6.5: 浏览器模式

### Task 22: axum serve React SPA 静态资源

**Files:**
- Modify: `src-tauri/src/server/mod.rs`
- Modify: `src-tauri/src/server/routes.rs`
- Modify: `src-tauri/Cargo.toml`

**说明:** axum 在 `/app` 路径下 serve Vite 打包后的 React SPA 静态资源，使浏览器可以访问完整 UI。

**Step 1: 添加 tower-http serve-dir 支持**

`Cargo.toml` 的 `tower-http` features 中添加 `"fs"`:
```toml
tower-http = { version = "0.6", features = ["cors", "fs"] }
```

**Step 2: 配置静态资源路由**

`src-tauri/src/server/mod.rs` 中添加:
```rust
use tower_http::services::{ServeDir, ServeFile};

// 在 Router 构建中添加:
// Vite 打包输出在 ../dist（相对于 src-tauri），运行时路径需要动态解析
let frontend_dist = std::env::current_exe()
    .ok()
    .and_then(|p| p.parent().map(|p| p.join("../dist")))
    .unwrap_or_else(|| std::path::PathBuf::from("../dist"));

let app = Router::new()
    .route("/", get(landing::landing_page))
    .route("/download/{platform}", get(landing::download_installer))
    .nest("/api", api_routes)
    .nest_service("/app", ServeDir::new(&frontend_dist)
        .fallback(ServeFile::new(frontend_dist.join("index.html"))))
    .layer(CorsLayer::permissive())
    .with_state(AppState { throttle });
```

SPA fallback 确保 `/app/settings` 等前端路由也能正确返回 `index.html`。

**Step 3: 编译验证**

```bash
cd /mnt/d/apps/transport && pnpm build
cd /mnt/d/apps/transport/src-tauri && cargo build
```

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: serve React SPA via axum for browser mode"
```

---

### Task 23: 限速设置 HTTP API（供浏览器模式使用）

**Files:**
- Modify: `src-tauri/src/server/handlers.rs`
- Modify: `src-tauri/src/server/routes.rs`

**说明:** 浏览器模式无法使用 Tauri IPC，需要通过 HTTP API 设置限速。

**Step 1: 添加限速设置 handler**

`handlers.rs`:
```rust
#[derive(serde::Deserialize)]
pub struct ThrottleRequest {
    pub bytes_per_sec: u64,
}

pub async fn get_throttle(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    let rate = state.throttle.get_rate().await;
    Json(serde_json::json!({"bytes_per_sec": rate}))
}

pub async fn set_throttle(
    State(state): State<AppState>,
    Json(body): Json<ThrottleRequest>,
) -> Json<serde_json::Value> {
    state.throttle.set_rate(body.bytes_per_sec).await;
    Json(serde_json::json!({"ok": true}))
}
```

同时给 Throttle 加一个 `get_rate` 方法:
```rust
pub async fn get_rate(&self) -> u64 {
    *self.bytes_per_sec.lock().await
}
```

**Step 2: 注册路由**

```rust
.route("/settings/throttle", get(handlers::get_throttle).put(handlers::set_throttle))
```

**Step 3: 编译验证并提交**

```bash
cd /mnt/d/apps/transport/src-tauri && cargo build
git add -A
git commit -m "feat: add throttle settings HTTP API for browser mode"
```

---

### Task 24: localApi 浏览器模式适配

**Files:**
- Modify: `src/services/localApi.ts`
- Create: `src/lib/env.ts`

**说明:** 检测运行环境（Tauri vs 浏览器），在浏览器模式下 fallback 到 HTTP API。

**Step 1: 创建环境检测工具**

`src/lib/env.ts`:
```ts
export const isTauri = '__TAURI__' in window;

/** 浏览器模式下，当前连接的设备就是 URL 中的 host */
export function currentDeviceOrigin(): string {
  return window.location.origin;
}
```

**Step 2: 改造 localApi.ts 支持双模式**

`src/services/localApi.ts`:
```ts
import { isTauri, currentDeviceOrigin } from "../lib/env";
import { Device } from "../types";

export async function getDevices(): Promise<Device[]> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("get_devices");
  }
  // 浏览器模式：只能看到当前连接的设备
  const device = await getLocalDeviceInfo();
  return [device];
}

export async function getLocalDeviceInfo(): Promise<Device> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("get_local_device_info");
  }
  const res = await fetch(`${currentDeviceOrigin()}/api/device/info`);
  return res.json();
}

export async function setThrottleRate(bytesPerSec: number): Promise<void> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("set_throttle_rate", { bytesPerSec });
  }
  await fetch(`${currentDeviceOrigin()}/api/settings/throttle`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bytes_per_sec: bytesPerSec }),
  });
}
```

动态 `import()` 确保浏览器环境不会加载 `@tauri-apps/api`。

**Step 3: 更新 FileBrowser 中的 remoteApi 调用**

浏览器模式下，选中设备的 IP/端口就是当前页面的 host，`remoteApi` 已经用 `http://${ip}:${port}` 调用，无需改动。

**Step 4: 提交**

```bash
git add -A
git commit -m "feat: adapt localApi for browser mode with env detection"
```

---

### Task 25: 落地页添加 "在浏览器中使用" 入口

**Files:**
- Modify: `src-tauri/assets/landing.html`

**Step 1: 在落地页 HTML 中添加浏览器使用按钮**

在 `.others` div 之前添加:
```html
<div style="margin-top:1.5rem;">
  <a class="btn" href="/app" style="background:#10b981;">
    在浏览器中直接使用
  </a>
  <p style="color:#64748b;font-size:0.75rem;margin-top:0.5rem;">
    无需安装，直接管理本设备的文件
  </p>
</div>
```

**Step 2: 提交**

```bash
git add -A
git commit -m "feat: add browser mode entry on landing page"
```

---

### Task 26: 端到端验证与修复

**Step 1: 启动应用**

```bash
pnpm tauri dev
```

**Step 2: Tauri 原生模式验证清单**

- [ ] 应用启动后顶部栏显示本机信息
- [ ] 设备列表显示本机
- [ ] 如果有其他设备运行应用，设备列表中可见
- [ ] 点击设备可浏览文件列表
- [ ] 路径导航可点击跳转
- [ ] 双击文件夹可进入
- [ ] 上传文件按钮工作
- [ ] 拖拽上传工作
- [ ] 选中文件后下载工作
- [ ] 新建文件夹工作
- [ ] 删除文件/文件夹工作
- [ ] 传输队列显示进度
- [ ] 设置页限速滑块工作

**Step 3: 浏览器模式验证清单**

- [ ] 浏览器访问 http://localhost:8090/ 显示分发落地页
- [ ] 落地页有 "在浏览器中直接使用" 按钮
- [ ] 点击进入 http://localhost:8090/app 显示完整 UI
- [ ] 浏览器中能浏览文件列表
- [ ] 浏览器中能上传文件
- [ ] 浏览器中能下载文件
- [ ] 浏览器中能删除/重命名/新建文件夹
- [ ] 浏览器中设置页限速工作
- [ ] 浏览器中 SPA 路由刷新不 404（fallback 正常）

**Step 3: 修复发现的问题**

根据验证结果修复 bug。

**Step 4: 提交**

```bash
git add -A
git commit -m "fix: end-to-end integration fixes"
```

---

## 完整依赖汇总

### package.json

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-router": "^7",
    "zustand": "^5",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-fs": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-notification": "^2"
  },
  "devDependencies": {
    "typescript": "^5",
    "@vitejs/plugin-react": "^4",
    "vite": "^6",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4"
  }
}
```

### Cargo.toml

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-notification = "2"
axum = { version = "0.8", features = ["multipart"] }
tokio = { version = "1", features = ["full"] }
tokio-util = { version = "0.7", features = ["io"] }
tower-http = { version = "0.6", features = ["cors", "fs"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
async-stream = "0.3"
bytes = "1"
local-ip-address = "0.6"
hostname = "0.4"
mdns-sd = "0.11"
dirs = "6"

[dev-dependencies]
tempfile = "3"
```
