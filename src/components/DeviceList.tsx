import { useEffect } from "react";
import { useDeviceStore } from "../stores/deviceStore";
import { getDevices, getLocalDeviceInfo } from "../services/localApi";
import { Device } from "../types";

const platformIcons: Record<string, string> = {
  windows: "\uD83D\uDDA5",
  macos: "\uD83D\uDCBB",
  linux: "\uD83D\uDC27",
  android: "\uD83D\uDCF1",
};

export default function DeviceList() {
  const { devices, localDevice, selectedDevice, setDevices, setLocalDevice, selectDevice } =
    useDeviceStore();

  useEffect(() => {
    getLocalDeviceInfo().then(setLocalDevice);
    getDevices().then(setDevices);

    const poll = setInterval(() => {
      getDevices().then(setDevices);
    }, 3000);

    return () => clearInterval(poll);
  }, []);

  const renderDevice = (device: Device, isLocal: boolean) => {
    const isSelected = selectedDevice?.ip === device.ip;
    return (
      <button
        key={device.ip + (isLocal ? "-local" : "")}
        onClick={() => selectDevice(device)}
        className={`w-full text-left px-3 py-2 rounded-lg transition ${
          isSelected
            ? "bg-blue-600 text-white"
            : "hover:bg-slate-700 text-slate-300"
        }`}
      >
        <div className="flex items-center gap-2">
          <span>{platformIcons[device.platform] || "?"}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{device.name}</div>
            <div className="text-xs text-slate-400">
              {device.ip}
              {isLocal && " (本机)"}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <aside className="w-56 flex-shrink-0 border-r border-slate-700 bg-slate-800 p-3 flex flex-col gap-1 overflow-y-auto">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 px-1">
        发现的设备
      </div>
      {devices.map((d) => renderDevice(d, false))}
      {devices.length === 0 && (
        <p className="text-xs text-slate-500 px-1">正在搜索设备...</p>
      )}

      {localDevice && (
        <>
          <div className="border-t border-slate-700 my-2" />
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 px-1">
            本机
          </div>
          {renderDevice(localDevice, true)}
        </>
      )}
    </aside>
  );
}
