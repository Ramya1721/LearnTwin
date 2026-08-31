import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw, GitBranch } from "lucide-react";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Card, Button, LoadingBlock, EmptyState } from "../components/ui";
import { PathCorrection } from "../types";

export default function PathCorrectionsPage() {
  const [corrections, setCorrections] = useState<PathCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [noCorrectionMessage, setNoCorrectionMessage] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get("/path-corrections")
      .then((res) => setCorrections(res.data.corrections))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function analyze() {
    setAnalyzing(true);
    setNoCorrectionMessage(null);
    try {
      const res = await api.post("/path-corrections/analyze");
      if (!res.data.correction) {
        setNoCorrectionMessage("No correction needed right now — your recent scores don't indicate a foundational gap.");
      }
      load();
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <DashboardLayout
      title="Path Corrections"
      subtitle="Every self-correction, with the reasoning behind it."
      action={
        <Button onClick={analyze} disabled={analyzing}>
          <span className="flex items-center gap-2">
            <RefreshCw size={14} className={analyzing ? "animate-spin" : ""} />
            {analyzing ? "Analyzing…" : "Check for corrections"}
          </span>
        </Button>
      }
    >
      {noCorrectionMessage && (
        <div className="mb-5 p-3 rounded-lg bg-graphite-800 border border-graphite-600 text-sm text-mist-300">
          {noCorrectionMessage}
        </div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : corrections.length === 0 ? (
        <Card>
          <EmptyState
            title="No corrections yet"
            description="When repeated failures point to a weak prerequisite, LearnTwin will rewrite your path here — with an explanation."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {corrections.map((c) => {
            const oldNames = new Set(c.oldPath.map((p) => p.name));
            const newNames = c.newPath.map((p) => p.name);
            const addedInNew = new Set(newNames.filter((n) => !oldNames.has(n)));
            return (
              <Card key={c.id}>
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch size={16} className="text-twin" />
                  <p className="text-xs text-mist-500 font-mono">{new Date(c.createdAt).toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg bg-twin-soft border border-twin-dim/30 mb-5">
                  <p className="text-sm font-semibold text-twin mb-1">Why did this change?</p>
                  <p className="text-sm text-mist-200 leading-relaxed">{c.reason}</p>
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wide text-mist-400 mb-3">Original path</p>
                    <PathList items={c.oldPath.map((p) => p.name)} />
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wide text-mist-400 mb-3">AI-adapted path</p>
                    <PathList items={newNames} highlightSet={addedInNew} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

function PathList({ items, highlightSet }: { items: string[]; highlightSet?: Set<string> }) {
  return (
    <ol className="space-y-2">
      {items.map((item, idx) => {
        const isNew = highlightSet?.has(item);
        return (
          <li
            key={`${item}-${idx}`}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg font-mono ${
              isNew ? "bg-signal-soft text-signal border border-signal-dim/40" : "bg-graphite-700/60 text-mist-200"
            }`}
          >
            {idx > 0 && <ArrowRight size={12} className="text-mist-500 shrink-0" />}
            {item}
          </li>
        );
      })}
    </ol>
  );
}
