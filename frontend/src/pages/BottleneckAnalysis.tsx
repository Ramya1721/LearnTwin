import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Card, SeverityBadge, Button, LoadingBlock, EmptyState } from "../components/ui";
import { Bottleneck } from "../types";

const RECOMMENDATION_BY_TYPE: Record<string, string> = {
  PASSIVE_LEARNING: "Pause new theoretical content and complete a few practice challenges before continuing.",
  THEORY_PRACTICE_IMBALANCE: "Rebalance toward hands-on exercises — aim for closer to 50/50 theory vs. practice.",
  FOUNDATION_GAP: "Revisit the flagged prerequisite skill before continuing to advanced material.",
  DIFFICULTY_MISMATCH: "Step back to intermediate-level content that matches your current proficiency.",
  CONSISTENCY_BOTTLENECK: "Switch to shorter, more frequent sessions to rebuild a consistent streak.",
  REVISION_BOTTLENECK: "Schedule a revision checkpoint across the skills you've moved past recently.",
};

export default function BottleneckAnalysisPage() {
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  function load() {
    setLoading(true);
    api
      .get("/bottlenecks")
      .then((res) => setBottlenecks(res.data.bottlenecks))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function analyze() {
    setAnalyzing(true);
    try {
      await api.post("/bottlenecks/analyze");
      load();
    } finally {
      setAnalyzing(false);
    }
  }

  const active = bottlenecks.filter((b) => b.status === "ACTIVE");
  const resolved = bottlenecks.filter((b) => b.status !== "ACTIVE");

  return (
    <DashboardLayout
      title="Bottleneck Analysis"
      subtitle="Rule-based detection of learning behavior patterns — not just marks."
      action={
        <Button onClick={analyze} disabled={analyzing}>
          <span className="flex items-center gap-2">
            <RefreshCw size={14} className={analyzing ? "animate-spin" : ""} />
            {analyzing ? "Analyzing…" : "Re-analyze now"}
          </span>
        </Button>
      }
    >
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <Card title="Active bottlenecks" eyebrow={`${active.length} detected`}>
            {active.length === 0 ? (
              <EmptyState title="No active bottlenecks" description="Your learning behavior looks healthy right now." />
            ) : (
              <div className="space-y-3">
                {active.map((b) => (
                  <div key={b.id} className="p-4 rounded-lg bg-alert-soft border border-alert/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={18} className="text-alert shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-sm font-semibold text-mist-50">{b.type.replace(/_/g, " ")}</p>
                          <SeverityBadge severity={b.severity} />
                        </div>
                        <p className="text-sm text-mist-200 leading-relaxed mb-2">{b.description}</p>
                        <p className="text-xs text-mist-400">
                          <span className="text-mist-300 font-medium">Recommended action: </span>
                          {RECOMMENDATION_BY_TYPE[b.type] || "Review this pattern in your Learning Path."}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {resolved.length > 0 && (
            <Card title="Resolved / historical" eyebrow={`${resolved.length}`}>
              <div className="space-y-2">
                {resolved.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-graphite-900/60 border border-graphite-700 text-sm">
                    <span className="text-mist-300">{b.type.replace(/_/g, " ")}</span>
                    <span className="text-xs text-mist-500">{new Date(b.detectedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
