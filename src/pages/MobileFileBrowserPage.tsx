import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router";
import { useTransferStore } from "../stores/transferStore";
import { useDeviceStore } from "../stores/deviceStore";
import { listFiles, uploadFile, deleteFile, createDirectory, renameFile } from "../services/remoteApi";
import { FileEntry } from "../types";

/** 移动端文件浏览器页 — 路由: /browse?path=/xxx */
export default function MobileFileBrowserPage() {
  const [searchParams] = useSearchParams();
  const addTask = useTransferStore((s) => s.addTask);
  const updateTask = useTransferStore((s) => s.updateTask);
  const localDevice = useDeviceStore((s) => s.localDevice);

  const defaultPath = localDevice?.home_dir || "/";
  const currentPath = searchParams.get("path") || defaultPath;
  // 浏览器模式下 remoteApi 忽略 ip/port，使用相对路径
  const deviceIp = "";
  const devicePort = 0;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showActions, setShowActions] = useState<FileEntry | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const files = await listFiles(deviceIp, devicePort, currentPath);
      setEntries(files);
    } catch (e) {
      console.error("Failed to load files:", e);
    } finally {
      setLoading(false);
    }
  }, [deviceIp, devicePort, currentPath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const fullPath = (name: string) =>
    currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;

  const browseUrl = (dirPath: string) =>
    `/browse?path=${encodeURIComponent(dirPath)}`;

  // 面包屑
  const pathParts = currentPath.split("/").filter(Boolean);
  const parentPath = "/" + pathParts.slice(0, -1).join("/");

  // --- 操作 ---

  const handleDownload = (entry: FileEntry) => {
    setShowActions(null);
    // 直接用 <a> 导航触发浏览器原生下载
    window.location.href = `/api/files/download?path=${encodeURIComponent(fullPath(entry.name))}`;
  };

  const handleUpload = () => {
    console.log("[upload] click triggered, ref exists:", !!fileInputRef.current);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[upload] onChange fired");
    const files = e.target.files;
    console.log("[upload] files:", files?.length ?? 0);
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      console.log("[upload] uploading:", file.name, "size:", file.size, "to:", currentPath);
      const taskId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      addTask({
        id: taskId,
        fileName: file.name,
        fileSize: file.size,
        direction: "upload",
        status: "transferring",
        progress: 0,
        speed: 0,
        sourceDevice: "local",
        targetDevice: deviceIp,
      });
      try {
        await uploadFile(deviceIp, devicePort, currentPath, file);
        console.log("[upload] success:", file.name);
        updateTask(taskId, { status: "completed", progress: 100 });
      } catch (err) {
        console.error("[upload] failed:", file.name, err);
        updateTask(taskId, { status: "failed" });
      }
    }
    // 重置 input 以便重复选择相同文件
    e.target.value = "";
    loadFiles();
  };

  const handleDelete = async (entry: FileEntry) => {
    setShowActions(null);
    if (!confirm(`确定删除 ${entry.name}？`)) return;
    await deleteFile(deviceIp, devicePort, fullPath(entry.name));
    loadFiles();
  };

  const handleRename = async (entry: FileEntry) => {
    setShowActions(null);
    const newName = prompt("新名称:", entry.name);
    if (!newName || newName === entry.name) return;
    await renameFile(deviceIp, devicePort, fullPath(entry.name), fullPath(newName));
    loadFiles();
  };

  const handleNewFolder = async () => {
    const name = prompt("文件夹名称:");
    if (!name) return;
    await createDirectory(deviceIp, devicePort, fullPath(name));
    loadFiles();
  };

  return (
    <div className="flex flex-col h-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="absolute w-0 h-0 opacity-0 overflow-hidden"
        onChange={onFileSelected}
      />
      {/* 顶部栏 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border-b border-slate-700">
        <Link
          to={currentPath === "/" ? "/" : browseUrl(parentPath)}
          className="p-2 -ml-1 text-blue-400 text-lg"
        >
          ‹
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">文件浏览</div>
          <div className="text-xs text-slate-500 truncate">
            {currentPath === "/" ? "/" : pathParts[pathParts.length - 1]}
          </div>
        </div>
        <button onClick={handleUpload} className="px-3 py-1.5 text-xs rounded bg-blue-600 active:bg-blue-700">
          上传
        </button>
        <button onClick={handleNewFolder} className="px-3 py-1.5 text-xs rounded bg-slate-700 active:bg-slate-600">
          新建
        </button>
      </div>

      {/* 文件列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-500">加载中...</div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
            空文件夹
          </div>
        ) : (
          entries.map((entry) =>
            entry.is_dir ? (
              /* 目录：用 Link 导航，单击即跳转 */
              <Link
                key={entry.name}
                to={browseUrl(fullPath(entry.name))}
                className="w-full flex items-start gap-3 px-4 py-3 active:bg-slate-700 border-b border-slate-800"
              >
                <span className="text-xl mt-0.5">📁</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm break-all line-clamp-2">{entry.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">文件夹</div>
                </div>
                <span className="text-slate-600 mt-0.5 shrink-0">›</span>
              </Link>
            ) : (
              /* 文件：用 <a> 直接下载 */
              <div
                key={entry.name}
                className="w-full flex items-start gap-3 px-4 py-3 active:bg-slate-700 border-b border-slate-800"
              >
                <a
                  href={`/api/files/download?path=${encodeURIComponent(fullPath(entry.name))}`}
                  download={entry.name}
                  className="flex items-start gap-3 flex-1 min-w-0"
                >
                  <span className="text-xl mt-0.5">📄</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm break-all line-clamp-2">{entry.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{formatSize(entry.size)}</div>
                  </div>
                </a>
                <span
                  className="p-2 -mr-2 text-slate-500 shrink-0 cursor-pointer"
                  onClick={() => setShowActions(entry)}
                >
                  ⋯
                </span>
              </div>
            )
          )
        )}
      </div>

      {/* 操作弹窗 */}
      {showActions && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowActions(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full bg-slate-800 rounded-t-2xl p-4 pb-8 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-600 rounded mx-auto mb-4" />
            <div className="text-sm font-medium mb-1 break-all">{showActions.name}</div>
            <div className="text-xs text-slate-500 mb-4">
              {showActions.is_dir ? "文件夹" : formatSize(showActions.size)}
            </div>
            <div className="space-y-1">
              {!showActions.is_dir && (
                <ActionBtn label="下载" onClick={() => handleDownload(showActions)} />
              )}
              <ActionBtn label="重命名" onClick={() => handleRename(showActions)} />
              <ActionBtn label="删除" danger onClick={() => handleDelete(showActions)} />
              <ActionBtn label="取消" onClick={() => setShowActions(null)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, danger, onClick }: { label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg text-sm ${
        danger ? "text-red-400 active:bg-red-900/30" : "text-slate-200 active:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}
