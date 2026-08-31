import { useEffect, useState } from "react";
import { RefreshCw, Fingerprint } from "lucide-react";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Card, Badge, LoadingBlock, Button } from "../components/ui";
import { TwinBar } from "../components/TwinBar";
import { DigitalTwinView } from "../types";

export default function DigitalTwinPage() {
  const [twin, setTwin] = useState<DigitalTwinView | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  function load() {
    setLoading(true);
    api
      .get("/digital-twin")
      .then((res) => setTwin(res.data.twin))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function reconcile() {
    setReconciling(true);
    try {
      const res = await api.post("/digital-twin/update");
      setTwin(res.data.twin);
    } finally {
      setReconciling(false);
    }
  }

  if (loading || !twin) {
    return (
      <DashboardLayout title="Learner Digital Twin">
        <LoadingBlock />
      </DashboardLayout>
    );
  }

  const dna = twin.learningDna;

  return (
    <DashboardLayout
      title="Learner Digital Twin"
      subtitle="A continuously updated mirror of how you actually learn."
      action={
        <Button variant="secondary" onClick={reconcile} disabled={reconciling}>
          <span className="flex items-center gap-2">
            <RefreshCw size={14} className={reconciling ? "animate-spin" : ""} />
            {reconciling ? "Reconciling…" : "Reconcile from behavior"}
          </span>
        </Button>
      }
    >
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card title="Identity" eyebrow="Twin core" className="lg:col-span-1">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-twin-soft border border-twin-dim/40 flex items-center justify-center">
              <Fingerprint size={20} className="text-twin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-mist-50">{twin.goal}</p>
              <p className="text-xs text-mist-400">Career goal</p>
            </div>
          </div>
          <dl className="space-y-3 text-sm">
            <DL label="Learning style" value={dna?.learningStyle || "—"} />
            <DL label="Theory preference" value={dna?.theoryPreference || "—"} />
            <DL label="Practical preference" value={dna?.practicalPreference || "—"} />
            <DL label="Revision requirement" value={dna?.revisionRequirement || "—"} />
            <DL label="Problem solving" value={dna?.problemSolvingStrength || "—"} />
          </dl>
          {dna?.inferredNote && (
            <div className="mt-4 p-3 rounded-lg bg-twin-soft border border-twin-dim/30 text-xs text-mist-200 leading-relaxed">
              <span className="text-twin font-semibold">Behavior override: </span>
              {dna.inferredNote}
            </div>
          )}
        </Card>

        <Card title="Signal vs. Twin-Assessed Proficiency" eyebrow="Consumption vs. mastery" className="lg:col-span-2">
          <p className="text-xs text-mist-400 mb-5">
            Top bar (grey) is raw content-consumption signal. Bottom bar (colored) is the twin's inferred true
            proficiency. A wide gap between them is exactly what the Bottleneck Detector flags.
          </p>
          <div className="space-y-4">
            {twin.skills.slice(0, 8).map((s) => {
              const consumptionProxy = Math.min(100, s.proficiency + (dna?.contentConsumptionScore ?? 50) / 2);
              return (
                <TwinBar
                  key={s.skillId}
                  label={s.name}
                  proficiency={s.proficiency}
                  signal={consumptionProxy}
                  accent={s.proficiency < 40 ? "alert" : "twin"}
                />
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card title="Strengths" eyebrow="Detected">
          <div className="flex flex-wrap gap-2">
            {twin.strengths.map((s) => (
              <Badge key={s} tone="signal">
                {s}
              </Badge>
            ))}
          </div>
        </Card>
        <Card title="Weaknesses" eyebrow="Detected">
          {twin.weaknesses.length ? (
            <div className="flex flex-wrap gap-2">
              {twin.weaknesses.map((w) => (
                <Badge key={w} tone="alert">
                  {w}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-mist-400">None flagged right now.</p>
          )}
        </Card>
        <Card title="Behavior scores" eyebrow="0–100">
          <dl className="space-y-2 text-sm">
            <DL label="Consistency" value={`${dna?.consistencyScore ?? "—"}`} />
            <DL label="Content consumption" value={`${dna?.contentConsumptionScore ?? "—"}`} />
            <DL label="Application rate" value={`${dna?.applicationRateScore ?? "—"}`} />
          </dl>
        </Card>
      </div>

      <Card title="Twin Insight" eyebrow="AI-generated, grounded in your data">
        <p className="text-sm text-mist-200 leading-relaxed">{twin.insight}</p>
      </Card>
    </DashboardLayout>
  );
}

function DL({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-mist-400 text-xs">{label}</dt>
      <dd className="text-mist-100 font-medium">{value}</dd>
    </div>
  );
}
