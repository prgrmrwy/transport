use axum::routing::{get, post, put};
use axum::Router;

use super::handlers;
use super::AppState;

pub fn api_routes() -> Router<AppState> {
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
        .route(
            "/settings/throttle",
            get(handlers::get_throttle).put(handlers::set_throttle),
        )
}
