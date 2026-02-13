import { useState } from "react";
import { useDeviceStore } from "../stores/deviceStore";
import { useTransferStore } from "../stores/transferStore";
import { setThrottleRate } from "../services/localApi";

export default function MobileSettingsPage() {
  const localDevice = useDeviceStore((s) => s.localDevice);
  const { tasks, removeTask } = useTransferStore();
  const [speedLimit, setSpeedLimit] = useState(0);

  const handleSpeedChange = (value: number) => {
    setSpeedLimit(value);
    setThrottleRate(value === 0 ? 0 : value * 1024 * 1024);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-bold">设置</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* 本机信息 */}
        <section className="bg-slate-800 rounded-xl p-4 space-y-3">
          <h2 className="text-sm text-slate-400 font-medium">本机信息</h2>
          <InfoRow label="设备名" value={localDevice?.name} />
          <InfoRow label="IP 地址" value={localDevice?.ip} />
          <InfoRow label="平台" value={localDevice?.platform} />
          <InfoRow label="服务端口" value={localDevice?.port?.toString()} />
        </section>

        {/* 带宽限速 */}
        <section className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm text-slate-400 font-medium mb-3">带宽限速</h2>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">传输速度上限</span>
            <span className="text-sm text-blue-400">
              {speedLimit === 0 ? "不限速" : `${speedLimit} MB/s`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            step="10"
            value={speedLimit}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            className="w-full"
          />
        </section>

        {/* 传输列表 */}
        <section className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm text-slate-400 font-medium mb-3">传输列表</h2>
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-500">暂无传输任务</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3">
                  <span className="text-sm">{task.direction === "upload" ? "↑" : "↓"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{task.fileName}</div>
                    {task.status === "transferring" && (
                      <div className="w-full bg-slate-700 rounded-full h-1 mt-1">
                        <div
                          className="bg-blue-500 h-1 rounded-full transition-all"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <span className="text-xs shrink-0">
                    {task.status === "transferring" && <span className="text-blue-400">{task.progress}%</span>}
                    {task.status === "completed" && <span className="text-green-400">完成</span>}
                    {task.status === "failed" && <span className="text-red-400">失败</span>}
                    {task.status === "queued" && <span className="text-slate-500">排队</span>}
                  </span>
                  {(task.status === "completed" || task.status === "failed") && (
                    <button onClick={() => removeTask(task.id)} className="text-slate-500 text-xs p-1">✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 应用分发 */}
        <section className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm text-slate-400 font-medium mb-2">应用分发</h2>
          <p className="text-xs text-slate-500 mb-2">
            其他设备可以通过浏览器访问以下地址下载本应用：
          </p>
          <code className="text-sm text-blue-400 break-all">
            http://{localDevice?.ip || "..."}:{localDevice?.port || "8090"}
          </code>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span>{value || "-"}</span>
    </div>
  );
}
