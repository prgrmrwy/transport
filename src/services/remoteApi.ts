import { FileEntry } from "../types";

function deviceUrl(ip: string, port: number, path: string): string {
  return `http://${ip}:${port}${path}`;
}

export async function listFiles(
  ip: string,
  port: number,
  dirPath: string
): Promise<FileEntry[]> {
  const res = await fetch(
    deviceUrl(ip, port, `/api/files?path=${encodeURIComponent(dirPath)}`)
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function downloadFile(
  ip: string,
  port: number,
  filePath: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob> {
  const res = await fetch(
    deviceUrl(ip, port, `/api/files/download?path=${encodeURIComponent(filePath)}`)
  );
  if (!res.ok) throw new Error(await res.text());

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

  return new Blob(chunks);
}

export async function uploadFile(
  ip: string,
  port: number,
  targetDir: string,
  file: File
): Promise<void> {
  const form = new FormData();
  form.append("path", targetDir);
  form.append("file", file);

  const res = await fetch(deviceUrl(ip, port, "/api/files/upload"), {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteFile(
  ip: string,
  port: number,
  filePath: string
): Promise<void> {
  const res = await fetch(
    deviceUrl(ip, port, `/api/files?path=${encodeURIComponent(filePath)}`),
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function renameFile(
  ip: string,
  port: number,
  oldPath: string,
  newPath: string
): Promise<void> {
  const res = await fetch(deviceUrl(ip, port, "/api/files/rename"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function createDirectory(
  ip: string,
  port: number,
  dirPath: string
): Promise<void> {
  const res = await fetch(deviceUrl(ip, port, "/api/files/mkdir"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: dirPath }),
  });
  if (!res.ok) throw new Error(await res.text());
}
