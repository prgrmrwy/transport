import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import { useDeviceStore } from "../stores/deviceStore";
import { useTransferStore } from "../stores/transferStore";
import { listFiles, downloadFile, uploadFile, deleteFile, createDirectory, renameFile } from "../services/remoteApi";
import { isVR } from "../lib/useIsMobile";
import { FileEntry } from "../types";
import PathNav from "./PathNav";
import FileItem from "./FileItem";
import Toolbar from "./Toolbar";
import ContextMenu from "./ContextMenu";

export default function FileBrowser() {
  const selectedDevice = useDeviceStore((s) => s.selectedDevice);
  const addTask = useTransferStore((s) => s.addTask);
  const updateTask = useTransferStore((s) => s.updateTask);

  const [searchParams, setSearchParams] = useSearchParams();
  const defaultPath = selectedDevice?.home_dir || "/";
  const currentPath = searchParams.get("path") || defaultPath;
  const setCurrentPath = (path: string) => {
    setSearchParams(path === defaultPath ? {} : { path });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!selectedDevice) return;
    setLoading(true);
    try {
      const files = await listFiles(selectedDevice.ip, selectedDevice.port, currentPath);
      setEntries(files);
    } catch (e) {
      console.error("Failed to load files:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, currentPath]);

  const prevDeviceIp = useRef(selectedDevice?.ip);
  useEffect(() => {
    if (prevDeviceIp.current !== selectedDevice?.ip) {
      // 从一个设备切换到另一个设备时重置路径；初始加载（undefined→ip）不重置
      const wasSwitch = prevDeviceIp.current !== undefined;
      prevDeviceIp.current = selectedDevice?.ip;
      if (wasSwitch) {
        setSearchParams({});
      }
      setSelected(new Set());
      setEntries([]);
    }
  }, [selectedDevice?.ip, setSearchParams]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  if (!selectedDevice) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        选择一个设备开始浏览文件
      </div>
    );
  }

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelected(new Set());
  };

  const openEntry = (entry: FileEntry) => {
    if (entry.is_dir) {
      navigateTo(
        currentPath === "/" ? `/${entry.name}` : `${currentPath}/${entry.name}`
      );
    }
  };

  const toggleSelect = (name: string, multi: boolean) => {
    setSelected((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const doUploadFiles = async (files: File[]) => {
    for (const file of files) {
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
        targetDevice: selectedDevice.ip,
      });
      try {
        await uploadFile(selectedDevice.ip, selectedDevice.port, currentPath, file);
        updateTask(taskId, { status: "completed", progress: 100 });
      } catch {
        updateTask(taskId, { status: "failed" });
      }
    }
    loadFiles();
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    await doUploadFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleDownload = async () => {
    for (const name of selected) {
      const entry = entries.find((e) => e.name === name);
      if (!entry || entry.is_dir) continue;
      const filePath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
      const downloadUrl = `/api/files/download?path=${encodeURIComponent(filePath)}`;

      // VR 浏览器不支持 blob 下载，直接用原生链接
      if (isVR) {
        window.open(downloadUrl, "_blank");
        continue;
      }

      const taskId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      addTask({
        id: taskId,
        fileName: name,
        fileSize: entry.size,
        direction: "download",
        status: "transferring",
        progress: 0,
        speed: 0,
        sourceDevice: selectedDevice.ip,
        targetDevice: "local",
      });
      try {
        const blob = await downloadFile(
          selectedDevice.ip,
          selectedDevice.port,
          filePath,
          (loaded, total) => {
            updateTask(taskId, {
              progress: total > 0 ? Math.round((loaded / total) * 100) : 0,
            });
          }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        updateTask(taskId, { status: "completed", progress: 100 });
      } catch {
        updateTask(taskId, { status: "failed" });
      }
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除 ${selected.size} 个文件/文件夹？`)) return;
    for (const name of selected) {
      const filePath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
      await deleteFile(selectedDevice.ip, selectedDevice.port, filePath);
    }
    setSelected(new Set());
    loadFiles();
  };

  const handleNewFolder = async () => {
    const name = prompt("文件夹名称:");
    if (!name) return;
    const dirPath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
    await createDirectory(selectedDevice.ip, selectedDevice.port, dirPath);
    loadFiles();
  };

  const handleRename = async (entry: FileEntry) => {
    const newName = prompt("新名称:", entry.name);
    if (!newName || newName === entry.name) return;
    const oldPath = currentPath === "/" ? `/${entry.name}` : `${currentPath}/${entry.name}`;
    const newPath = currentPath === "/" ? `/${newName}` : `${currentPath}/${newName}`;
    await renameFile(selectedDevice.ip, selectedDevice.port, oldPath, newPath);
    loadFiles();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await doUploadFiles(files);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
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
      <PathNav path={currentPath} onNavigate={navigateTo} />
      <Toolbar
        onUpload={handleUpload}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onNewFolder={handleNewFolder}
        onRefresh={loadFiles}
        hasSelection={selected.size > 0}
      />
      <div
        className={`flex-1 overflow-y-auto ${dragOver ? "bg-blue-600/10 border-2 border-dashed border-blue-500" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-500">
            加载中...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500">
            空文件夹（可拖拽文件到此处上传）
          </div>
        ) : (
          entries.map((entry) => (
            <FileItem
              key={entry.name}
              entry={entry}
              selected={selected.has(entry.name)}
              onOpen={() => openEntry(entry)}
              onSelect={(multi) => toggleSelect(entry.name, multi)}
              onContextMenu={(e) => handleContextMenu(e, entry)}
            />
          ))
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "下载",
              onClick: () => {
                const entry = contextMenu.entry;
                if (entry.is_dir) return;
                const filePath = currentPath === "/" ? `/${entry.name}` : `${currentPath}/${entry.name}`;
                const downloadUrl = `/api/files/download?path=${encodeURIComponent(filePath)}`;
                if (isVR) {
                  window.open(downloadUrl, "_blank");
                } else {
                  const a = document.createElement("a");
                  a.href = downloadUrl;
                  a.download = entry.name;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }
              },
              disabled: contextMenu.entry.is_dir,
            },
            {
              label: "重命名",
              onClick: () => handleRename(contextMenu.entry),
            },
            {
              label: "删除",
              onClick: async () => {
                const entry = contextMenu.entry;
                if (!confirm(`确定删除 ${entry.name}？`)) return;
                const filePath = currentPath === "/" ? `/${entry.name}` : `${currentPath}/${entry.name}`;
                await deleteFile(selectedDevice.ip, selectedDevice.port, filePath);
                loadFiles();
              },
              danger: true,
            },
          ]}
        />
      )}
    </div>
  );
}
