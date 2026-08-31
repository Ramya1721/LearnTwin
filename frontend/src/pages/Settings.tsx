import { useEffect, useState } from "react";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Card, Button, LoadingBlock } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get("/profile")
      .then((res) => setProfile(res.data.profile))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await api.put("/profile", {
        careerGoal: profile.careerGoal,
        experienceLevel: profile.experienceLevel,
        availableHoursPerWeek: profile.availableHoursPerWeek,
        preferredLearningStyle: profile.preferredLearningStyle,
        preferredLanguage: profile.preferredLanguage || "English",
        theoryPreference: profile.theoryPreference || "Medium",
        practicalPreference: profile.practicalPreference || "High",
        sessionPreference: profile.sessionPreference || "Short focused sessions",
        revisionRequirement: profile.revisionRequirement || "Medium",
        problemSolvingStrength: profile.problemSolvingStrength || "Developing",
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return (
      <DashboardLayout title="Settings">
        <LoadingBlock />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settings" subtitle="Manage your account and profile.">
      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Account" eyebrow="Read-only">
          <div className="space-y-3 text-sm">
            <Row label="Name" value={user?.name || ""} />
            <Row label="Email" value={user?.email || ""} />
          </div>
          <Button variant="secondary" className="w-full mt-6" onClick={logout}>
            Log out
          </Button>
        </Card>

        <Card title="Learning Profile" eyebrow="Editable">
          <div className="space-y-4">
            <Field label="Career goal" value={profile.careerGoal} onChange={(v) => setProfile({ ...profile, careerGoal: v })} />
            <p className="text-xs text-mist-500 -mt-2">
              Changing this regenerates your learning path for the new topic. Your progress on other topics is kept in
              your activity history.
            </p>
            <SelectField
              label="Experience level"
              value={profile.experienceLevel}
              onChange={(v) => setProfile({ ...profile, experienceLevel: v })}
              options={["Beginner", "Beginner-Intermediate", "Intermediate", "Advanced"]}
            />
            <Field
              label="Available hours / week"
              type="number"
              value={String(profile.availableHoursPerWeek)}
              onChange={(v) => setProfile({ ...profile, availableHoursPerWeek: Number(v) })}
            />
            <SelectField
              label="Preferred learning format"
              value={profile.preferredLearningStyle}
              onChange={(v) => setProfile({ ...profile, preferredLearningStyle: v })}
              options={["Visual", "Reading", "Hands-on", "Interactive", "Project-based"]}
            />
            <SelectField
              label="Preferred learning language"
              value={profile.preferredLanguage || "English"}
              onChange={(v) => setProfile({ ...profile, preferredLanguage: v })}
              options={["English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam"]}
            />
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
            </Button>
            <p className="text-xs text-mist-500 leading-relaxed">
              Note: saving here regenerates your active learning path from the current skill graph. Your
              proficiency history and Digital Twin insights are preserved.
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-mist-400 text-xs">{label}</span>
      <span className="text-mist-100 font-medium">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-mist-300 mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-graphite-900 border border-graphite-600 rounded-lg px-3 py-2.5 text-sm text-mist-50 outline-none focus:border-signal-dim"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-mist-300 mb-1.5 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-graphite-900 border border-graphite-600 rounded-lg px-3 py-2.5 text-sm text-mist-50 outline-none focus:border-signal-dim"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
