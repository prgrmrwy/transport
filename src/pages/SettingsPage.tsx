import { useState } from "react";
import { useDeviceStore } from "../stores/deviceStore";
import { setThrottleRate } from "../services/localApi";
import { Link } from "react-router";

export default function SettingsPage() {
  const localDevice = useDeviceStore((s) => s.localDevice);
  const [speedLimit, setSpeedLimit] = useState(0);

  const handleSpeedChange = (value: number) => {
    setSpeedLimit(value);
    setThrottleRate(value === 0 ? 0 : value * 1024 * 1024);
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">设置</h1>
        <Link to="/" className="text-sm text-blue-400 hover:underline">
          返回
        </Link>
      </div>

      <section className="mb-6">
        <h2 className="text-sm text-slate-400 uppercase tracking-wider mb-2">
          本机信息
        </h2>
        <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">设备名</span>
            <span>{localDevice?.name || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">IP 地址</span>
            <span>{localDevice?.ip || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">平台</span>
            <span>{localDevice?.platform || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">服务端口</span>
            <span>{localDevice?.port || "-"}</span>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm text-slate-400 uppercase tracking-wider mb-2">
          带宽限速
        </h2>
        <div className="bg-slate-800 rounded-lg p-4">
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
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>不限速</span>
            <span>200 MB/s</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm text-slate-400 uppercase tracking-wider mb-2">
          应用分发
        </h2>
        <div className="bg-slate-800 rounded-lg p-4 text-sm">
          <p className="text-slate-400 mb-2">
            其他设备可以通过浏览器访问以下地址下载本应用：
          </p>
          <code className="text-blue-400">
            http://{localDevice?.ip || "..."}:{localDevice?.port || "8090"}
          </code>
        </div>
      </section>
    </div>
  );
}
