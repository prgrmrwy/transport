import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { useDeviceStore } from "../stores/deviceStore";
import { getLocalDeviceInfo } from "../services/localApi";

const tabs = [
  { path: "/", label: "设备", icon: "📱" },
  { path: "/browse", label: "文件", icon: "📂" },
  { path: "/settings", label: "设置", icon: "⚙️" },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const setLocalDevice = useDeviceStore((s) => s.setLocalDevice);
  const location = useLocation();

  useEffect(() => {
    getLocalDeviceInfo().then(setLocalDevice).catch(console.error);
  }, [setLocalDevice]);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200">
      <main className="flex-1 overflow-hidden">{children}</main>
      <nav className="flex border-t border-slate-700 bg-slate-800 safe-bottom">
        {tabs.map((tab) => {
          // /browse/* 时"设备"tab 保持高亮
          const active =
            tab.path === "/browse"
              ? location.pathname.startsWith("/browse")
              : location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex-1 flex flex-col items-center py-2 text-xs ${
                active ? "text-blue-400" : "text-slate-500"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
