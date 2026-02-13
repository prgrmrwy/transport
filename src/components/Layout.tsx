import { Link } from "react-router";
import { useDeviceStore } from "../stores/deviceStore";
import TransferQueue from "./TransferQueue";

export default function Layout({ children }: { children: React.ReactNode }) {
  const localDevice = useDeviceStore((s) => s.localDevice);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200">
      <header className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <Link to="/" className="text-lg font-bold text-white">
          Transport
        </Link>
        <div className="flex items-center gap-3">
          {localDevice && (
            <span className="text-sm text-slate-400">
              {localDevice.name} ({localDevice.ip})
            </span>
          )}
          <Link
            to="/settings"
            className="px-3 py-1 text-sm rounded bg-slate-700 hover:bg-slate-600"
          >
            设置
          </Link>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
      <TransferQueue />
    </div>
  );
}
