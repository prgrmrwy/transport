import { isTauri, currentDeviceOrigin } from "../lib/env";
import { Device } from "../types";
import logger from "../lib/logger";

const log = logger.child({ module: "localApi" });

export async function getDevices(): Promise<Device[]> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("get_devices");
  }
  const device = await getLocalDeviceInfo();
  log.debug({ device }, "getDevices (browser mode)");
  return [device];
}

export async function getLocalDeviceInfo(): Promise<Device> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("get_local_device_info");
  }
  const url = `${currentDeviceOrigin()}/api/device/info`;
  log.debug({ url }, "getLocalDeviceInfo request");
  const res = await fetch(url);
  const data = await res.json();
  log.debug({ data }, "getLocalDeviceInfo response");
  return data;
}

export async function setThrottleRate(bytesPerSec: number): Promise<void> {
  log.info({ bytesPerSec }, "setThrottleRate");
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
