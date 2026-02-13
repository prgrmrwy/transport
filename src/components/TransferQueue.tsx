import { useState } from "react";
import { useTransferStore } from "../stores/transferStore";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

export default function TransferQueue() {
  const { tasks, removeTask } = useTransferStore();
  const [collapsed, setCollapsed] = useState(false);

  const activeTasks = tasks.filter(
    (t) => t.status === "transferring" || t.status === "queued"
  );

  if (tasks.length === 0) return null;

  return (
    <div className="border-t border-slate-700 bg-slate-800">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-1.5 text-xs text-slate-400 hover:bg-slate-700 flex items-center justify-between"
      >
        <span>传输队列 ({activeTasks.length} 进行中 / {tasks.length} 总计)</span>
        <span>{collapsed ? "\u25B2" : "\u25BC"}</span>
      </button>

      {!collapsed && (
        <div className="max-h-40 overflow-y-auto">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 px-4 py-1 text-xs"
            >
              <span className="text-slate-500">
                {task.direction === "upload" ? "\u2191" : "\u2193"}
              </span>
              <span className="flex-1 truncate text-slate-300">
                {task.fileName}
              </span>
              <span className="text-slate-500 w-16 text-right">
                {formatSize(task.fileSize)}
              </span>
              <div className="w-24">
                {task.status === "transferring" ? (
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                ) : (
                  <span
                    className={
                      task.status === "completed"
                        ? "text-green-400"
                        : task.status === "failed"
                        ? "text-red-400"
                        : "text-slate-500"
                    }
                  >
                    {task.status === "completed"
                      ? "\u2713 已完成"
                      : task.status === "failed"
                      ? "\u2717 失败"
                      : task.status === "queued"
                      ? "排队中"
                      : "已取消"}
                  </span>
                )}
              </div>
              {(task.status === "completed" || task.status === "failed") && (
                <button
                  onClick={() => removeTask(task.id)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  \u2715
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
