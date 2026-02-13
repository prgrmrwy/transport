import { isTauri, currentDeviceOrigin } from "../lib/env";
import { Device } from "../types";

export async function getDevices(): Promise<Device[]> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("get_devices");
  }
  // Browser mode: can only see the device we're connected to
  const device = await getLocalDeviceInfo();
  return [device];
}

export async function getLocalDeviceInfo(): Promise<Device> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("get_local_device_info");
  }
  const res = await fetch(`${currentDeviceOrigin()}/api/device/info`);
  return res.json();
}

export async function setThrottleRate(bytesPerSec: number): Promise<void> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("set_throttle_rate", { bytesPerSec });
  }
  await fetch(`${currentDeviceOrigin()}/api/settings/throttle`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bytes_per_sec: bytesPerSec }),
  });
}
