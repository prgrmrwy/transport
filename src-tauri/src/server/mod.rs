pub mod handlers;
pub mod landing;
pub mod routes;

use std::net::SocketAddr;
use axum::Router;
use axum::routing::get;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};

use crate::transfer::throttle::Throttle;

#[derive(Clone)]
pub struct AppState {
    pub throttle: Throttle,
}

fn find_frontend_dist() -> std::path::PathBuf {
    // Try multiple locations for the frontend dist
    let candidates = [
        // When running via `cargo run` from src-tauri/
        std::path::PathBuf::from("../dist"),
        // When running from the project root
        std::path::PathBuf::from("dist"),
        // Relative to the executable
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.join("../dist")))
            .unwrap_or_else(|| std::path::PathBuf::from("../dist")),
    ];

    for candidate in &candidates {
        if candidate.join("index.html").exists() {
            println!("Frontend dist found at: {}", candidate.display());
            return candidate.clone();
        }
    }

    println!("Warning: Frontend dist not found, SPA serving may not work. Build with `pnpm build` first.");
    std::path::PathBuf::from("../dist")
}

pub async fn start_server(port: u16, throttle: Throttle) {
    let state = AppState { throttle };
    let frontend_dist = find_frontend_dist();

    let app = Router::new()
        .route("/", get(landing::landing_page))
        .route("/download/{platform}", get(landing::download_installer))
        .nest("/api", routes::api_routes()
            .route("/installers", get(landing::list_installers)))
        .nest_service(
            "/app",
            ServeDir::new(&frontend_dist)
                .fallback(ServeFile::new(frontend_dist.join("index.html"))),
        )
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Transport server listening on {}", addr);
    println!("  API:     http://0.0.0.0:{}/api", port);
    println!("  Web UI:  http://0.0.0.0:{}/app", port);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
