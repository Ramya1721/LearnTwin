import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Route,
  Fingerprint,
  Network,
  ClipboardCheck,
  Dumbbell,
  AlertTriangle,
  GitBranch,
  BarChart3,
  Bot,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/learning-path", label: "My Learning Path", icon: Route },
  { to: "/digital-twin", label: "Digital Twin", icon: Fingerprint },
  { to: "/skills-graph", label: "Skills Graph", icon: Network },
  { to: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { to: "/practice", label: "Practice Hub", icon: Dumbbell },
  { to: "/bottlenecks", label: "Bottleneck Analysis", icon: AlertTriangle },
  { to: "/path-corrections", label: "Path Corrections", icon: GitBranch },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-graphite-900 border-r border-graphite-700 flex flex-col">
      <div className="px-5 py-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-signal/15 border border-signal-dim/40 flex items-center justify-center">
            <span className="font-display font-bold text-signal text-sm">Lt</span>
          </div>
          <span className="font-display font-bold text-mist-50 tracking-tight">LearnTwin</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-signal-soft text-signal font-medium"
                  : "text-mist-300 hover:bg-graphite-700 hover:text-mist-100"
              }`
            }
          >
            <Icon size={17} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-graphite-700">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-twin-soft text-twin flex items-center justify-center text-xs font-semibold">
            {user?.name?.slice(0, 2).toUpperCase() || "LT"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-mist-100 truncate">{user?.name}</p>
            <p className="text-xs text-mist-400 truncate">{user?.email}</p>
          </div>
          <button onClick={logout} title="Log out" className="text-mist-400 hover:text-danger transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
