pub mod handlers;
pub mod routes;

use std::net::SocketAddr;
use axum::Router;
use tower_http::cors::CorsLayer;

use crate::transfer::throttle::Throttle;

#[derive(Clone)]
pub struct AppState {
    pub throttle: Throttle,
}

pub async fn start_server(port: u16, throttle: Throttle) {
    let state = AppState { throttle };

    let app = Router::new()
        .nest("/api", routes::api_routes())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Transport server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
