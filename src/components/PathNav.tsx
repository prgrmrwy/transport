interface PathNavProps {
  path: string;
  onNavigate: (path: string) => void;
}

export default function PathNav({ path, onNavigate }: PathNavProps) {
  const parts = path.split("/").filter(Boolean);

  return (
    <div className="flex items-center gap-1 text-sm text-slate-400 px-4 py-2 bg-slate-800 border-b border-slate-700 overflow-x-auto">
      <button
        onClick={() => onNavigate("/")}
        className="hover:text-white shrink-0"
      >
        /
      </button>
      {parts.map((part, i) => {
        const fullPath = "/" + parts.slice(0, i + 1).join("/");
        return (
          <span key={fullPath} className="flex items-center gap-1 shrink-0">
            <span className="text-slate-600">&gt;</span>
            <button onClick={() => onNavigate(fullPath)} className="hover:text-white">
              {part}
            </button>
          </span>
        );
      })}
    </div>
  );
}
