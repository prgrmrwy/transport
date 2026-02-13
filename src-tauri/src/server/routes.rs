use axum::{routing::get, Router};
use super::handlers;

pub fn api_routes() -> Router {
    Router::new()
        .route("/device/info", get(handlers::device_info))
}
