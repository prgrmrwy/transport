interface ToolbarProps {
  onUpload: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  hasSelection: boolean;
}

export default function Toolbar({
  onUpload,
  onDownload,
  onDelete,
  onNewFolder,
  onRefresh,
  hasSelection,
}: ToolbarProps) {
  const btn =
    "px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
      <button className={btn} onClick={onUpload}>上传</button>
      <button className={btn} onClick={onDownload} disabled={!hasSelection}>下载</button>
      <button className={btn} onClick={onDelete} disabled={!hasSelection}>删除</button>
      <button className={btn} onClick={onNewFolder}>新建文件夹</button>
      <div className="flex-1" />
      <button className={btn} onClick={onRefresh}>刷新</button>
    </div>
  );
}
