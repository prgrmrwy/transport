import { FileEntry } from "../types";
import logger from "../lib/logger";

const log = logger.child({ module: "remoteApi" });

function deviceUrl(ip: string, port: number, path: string): string {
  return `http://${ip}:${port}${path}`;
}

export async function listFiles(
  ip: string,
  port: number,
  dirPath: string
): Promise<FileEntry[]> {
  const url = deviceUrl(ip, port, `/api/files?path=${encodeURIComponent(dirPath)}`);
  log.debug({ url, dirPath }, "listFiles request");
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    log.error({ status: res.status, text, url }, "listFiles failed");
    throw new Error(text);
  }
  const data = await res.json();
  log.debug({ count: data.length, dirPath }, "listFiles response");
  return data;
}

export async function downloadFile(
  ip: string,
  port: number,
  filePath: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob> {
  const url = deviceUrl(ip, port, `/api/files/download?path=${encodeURIComponent(filePath)}`);
  log.debug({ url, filePath }, "downloadFile request");
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    log.error({ status: res.status, text }, "downloadFile failed");
    throw new Error(text);
  }

  const total = Number(res.headers.get("content-length") || 0);
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }

  log.info({ filePath, size: loaded }, "downloadFile complete");
  return new Blob(chunks);
}

export async function uploadFile(
  ip: string,
  port: number,
  targetDir: string,
  file: File
): Promise<void> {
  const url = deviceUrl(ip, port, "/api/files/upload");
  log.debug({ url, targetDir, fileName: file.name, size: file.size }, "uploadFile request");
  const form = new FormData();
  form.append("path", targetDir);
  form.append("file", file);

  const res = await fetch(url, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    log.error({ status: res.status, text }, "uploadFile failed");
    throw new Error(text);
  }
  log.info({ targetDir, fileName: file.name }, "uploadFile complete");
}

export async function deleteFile(
  ip: string,
  port: number,
  filePath: string
): Promise<void> {
  log.debug({ filePath }, "deleteFile request");
  const res = await fetch(
    deviceUrl(ip, port, `/api/files?path=${encodeURIComponent(filePath)}`),
    { method: "DELETE" }
  );
  if (!res.ok) {
    const text = await res.text();
    log.error({ status: res.status, text }, "deleteFile failed");
    throw new Error(text);
  }
  log.info({ filePath }, "deleteFile complete");
}

export async function renameFile(
  ip: string,
  port: number,
  oldPath: string,
  newPath: string
): Promise<void> {
  log.debug({ oldPath, newPath }, "renameFile request");
  const res = await fetch(deviceUrl(ip, port, "/api/files/rename"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  });
  if (!res.ok) {
    const text = await res.text();
    log.error({ status: res.status, text }, "renameFile failed");
    throw new Error(text);
  }
  log.info({ oldPath, newPath }, "renameFile complete");
}

export async function createDirectory(
  ip: string,
  port: number,
  dirPath: string
): Promise<void> {
  log.debug({ dirPath }, "createDirectory request");
  const res = await fetch(deviceUrl(ip, port, "/api/files/mkdir"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: dirPath }),
  });
  if (!res.ok) {
    const text = await res.text();
    log.error({ status: res.status, text }, "createDirectory failed");
    throw new Error(text);
  }
  log.info({ dirPath }, "createDirectory complete");
}
