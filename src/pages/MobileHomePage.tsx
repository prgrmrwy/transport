import { useEffect } from "react";
import { Link } from "react-router";
import { useDeviceStore } from "../stores/deviceStore";
import { getDevices } from "../services/localApi";
import { Device } from "../types";

const platformIcons: Record<string, string> = {
  windows: "🖥",
  macos: "💻",
  linux: "🐧",
  android: "📱",
};

/** 移动端设备列表页 */
export default function MobileHomePage() {
  const { devices, localDevice, setDevices } = useDeviceStore();

  useEffect(() => {
    getDevices().then(setDevices);
    const poll = setInterval(() => getDevices().then(setDevices), 3000);
    return () => clearInterval(poll);
  }, [setDevices]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 py-3 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-bold">发现的设备</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {devices.map((d) => (
            <DeviceCard key={d.ip} device={d} isLocal={false} />
          ))}
          {devices.length === 0 && (
            <p className="text-slate-500 text-sm">正在搜索设备...</p>
          )}
        </div>

        {localDevice && (
          <>
            <h2 className="text-sm text-slate-500 uppercase tracking-wider mt-6 mb-2">本机</h2>
            <DeviceCard device={localDevice} isLocal />
          </>
        )}
      </div>
    </div>
  );
}

function DeviceCard({ device, isLocal }: { device: Device; isLocal: boolean }) {
  return (
    <Link
      to={`/browse?path=${encodeURIComponent(device.home_dir || "/")}`}
      className="block w-full text-left px-4 py-3 rounded-xl bg-slate-800 active:bg-slate-700 transition"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{platformIcons[device.platform] || "?"}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{device.name}</div>
          <div className="text-sm text-slate-400">
            {device.ip}
            {isLocal && " (本机)"}
          </div>
        </div>
        <span className="text-slate-600 text-xl">›</span>
      </div>
    </Link>
  );
}
