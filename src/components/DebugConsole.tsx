import { useState, useEffect, useRef } from "react";

interface LogEntry {
  level: string;
  msg: string;
  time: number;
}

const MAX_LOGS = 100;
const logs: LogEntry[] = [];
let listeners: (() => void)[] = [];

function addLog(level: string, args: unknown[]) {
  const msg = args
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
  logs.push({ level, msg, time: Date.now() });
  if (logs.length > MAX_LOGS) logs.shift();
  listeners.forEach((fn) => fn());
}

// 劫持 console
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

console.log = (...args: unknown[]) => {
  origLog(...args);
  addLog("LOG", args);
};
console.warn = (...args: unknown[]) => {
  origWarn(...args);
  addLog("WARN", args);
};
console.error = (...args: unknown[]) => {
  origError(...args);
  addLog("ERR", args);
};

// 捕获未处理的错误和 promise rejection
window.addEventListener("error", (e) => {
  addLog("ERR", [`[uncaught] ${e.message} at ${e.filename}:${e.lineno}`]);
});
window.addEventListener("unhandledrejection", (e) => {
  addLog("ERR", [`[unhandled promise] ${e.reason}`]);
});

const levelColors: Record<string, string> = {
  LOG: "text-slate-300",
  WARN: "text-yellow-400",
  ERR: "text-red-400",
};

export default function DebugConsole() {
  const [, forceUpdate] = useState(0);
  const [visible, setVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((fn) => fn !== listener);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  return (
    <div className="fixed bottom-16 left-0 right-0 z-[9999] pointer-events-none">
      <div className="pointer-events-auto mx-2">
        <button
          onClick={() => setVisible((v) => !v)}
          className="mb-1 px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded border border-slate-600"
        >
          {visible ? "隐藏" : "显示"} Console ({logs.length})
        </button>
        {visible && (
          <div
            ref={scrollRef}
            className="bg-black/90 border border-slate-600 rounded text-xs max-h-48 overflow-y-auto p-2 font-mono"
          >
            {logs.length === 0 && (
              <div className="text-slate-500">暂无日志</div>
            )}
            {logs.map((entry, i) => (
              <div key={i} className={`${levelColors[entry.level] || "text-slate-300"} break-all leading-relaxed`}>
                <span className="text-slate-600 mr-1">
                  {new Date(entry.time).toLocaleTimeString("zh-CN", { hour12: false })}
                </span>
                <span className="mr-1">[{entry.level}]</span>
                {entry.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
