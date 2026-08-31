import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Lock, AlertCircle, RotateCcw, Loader2, PlusCircle } from "lucide-react";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Card, Badge, LoadingBlock, EmptyState, Button } from "../components/ui";
import { LearningPath as LearningPathType, LearningPathItem } from "../types";

const STATUS_META: Record<string, { icon: any; tone: "signal" | "twin" | "alert" | "danger" | "default"; label: string }> = {
  COMPLETED: { icon: CheckCircle2, tone: "signal", label: "Completed" },
  CURRENT: { icon: Circle, tone: "twin", label: "Available" },
  IN_PROGRESS: { icon: Loader2, tone: "twin", label: "In progress" },
  LOCKED: { icon: Lock, tone: "default", label: "Locked" },
  SKIPPED: { icon: CheckCircle2, tone: "default", label: "Skipped (based on level)" },
  WEAK: { icon: AlertCircle, tone: "alert", label: "Revision recommended" },
  FAILED: { icon: AlertCircle, tone: "danger", label: "Needs revision" },
};

export default function LearningPathPage() {
  const [path, setPath] = useState<LearningPathType | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    api
      .get("/learning-path")
      .then((res) => setPath(res.data.path))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const modules = useMemo(() => groupByModule(path?.items || []), [path]);

  if (loading) {
    return (
      <DashboardLayout title="My Learning Path">
        <LoadingBlock />
      </DashboardLayout>
    );
  }

  if (!path) {
    return (
      <DashboardLayout title="My Learning Path">
        <Card>
          <EmptyState title="No active learning path" description="Complete onboarding to generate your personalized roadmap." />
          <Button className="mt-4" onClick={() => navigate("/onboarding")}>
            Set a learning goal
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="My Learning Path"
      subtitle={`Goal: ${path.goal}`}
      action={
        <Button variant="secondary" onClick={() => navigate("/onboarding")}>
          <span className="inline-flex items-center gap-1.5">
            <PlusCircle size={14} /> New learning goal
          </span>
        </Button>
      }
    >
      <div className="space-y-8">
        {modules.map((mod) => (
          <Card key={mod.name} eyebrow={`Module`} title={mod.name}>
            <div className="relative pl-6">
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-graphite-600" />
              <div className="space-y-4">
                {mod.items.map((item) => {
                  const meta = STATUS_META[item.status] || STATUS_META.LOCKED;
                  const Icon = meta.icon;
                  const clickable = item.status !== "LOCKED";
                  return (
                    <div key={item.id} className="relative flex items-start gap-4">
                      <div
                        className={`absolute -left-6 w-4 h-4 rounded-full flex items-center justify-center ${
                          item.status === "COMPLETED" || item.status === "SKIPPED"
                            ? "bg-signal"
                            : item.status === "CURRENT" || item.status === "IN_PROGRESS"
                            ? "bg-twin"
                            : "bg-graphite-600"
                        }`}
                      />
                      <button
                        disabled={!clickable}
                        onClick={() => clickable && navigate(`/learning-path/${item.id}`)}
                        className={`flex-1 text-left bg-graphite-900/60 border border-graphite-600 rounded-lg p-4 flex items-center justify-between transition-colors ${
                          clickable ? "hover:border-signal-dim/50 cursor-pointer" : "cursor-not-allowed opacity-70"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={16} className="text-mist-400" />
                          <div>
                            <p className="text-sm font-medium text-mist-50">{item.skill.name}</p>
                            <p className="text-xs text-mist-400">{item.skill.description}</p>
                            {item.recommendedReason && (
                              <p className="text-xs text-alert mt-1 flex items-center gap-1">
                                <RotateCcw size={11} /> {item.recommendedReason}
                              </p>
                            )}
                            {item.status === "LOCKED" && (
                              <p className="text-xs text-mist-500 mt-1">Complete the previous topic to unlock this.</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {typeof item.estimatedMinutes === "number" && (
                            <span className="text-xs text-mist-500 font-mono">~{item.estimatedMinutes} min</span>
                          )}
                          {typeof item.progressPercent === "number" && item.progressPercent > 0 && item.status !== "COMPLETED" && (
                            <span className="text-xs text-mist-400 font-mono">{item.progressPercent}%</span>
                          )}
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}

function groupByModule(items: LearningPathItem[]) {
  const byModule = new Map<string, { name: string; order: number; items: LearningPathItem[] }>();
  items.forEach((item) => {
    const name = item.skill.module || "General";
    const order = item.skill.moduleOrder ?? 0;
    if (!byModule.has(name)) byModule.set(name, { name, order, items: [] });
    byModule.get(name)!.items.push(item);
  });
  return Array.from(byModule.values()).sort((a, b) => a.order - b.order);
}
