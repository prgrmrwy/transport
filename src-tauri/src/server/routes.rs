use axum::routing::{delete, get, post, put};
use axum::Router;

use super::handlers;

pub fn api_routes() -> Router {
    Router::new()
        .route("/device/info", get(handlers::device_info))
        .route(
            "/files",
            get(handlers::list_files).delete(handlers::delete_file),
        )
        .route("/files/download", get(handlers::download_file))
        .route("/files/upload", post(handlers::upload_file))
        .route("/files/rename", put(handlers::rename_file))
        .route("/files/mkdir", post(handlers::create_directory))
}
