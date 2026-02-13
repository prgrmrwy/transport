import pino from "pino";

// 后端可能还没启动，先攒着，等后端就绪再发送
let backendReady = false;
let pending: string[] = [];

function tryFlush() {
  if (!backendReady) return;
  const batch = pending.splice(0);
  for (const body of batch) {
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
  }
}

// 探测后端是否就绪
function probeBackend() {
  fetch("/api/device/info", { method: "HEAD" })
    .then((r) => {
      if (r.ok) {
        backendReady = true;
        tryFlush();
      } else {
        setTimeout(probeBackend, 2000);
      }
    })
    .catch(() => setTimeout(probeBackend, 2000));
}
probeBackend();

const logger = pino({
  level: import.meta.env.DEV ? "trace" : "info",
  browser: {
    asObject: true,
    transmit: {
      send(_level, logEvent) {
        const body = JSON.stringify(logEvent);
        if (backendReady) {
          fetch("/api/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          }).catch(() => {});
        } else {
          pending.push(body);
        }
      },
    },
  },
});

export default logger;
