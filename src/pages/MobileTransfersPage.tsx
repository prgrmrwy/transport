import { useTransferStore } from "../stores/transferStore";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

export default function MobileTransfersPage() {
  const { tasks, removeTask } = useTransferStore();

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-bold">传输列表</h1>
      </div>

      {tasks.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
          暂无传输任务
        </div>
      ) : (
        tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 px-4 py-3 border-b border-slate-800"
          >
            <span className="text-lg">
              {task.direction === "upload" ? "↑" : "↓"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{task.fileName}</div>
              <div className="text-xs text-slate-500">{formatSize(task.fileSize)}</div>
              {task.status === "transferring" && (
                <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              )}
            </div>
            <div className="text-xs shrink-0">
              {task.status === "transferring" && (
                <span className="text-blue-400">{task.progress}%</span>
              )}
              {task.status === "completed" && (
                <span className="text-green-400">✓</span>
              )}
              {task.status === "failed" && (
                <span className="text-red-400">✗</span>
              )}
              {task.status === "queued" && (
                <span className="text-slate-500">排队</span>
              )}
            </div>
            {(task.status === "completed" || task.status === "failed") && (
              <button
                onClick={() => removeTask(task.id)}
                className="text-slate-500 p-1"
              >
                ✕
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
