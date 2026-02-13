export const isTauri = "__TAURI__" in window;

/** In browser mode, the current device is the host we connected to */
export function currentDeviceOrigin(): string {
  return window.location.origin;
}
