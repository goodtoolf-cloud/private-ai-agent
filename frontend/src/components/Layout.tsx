// FILE: frontend/src/components/Layout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  MessageSquare, FileUp, Search, Image, Code2, FileText,
  Brain, Bell, BookOpen, Mic, Shield, ChevronRight,
} from "lucide-react";
import { useAppStore } from "../store";
import { alertsAPI } from "../services/api";
import clsx from "clsx";

const NAV = [
  { to: "/chat",      icon: MessageSquare, label: "Chat"          },
  { to: "/files",     icon: FileUp,        label: "Files"         },
  { to: "/search",    icon: Search,        label: "Research"      },
  { to: "/images",    icon: Image,         label: "Images"        },
  { to: "/code",      icon: Code2,         label: "Code"          },
  { to: "/documents", icon: FileText,      label: "Documents"     },
  { to: "/voice",     icon: Mic,           label: "Voice"         },
  { to: "/memory",    icon: Brain,         label: "Memory"        },
  { to: "/alerts",    icon: Bell,          label: "Alerts"        },
  { to: "/knowledge", icon: BookOpen,      label: "Knowledge Base"},
];

export default function Layout() {
  const { unreadAlerts, setUnreadAlerts } = useAppStore();

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await alertsAPI.getNotifications();
        const unread = res.data.filter((n: { is_read: boolean }) => !n.is_read).length;
        setUnreadAlerts(unread);
      } catch {}
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-900">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-bg-800 border-r border-bg-700 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-bg-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">Private AI</div>
              <div className="text-xs text-slate-500">100% Private</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx("sidebar-item group", isActive && "active")
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="text-sm">{label}</span>
              {to === "/alerts" && unreadAlerts > 0 && (
                <span className="ml-auto bg-danger text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadAlerts}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-bg-700">
          <div className="text-xs text-slate-500 text-center">
            Free Forever · Open Source
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
