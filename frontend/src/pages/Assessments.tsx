import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClipboardCheck, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Card, Badge, Button, LoadingBlock, EmptyState } from "../components/ui";

interface AssessmentSummary {
  id: string;
  title: string;
  difficulty: string;
  skill: { id: string; name: string };
}
interface Question {
  id: string;
  question: string;
  options: string[];
}

export default function AssessmentsPage() {
  const location = useLocation();
  const deepLink = (location.state as { assessmentId?: string; returnToItemId?: string } | null) || null;
  const [domains, setDomains] = useState<string[]>([]);
  const [domain, setDomain] = useState<string>("");
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(deepLink?.assessmentId || null);

  useEffect(() => {
    api.get("/skills/domains").then((res) => {
      const list: string[] = res.data.domains || [];
      setDomains(list);
      if (list.length > 0) setDomain(list[0]);
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    api
      .get("/assessments", { params: { domain } })
      .then((res) => setAssessments(res.data.assessments))
      .finally(() => setLoading(false));
  }, [domain]);

  if (activeId) {
    return (
      <QuizRunner assessmentId={activeId} onExit={() => setActiveId(null)} returnToItemId={deepLink?.returnToItemId} />
    );
  }

  return (
    <DashboardLayout title="Assessments" subtitle="Skill checks feed directly into your Digital Twin and learning path.">
      {domains.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => setDomain(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                domain === d ? "bg-signal-soft text-signal border border-signal-dim/40" : "bg-graphite-800 text-mist-300 border border-graphite-600 hover:bg-graphite-700"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : assessments.length === 0 ? (
        <Card>
          <EmptyState
            title="No assessments yet"
            description={domains.length === 0 ? "Complete onboarding to generate your learning path and quizzes." : "No assessments found for this topic."}
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {assessments.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-twin-soft flex items-center justify-center shrink-0">
                    <ClipboardCheck size={16} className="text-twin" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-mist-50">{a.title}</p>
                    <p className="text-xs text-mist-400 mt-0.5">{a.skill.name}</p>
                  </div>
                </div>
                <Badge tone={a.difficulty === "ADVANCED" ? "alert" : a.difficulty === "INTERMEDIATE" ? "twin" : "signal"}>
                  {a.difficulty}
                </Badge>
              </div>
              <Button className="w-full mt-4" variant="secondary" onClick={() => setActiveId(a.id)}>
                Start assessment
              </Button>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

function QuizRunner({
  assessmentId,
  onExit,
  returnToItemId,
}: {
  assessmentId: string;
  onExit: () => void;
  returnToItemId?: string;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [skillName, setSkillName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    api.get(`/assessments/${assessmentId}`).then((res) => {
      setTitle(res.data.assessment.title);
      setSkillName(res.data.assessment.skill.name);
      setQuestions(res.data.assessment.questions);
      setLoading(false);
    });
  }, [assessmentId]);

  async function submit() {
    setSubmitting(true);
    try {
      const payload = { answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })) };
      const res = await api.post(`/assessments/${assessmentId}/submit`, payload);
      setResult(res.data);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Assessment">
        <LoadingBlock />
      </DashboardLayout>
    );
  }

  if (result) {
    return (
      <DashboardLayout title="Assessment Result">
        <Card title={`${skillName} — Result`} eyebrow={title}>
          <div className="flex items-center gap-4 mb-6">
            {result.score >= 60 ? (
              <CheckCircle2 size={32} className="text-signal" />
            ) : (
              <XCircle size={32} className="text-danger" />
            )}
            <div>
              <p className="text-3xl font-display font-bold text-mist-50">{result.score}%</p>
              <p className="text-xs text-mist-400">
                Proficiency updated: {result.before}% → {result.after}%
              </p>
            </div>
          </div>

          {result.bottlenecks?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-mist-400 mb-2 font-mono">Bottlenecks detected</p>
              <div className="space-y-2">
                {result.bottlenecks.map((b: any) => (
                  <div key={b.id} className="p-3 rounded-lg bg-alert-soft border border-alert/20 text-sm text-mist-100">
                    <span className="font-medium">{b.type.replace(/_/g, " ")}</span> — {b.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.weakConcepts?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-mist-400 mb-2 font-mono">Your performance suggests you need more practice with</p>
              <div className="flex flex-wrap gap-2">
                {result.weakConcepts.map((w: any) => (
                  <span key={w.concept} className="px-3 py-1.5 rounded-lg text-sm bg-alert-soft border border-alert/20 text-mist-100">
                    {w.concept} <span className="text-mist-400">({w.accuracy}%)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.pathCorrection && (
            <div className="mb-4 p-4 rounded-lg bg-twin-soft border border-twin-dim/30">
              <p className="text-sm font-semibold text-twin mb-1">Your learning path was corrected</p>
              <p className="text-sm text-mist-200 leading-relaxed">{result.pathCorrection.reason}</p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            {returnToItemId ? (
              <Button onClick={() => navigate(`/learning-path/${returnToItemId}`)}>Back to topic</Button>
            ) : (
              <Button onClick={onExit}>Back to assessments</Button>
            )}
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  const allAnswered = questions.every((q) => answers[q.id]);

  return (
    <DashboardLayout title={title} subtitle={skillName}>
      <button onClick={onExit} className="flex items-center gap-1.5 text-sm text-mist-400 hover:text-mist-100 mb-5">
        <ArrowLeft size={14} /> Back
      </button>
      <div className="space-y-5">
        {questions.map((q, idx) => (
          <Card key={q.id}>
            <p className="text-sm font-medium text-mist-50 mb-4">
              {idx + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                    answers[q.id] === opt
                      ? "border-signal-dim/60 bg-signal-soft text-signal"
                      : "border-graphite-600 text-mist-200 hover:bg-graphite-700/60"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    className="hidden"
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </Card>
        ))}
        <Button onClick={submit} disabled={!allAnswered || submitting} className="w-full">
          {submitting ? "Submitting…" : "Submit assessment"}
        </Button>
      </div>
    </DashboardLayout>
  );
}
