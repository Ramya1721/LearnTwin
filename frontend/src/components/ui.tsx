import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
  eyebrow,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`bg-graphite-800/60 border border-graphite-600 rounded-xl p-5 shadow-panel ${className}`}>
      {(title || eyebrow) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {eyebrow && (
              <div className="text-[11px] uppercase tracking-widest text-mist-400 font-mono mb-1">{eyebrow}</div>
            )}
            {title && <h3 className="font-display font-semibold text-mist-50 text-base">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "signal" | "twin" | "alert" | "danger";
}) {
  const tones: Record<string, string> = {
    default: "bg-graphite-600 text-mist-200",
    signal: "bg-signal-soft text-signal border border-signal-dim/40",
    twin: "bg-twin-soft text-twin border border-twin-dim/40",
    alert: "bg-alert-soft text-alert border border-alert/30",
    danger: "bg-danger-soft text-danger border border-danger/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base = "px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-signal text-graphite-950 hover:bg-signal-dim",
    secondary: "bg-graphite-600 text-mist-50 hover:bg-graphite-500",
    ghost: "text-mist-200 hover:bg-graphite-700",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const tone = severity === "HIGH" ? "danger" : severity === "MEDIUM" ? "alert" : "default";
  return <Badge tone={tone as any}>{severity}</Badge>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-10">
      <p className="text-mist-100 font-medium mb-1">{title}</p>
      <p className="text-mist-400 text-sm">{description}</p>
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16 text-mist-400 text-sm font-mono">
      Loading learner state…
    </div>
  );
}
