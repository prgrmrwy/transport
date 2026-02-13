export interface Device {
  name: string;
  ip: string;
  port: number;
  platform: string;
}

export interface FileEntry {
  name: string;
  is_dir: boolean;
  size: number;
  modified: number;
}

export type TransferStatus = "queued" | "transferring" | "completed" | "failed" | "cancelled";
export type TransferDirection = "upload" | "download";

export interface TransferTask {
  id: string;
  fileName: string;
  fileSize: number;
  direction: TransferDirection;
  status: TransferStatus;
  progress: number;
  speed: number;
  sourceDevice: string;
  targetDevice: string;
}
