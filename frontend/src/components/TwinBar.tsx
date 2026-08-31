/**
 * TwinBar — LearnTwin's signature visualization.
 * A single skill is shown as two mirrored bars growing outward from a
 * center axis: the top bar is the learner's raw activity/consumption
 * signal, the bottom bar is the Digital Twin's inferred true proficiency.
 * When they diverge, that gap IS the insight (e.g. "lots of videos,
 * low real proficiency").
 */
export function TwinBar({
  label,
  proficiency,
  signal,
  accent = "signal",
}: {
  label: string;
  proficiency: number; // 0-100, twin's assessed truth
  signal: number; // 0-100, raw activity/consumption volume, normalized
  accent?: "signal" | "twin" | "alert";
}) {
  const colorClass =
    accent === "alert" ? "bg-alert" : accent === "twin" ? "bg-twin" : "bg-signal";

  return (
    <div className="group">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-mist-100 font-medium">{label}</span>
        <span className="text-xs font-mono text-mist-300">{proficiency}%</span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 top-1/2 h-px axis-line" />
        <div className="w-1/2 flex justify-end pr-0.5">
          <div
            className="h-1.5 rounded-l bg-mist-500/40 transition-all duration-500"
            style={{ width: `${Math.min(100, signal)}%`, maxWidth: "100%" }}
          />
        </div>
        <div className="w-1/2 flex justify-start pl-0.5">
          <div
            className={`h-1.5 rounded-r ${colorClass} transition-all duration-500`}
            style={{ width: `${Math.min(100, proficiency)}%`, maxWidth: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
