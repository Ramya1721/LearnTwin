import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui";

const EXAMPLE_GOALS = [
  "Python",
  "Machine Learning",
  "Data Structures & Algorithms",
  "Web Development",
  "Cybersecurity",
  "Digital Marketing",
];

export default function Onboarding() {
  const { setOnboarded } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("Beginner");
  const [availableHoursPerWeek, setAvailableHoursPerWeek] = useState(10);
  const [preferredLearningStyle, setPreferredLearningStyle] = useState("Visual");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [theoryPreference, setTheoryPreference] = useState("Medium");
  const [practicalPreference, setPracticalPreference] = useState("High");
  const [sessionPreference, setSessionPreference] = useState("Short focused sessions");
  const [revisionRequirement, setRevisionRequirement] = useState("Medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToStep2(e?: FormEvent) {
    e?.preventDefault();
    if (!goal.trim()) {
      setError("Tell us what you'd like to learn first.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.put("/profile", {
        careerGoal: goal.trim(),
        experienceLevel,
        availableHoursPerWeek,
        preferredLearningStyle,
        preferredLanguage,
        theoryPreference,
        practicalPreference,
        sessionPreference,
        revisionRequirement,
        problemSolvingStrength: "Developing",
      });
      setOnboarded(true);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Something went wrong saving your profile.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-graphite-950 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold text-mist-50">Let's build your Digital Twin</h1>
          <p className="text-mist-400 text-sm mt-1">Step {step} of 2</p>
        </div>

        <form onSubmit={step === 1 ? goToStep2 : handleSubmit} className="bg-graphite-800/60 border border-graphite-600 rounded-xl p-7 shadow-panel space-y-6">
          {step === 1 && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-mist-300 mb-1.5 block">
                  What do you want to learn? Any topic — be as specific as you like.
                </span>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Machine Learning, Java, Digital Marketing, SQL…"
                  autoFocus
                  className="w-full bg-graphite-900 border border-graphite-600 rounded-lg px-3 py-2.5 text-sm text-mist-50 outline-none focus:border-signal-dim"
                />
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {EXAMPLE_GOALS.map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => setGoal(g)}
                      className="px-2.5 py-1 rounded-full text-xs bg-graphite-700 text-mist-300 hover:bg-graphite-600 hover:text-mist-100 transition-colors"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </label>
              <SelectField
                label="Current experience level with this topic"
                value={experienceLevel}
                onChange={setExperienceLevel}
                options={["Beginner", "Beginner-Intermediate", "Intermediate", "Advanced"]}
              />
              <label className="block">
                <span className="text-xs font-medium text-mist-300 mb-1.5 block">Available hours per week</span>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={availableHoursPerWeek}
                  onChange={(e) => setAvailableHoursPerWeek(Number(e.target.value))}
                  className="w-full bg-graphite-900 border border-graphite-600 rounded-lg px-3 py-2.5 text-sm text-mist-50 outline-none focus:border-signal-dim"
                />
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <SelectField
                label="Preferred learning format"
                value={preferredLearningStyle}
                onChange={setPreferredLearningStyle}
                options={["Visual", "Reading", "Hands-on", "Interactive", "Project-based"]}
              />
              <SelectField
                label="Preferred learning language"
                value={preferredLanguage}
                onChange={setPreferredLanguage}
                options={["English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam"]}
              />
              <SelectField
                label="Theory vs. practical preference"
                value={theoryPreference}
                onChange={setTheoryPreference}
                options={["Low", "Medium", "High"]}
              />
              <SelectField
                label="Practical preference"
                value={practicalPreference}
                onChange={setPracticalPreference}
                options={["Low", "Medium", "High"]}
              />
              <SelectField
                label="Preferred session length"
                value={sessionPreference}
                onChange={setSessionPreference}
                options={["Short focused sessions", "Medium sessions", "Long deep-work sessions"]}
              />
              <SelectField
                label="How often do you like to revise?"
                value={revisionRequirement}
                onChange={setRevisionRequirement}
                options={["Low", "Medium", "High"]}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Creating your twin…" : "Create my Digital Twin"}
                </Button>
              </div>
              <p className="text-xs text-mist-500 font-mono">
                Note: LearnTwin will also watch your actual behavior and quietly correct this profile if it
                doesn't match how you really learn.
              </p>
            </>
          )}
        </form>
      </div>
    </div>
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
