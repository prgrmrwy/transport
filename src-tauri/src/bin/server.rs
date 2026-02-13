/// 独立 axum 服务器，用于浏览器模式开发调试。
/// 不启动 Tauri 窗口，编译快、启动快。
use transport_lib::server;
use transport_lib::transfer::throttle::Throttle;

#[tokio::main]
async fn main() {
    let throttle = Throttle::new(0);
    server::start_server(8090, throttle).await;
}
