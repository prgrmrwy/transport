use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration, Instant};

pub struct Throttle {
    bytes_per_sec: Arc<Mutex<u64>>,
    tokens: Arc<Mutex<f64>>,
    last_refill: Arc<Mutex<Instant>>,
}

impl Throttle {
    /// Create a new throttle. 0 means unlimited.
    pub fn new(bytes_per_sec: u64) -> Self {
        Self {
            bytes_per_sec: Arc::new(Mutex::new(bytes_per_sec)),
            tokens: Arc::new(Mutex::new(bytes_per_sec as f64)),
            last_refill: Arc::new(Mutex::new(Instant::now())),
        }
    }

    pub async fn set_rate(&self, bytes_per_sec: u64) {
        *self.bytes_per_sec.lock().await = bytes_per_sec;
    }

    pub async fn get_rate(&self) -> u64 {
        *self.bytes_per_sec.lock().await
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

    #[tokio::test]
    async fn test_get_set_rate() {
        let throttle = Throttle::new(100);
        assert_eq!(throttle.get_rate().await, 100);
        throttle.set_rate(500).await;
        assert_eq!(throttle.get_rate().await, 500);
    }
}
