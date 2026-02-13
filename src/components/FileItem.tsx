import { FileEntry } from "../types";

interface FileItemProps {
  entry: FileEntry;
  selected: boolean;
  onOpen: () => void;
  onSelect: (multi: boolean) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

function formatDate(timestamp: number): string {
  if (timestamp === 0) return "-";
  return new Date(timestamp * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FileItem({
  entry,
  selected,
  onOpen,
  onSelect,
  onContextMenu,
}: FileItemProps) {
  return (
    <div
      className={`flex items-center px-4 py-1.5 cursor-pointer text-sm ${
        selected ? "bg-blue-600/30 text-white" : "hover:bg-slate-800 text-slate-300"
      }`}
      onClick={(e) => onSelect(e.ctrlKey || e.metaKey)}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <span className="mr-2">{entry.is_dir ? "\uD83D\uDCC1" : "\uD83D\uDCC4"}</span>
      <span className="flex-1 truncate">{entry.name}</span>
      <span className="w-24 text-right text-slate-500 text-xs">
        {entry.is_dir ? "-" : formatSize(entry.size)}
      </span>
      <span className="w-32 text-right text-slate-500 text-xs">
        {formatDate(entry.modified)}
      </span>
    </div>
  );
}
