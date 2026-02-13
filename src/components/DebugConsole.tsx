import { useState, useEffect, useRef, useCallback } from "react";

interface LogEntry {
  level: string;
  msg: string;
  time: number;
}

const MAX_LOGS = 200;
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

// 仅在启用时劫持 console
const enabled =
  import.meta.env.DEV || window.location.hash.includes("debug");

if (enabled) {
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

  window.addEventListener("error", (e) => {
    addLog("ERR", [`[uncaught] ${e.message} at ${e.filename}:${e.lineno}`]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    addLog("ERR", [`[unhandled promise] ${e.reason}`]);
  });
}

const levelColors: Record<string, string> = {
  LOG: "text-slate-300",
  WARN: "text-yellow-400",
  ERR: "text-red-400",
};

const MIN_W = 200;
const MIN_H = 100;

export default function DebugConsole() {
  const [, forceUpdate] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ x: 20, y: 20 });
  const [size, setSize] = useState({ w: 600, h: 800 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

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

  // --- 拖动 ---
  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }, []);

  const onDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  // --- 缩放 ---
  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [size]);

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const dx = e.clientX - resizeRef.current.startX;
    const dy = e.clientY - resizeRef.current.startY;
    setSize({
      w: Math.max(MIN_W, resizeRef.current.origW + dx),
      h: Math.max(MIN_H, resizeRef.current.origH + dy),
    });
  }, []);

  const onResizeEnd = useCallback(() => {
    resizeRef.current = null;
  }, []);

  if (!enabled) return null;

  if (collapsed) {
    return (
      <div
        className="fixed z-[9999]"
        style={{ left: pos.x, top: pos.y }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="px-2 py-1 text-xs bg-slate-800/90 text-slate-400 rounded border border-slate-600 backdrop-blur"
        >
          Console ({logs.length})
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed z-[9999] flex flex-col bg-black/90 border border-slate-600 rounded-lg shadow-2xl backdrop-blur overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      {/* 标题栏 - 可拖动 */}
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-slate-800 cursor-move select-none shrink-0"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        <span className="text-xs text-slate-400 font-mono">Console ({logs.length})</span>
        <div className="flex gap-2">
          <button
            onClick={() => { logs.length = 0; forceUpdate((n) => n + 1); }}
            className="text-xs text-slate-500 hover:text-slate-300"
            onPointerDown={(e) => e.stopPropagation()}
          >
            清空
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="text-xs text-slate-500 hover:text-slate-300"
            onPointerDown={(e) => e.stopPropagation()}
          >
            收起
          </button>
        </div>
      </div>

      {/* 日志区域 - 可滚动 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 font-mono text-xs min-h-0">
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

      {/* 右下角缩放手柄 */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
      >
        <svg viewBox="0 0 16 16" className="w-full h-full text-slate-600">
          <path d="M14 14L8 14L14 8Z" fill="currentColor" />
          <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}
