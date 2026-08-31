import { FormEvent, useEffect, useState } from "react";
import { Dumbbell, Video, FileText, Rocket, RotateCcw } from "lucide-react";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Card, Button, LoadingBlock, EmptyState, Badge } from "../components/ui";
import { UserSkill } from "../types";

const ACTIVITY_TYPES = [
  { value: "VIDEO", label: "Video", icon: Video },
  { value: "ARTICLE", label: "Article", icon: FileText },
  { value: "PRACTICE", label: "Practice exercise", icon: Dumbbell },
  { value: "PROJECT", label: "Project", icon: Rocket },
  { value: "REVISION", label: "Revision", icon: RotateCcw },
];

export default function PracticeHubPage() {
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillId, setSkillId] = useState("");
  const [activityType, setActivityType] = useState("PRACTICE");
  const [duration, setDuration] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [newBottlenecks, setNewBottlenecks] = useState<any[]>([]);

  function load() {
    Promise.all([api.get("/skills/user-skills"), api.get("/activities")]).then(([us, act]) => {
      setUserSkills(us.data.userSkills);
      setActivities(act.data.activities);
      if (!skillId && us.data.userSkills[0]) setSkillId(us.data.userSkills[0].skillId);
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function logActivity(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setNewBottlenecks([]);
    try {
      const res = await api.post("/activities", { skillId, activityType, duration });
      setNewBottlenecks(res.data.bottlenecks || []);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Practice Hub">
        <LoadingBlock />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Practice Hub" subtitle="Log practical activity — this is what the Bottleneck Detector watches closest.">
      <div className="grid lg:grid-cols-3 gap-6">
        <Card title="Log an activity" eyebrow="Practice tracker" className="lg:col-span-1">
          <form onSubmit={logActivity} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-mist-300 mb-1.5 block">Skill</span>
              <select
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                className="w-full bg-graphite-900 border border-graphite-600 rounded-lg px-3 py-2.5 text-sm text-mist-50 outline-none focus:border-signal-dim"
              >
                {userSkills.map((us) => (
                  <option key={us.skillId} value={us.skillId}>
                    {us.skill.name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-xs font-medium text-mist-300 mb-1.5 block">Activity type</span>
              <div className="grid grid-cols-2 gap-2">
                {ACTIVITY_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setActivityType(value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      activityType === value
                        ? "border-signal-dim/60 bg-signal-soft text-signal"
                        : "border-graphite-600 text-mist-300 hover:bg-graphite-700/60"
                    }`}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-mist-300 mb-1.5 block">Duration (minutes)</span>
              <input
                type="number"
                min={5}
                max={240}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-graphite-900 border border-graphite-600 rounded-lg px-3 py-2.5 text-sm text-mist-50 outline-none focus:border-signal-dim"
              />
            </label>

            <Button type="submit" className="w-full" disabled={submitting || !skillId}>
              {submitting ? "Logging…" : "Log activity"}
            </Button>
          </form>

          {newBottlenecks.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-wide text-mist-400 font-mono">Just detected</p>
              {newBottlenecks.map((b) => (
                <div key={b.id} className="p-3 rounded-lg bg-alert-soft border border-alert/20 text-xs text-mist-100">
                  <span className="font-medium">{b.type.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent activity" eyebrow={`${activities.length} logged`} className="lg:col-span-2">
          {activities.length === 0 ? (
            <EmptyState title="No activity yet" description="Log your first video, article, or practice session." />
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {activities.map((a) => {
                const meta = ACTIVITY_TYPES.find((t) => t.value === a.activityType);
                const Icon = meta?.icon || Dumbbell;
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-graphite-900/60 border border-graphite-700"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={15} className="text-mist-400" />
                      <div>
                        <p className="text-sm text-mist-100">{a.skill?.name || "General"}</p>
                        <p className="text-xs text-mist-500">{new Date(a.completedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{a.activityType}</Badge>
                      <span className="text-xs font-mono text-mist-400">{a.duration}m</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
