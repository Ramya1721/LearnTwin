import { ReactNode } from "react";
import { Sidebar } from "../components/Sidebar";

export function DashboardLayout({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-graphite-950">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="font-display text-2xl font-bold text-mist-50 tracking-tight">{title}</h1>
              {subtitle && <p className="text-mist-400 text-sm mt-1">{subtitle}</p>}
            </div>
            {action}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
