import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle2, Circle, ClipboardCheck, FileText, ListChecks, Lock, PlayCircle, Zap } from "lucide-react";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Badge, Button, Card, LoadingBlock } from "../components/ui";
import { YouTubeLearningPlayer } from "../components/YouTubeLearningPlayer";
import { LearningSessionView, TopicDetail as TopicDetailType } from "../types";

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60];

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function TopicDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<TopicDetailType | null>(null);
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<LearningSessionView | null>(null);
  const [browseAll, setBrowseAll] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const autoStartHandled = useRef(false);

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setLockedReason(null);
    try {
      const res = await api.get(`/learning-path/${itemId}`);
      setDetail(res.data);
      setSession(res.data.activeSession);
    } catch (err: any) {
      if (err?.response?.status === 403) setLockedReason(err.response.data?.lockedReason || "This topic is locked.");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => { void load(); }, [load]);

  const startSession = useCallback(async (targetMinutes: number) => {
    if (!itemId) return;
    try {
      const res = await api.post(`/learning-path/${itemId}/session`, { targetMinutes });
      setSession(res.data.session);
      setBrowseAll(false);
    } catch (err: any) {
      setCompleteError(err?.response?.data?.error || "Couldn't start the learning session.");
    }
  }, [itemId]);

  useEffect(() => {
    if (autoStartHandled.current || !detail || session) return;
    const duration = Number(searchParams.get("duration"));
    if (duration > 0) {
      autoStartHandled.current = true;
      void startSession(Math.min(240, Math.max(1, duration)));
    }
  }, [detail, searchParams, session, startSession]);

  const videoResource = useMemo(
    () => detail?.resources.find((r) => r.type === "VIDEO" && r.youtubeVideoId) || null,
    [detail?.resources]
  );

  function updateResourceFromProgress(resourceId: string, result: any) {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        item: { ...prev.item, progressPercent: result.itemProgressPercent ?? prev.item.progressPercent },
        resources: prev.resources.map((r) =>
          r.id === resourceId
            ? {
                ...r,
                progress: result.resourceProgress?.progress ?? r.progress,
                percentageWatched: result.resourceProgress?.percentageWatched ?? r.percentageWatched,
                currentTimeSeconds: result.resourceProgress?.currentTimeSeconds ?? r.currentTimeSeconds,
                completed: result.resourceProgress?.completed ?? r.completed,
              }
            : r
        ),
      };
    });
  }

  async function completeTopic() {
    if (!itemId) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      await api.post(`/learning-path/${itemId}/complete`);
      setJustCompleted(true);
      await load();
    } catch (err: any) {
      setCompleteError(err?.response?.data?.error || "Finish the required video, checkpoints, and final quiz first.");
      await load();
    } finally {
      setCompleting(false);
    }
  }

  if (loading) return <DashboardLayout title="Topic"><LoadingBlock /></DashboardLayout>;

  if (lockedReason) {
    return (
      <DashboardLayout title="Topic locked">
        <Card>
          <div className="flex items-start gap-3">
            <Lock size={20} className="text-mist-400 mt-0.5" />
            <div>
              <p className="text-mist-100 font-medium mb-1">This topic isn't available yet</p>
              <p className="text-sm text-mist-400">{lockedReason}</p>
            </div>
          </div>
          <Button className="mt-5" variant="secondary" onClick={() => navigate("/learning-path")}>
            <span className="inline-flex items-center gap-1.5"><ArrowLeft size={14} /> Back to learning path</span>
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  if (!detail) return <DashboardLayout title="Topic"><Card><p className="text-mist-400 text-sm">Couldn't load this topic.</p></Card></DashboardLayout>;

  const { item, resources, assessment, requirements, estimatedMinutes, weakConcepts } = detail;
  const allSatisfied = requirements.length > 0 && requirements.every((r) => r.satisfied);
  const isCompleted = item.status === "COMPLETED" || justCompleted;
  const activeSessionVideo = session?.status === "ACTIVE" && session.videoResourceId ? resources.find((r) => r.id === session.videoResourceId) : null;

  return (
    <DashboardLayout title={item.skill.name} subtitle={item.skill.description}>
      <button onClick={() => navigate("/learning-path")} className="flex items-center gap-1.5 text-sm text-mist-400 hover:text-mist-100 mb-5">
        <ArrowLeft size={14} /> Back to learning path
      </button>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Badge tone="default">~{formatMinutes(estimatedMinutes)} total</Badge>
        <Badge tone={item.skill.difficulty === "ADVANCED" ? "alert" : item.skill.difficulty === "INTERMEDIATE" ? "twin" : "signal"}>{item.skill.difficulty}</Badge>
        {videoResource && <Badge tone="default"><PlayCircle size={12} /> Real YouTube lesson</Badge>}
      </div>

      {(item.skill.prerequisites?.length || 0) > 0 && (
        <Card className="mb-6" eyebrow="Prerequisites" title="What this topic builds on">
          <div className="flex flex-wrap gap-2">
            {item.skill.prerequisites!.map((p) => <Badge key={p.id} tone="default">{p.name}</Badge>)}
          </div>
        </Card>
      )}

      {justCompleted && (
        <Card className="mb-5 border-signal-dim/40 bg-signal-soft/30">
          <div className="flex items-center gap-3"><CheckCircle2 size={20} className="text-signal" /><div><p className="text-sm font-semibold text-signal">Topic completed</p><p className="text-xs text-mist-300 mt-0.5">The next topic in your path is now available.</p></div></div>
        </Card>
      )}

      {weakConcepts.length > 0 && !isCompleted && (
        <Card className="mb-5 border-alert/30 bg-alert-soft/20">
          <div className="flex items-start gap-3"><AlertTriangle size={18} className="text-alert mt-0.5 shrink-0" /><div><p className="text-sm font-semibold text-alert mb-1">Needs more practice</p><div className="flex flex-wrap gap-1.5">{weakConcepts.map((w) => <Badge key={w.concept} tone="alert">{w.concept}</Badge>)}</div></div></div>
        </Card>
      )}

      {!isCompleted && !session && !browseAll && <DurationPicker onSelect={startSession} onBrowseAll={() => setBrowseAll(true)} />}

      {!isCompleted && activeSessionVideo && (
        <Card className="mb-6" eyebrow="Focused learning session" title={`${session?.targetMinutes} minute target`} action={<Zap size={18} className="text-twin" />}>
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <Badge tone="twin">Resume: {formatTime(activeSessionVideo.currentTimeSeconds)}</Badge>
            {session?.targetEndTimeSeconds != null && <Badge tone="default">Session boundary: {formatTime(session.targetEndTimeSeconds)}</Badge>}
          </div>
          <YouTubeLearningPlayer
            resource={activeSessionVideo}
            itemId={item.id}
            session={session}
            onProgressSaved={(result) => updateResourceFromProgress(activeSessionVideo.id, result)}
            onSessionCompleted={(completedSession) => { setSession(completedSession); void load(); }}
          />
          <div className="mt-4 flex justify-between gap-3 border-t border-graphite-700 pt-4">
            <Button variant="ghost" onClick={() => setSession(null)}>Change duration</Button>
            <Button variant="secondary" onClick={() => setBrowseAll(true)}>Browse full topic</Button>
          </div>
        </Card>
      )}

      {!isCompleted && session?.status === "COMPLETED" && (
        <Card className="mb-6 border-signal-dim/40 bg-signal-soft/20">
          <div className="flex items-center gap-3 mb-3"><CheckCircle2 size={22} className="text-signal" /><div><p className="text-sm font-semibold text-signal">Session complete 🎉</p><p className="text-xs text-mist-300">Your exact YouTube position has been saved.</p></div></div>
          <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => setSession(null)}>Start another session</Button><Button variant="ghost" onClick={() => setBrowseAll(true)}>Browse full topic</Button></div>
        </Card>
      )}

      {(browseAll || isCompleted) && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {resources.map((resource) => resource.type === "VIDEO" && resource.youtubeVideoId ? (
              <Card key={resource.id} eyebrow="Video lesson" title={resource.title} action={<PlayCircle size={18} className="text-twin" />}>
                <div className="mb-3 flex items-center gap-2"><div className="flex-1 h-1.5 rounded-full bg-graphite-700 overflow-hidden"><div className="h-full rounded-full bg-twin" style={{ width: `${resource.percentageWatched}%` }} /></div><span className="text-xs font-mono text-mist-400">{resource.percentageWatched}%</span></div>
                <YouTubeLearningPlayer resource={resource} itemId={item.id} onProgressSaved={(result) => updateResourceFromProgress(resource.id, result)} />
                {resource.segments.length > 0 && (
                  <div className="mt-4 rounded-lg border border-graphite-700 bg-graphite-900/50 p-3">
                    <p className="text-xs font-medium text-mist-300 mb-2">Transcript-derived segments</p>
                    <div className="space-y-1.5">
                      {resource.segments.map((segment) => (
                        <div key={segment.id} className="w-full flex items-center gap-3 text-left text-xs text-mist-400">
                          <span className="font-mono text-mist-500 w-12 shrink-0">{formatTime(segment.startSeconds)}</span>
                          <span className="truncate">{segment.title}</span>
                          <span className="ml-auto font-mono text-mist-500">{formatTime(segment.endSeconds - segment.startSeconds)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {resource.checkpoints.length === 0 && <p className="text-xs text-mist-500 mt-3">No usable public transcript was available for this video, so LearnTwin did not generate video-specific checkpoint questions.</p>}
              </Card>
            ) : resource.type === "ARTICLE" ? (
              <ArticleResource key={resource.id} resource={resource} onProgress={(progress) => api.post(`/learning-path/${item.id}/resource-progress`, { resourceId: resource.id, progress }).then((r) => updateResourceFromProgress(resource.id, r.data))} />
            ) : null)}

            {assessment && (
              <Card eyebrow="Final module quiz" title={assessment.title} action={<ClipboardCheck size={18} className="text-twin" />}>
                <p className="text-sm text-mist-400 mb-3">{assessment.questionCount} questions · passing score {assessment.passingScore}%{assessment.bestScore !== null && <> · best attempt <span className="text-mist-100 font-medium">{assessment.bestScore}%</span></>}</p>
                <Button variant={assessment.bestScore !== null && assessment.bestScore >= assessment.passingScore ? "secondary" : "primary"} onClick={() => navigate("/assessments", { state: { assessmentId: assessment.id, returnToItemId: item.id } })}>{assessment.bestScore !== null ? "Retake quiz" : "Take final quiz"}</Button>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card eyebrow="Progress" title="Completion requirements" className="sticky top-8">
              <div className="space-y-3 mb-5">
                {requirements.map((req) => <div key={`${req.type}-${req.id}`} className="flex items-start gap-2.5">{req.satisfied ? <CheckCircle2 size={16} className="text-signal mt-0.5 shrink-0" /> : <Circle size={16} className="text-mist-500 mt-0.5 shrink-0" />}<div><p className={`text-sm ${req.satisfied ? "text-mist-100" : "text-mist-300"}`}>{req.title}</p><p className="text-xs text-mist-500">{req.detail}</p></div></div>)}
              </div>
              {isCompleted ? <Badge tone="signal">Completed</Badge> : <><Button className="w-full" disabled={!allSatisfied || completing} onClick={completeTopic}>{completing ? "Checking…" : "Complete topic"}</Button>{!allSatisfied && <p className="text-xs text-mist-500 mt-2">Complete the required video progress, all available checkpoints, and pass the final quiz.</p>}{completeError && <p className="text-xs text-alert mt-2">{completeError}</p>}</>}
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function DurationPicker({ onSelect, onBrowseAll }: { onSelect: (mins: number) => void; onBrowseAll: () => void }) {
  const [custom, setCustom] = useState("");
  return <Card className="mb-6" eyebrow="Personalized session" title="How much time do you have?" action={<Zap size={18} className="text-twin" />}>
    <div className="flex flex-wrap gap-2 mb-3">{DURATION_OPTIONS.map((m) => <button key={m} onClick={() => onSelect(m)} className="px-3.5 py-2 rounded-lg text-sm font-medium bg-graphite-700 text-mist-100 border border-graphite-600 hover:border-signal-dim/50 hover:bg-graphite-600 transition-colors">⚡ {m} min</button>)}</div>
    <div className="flex flex-wrap items-center gap-2"><input type="number" min={1} max={240} placeholder="Custom minutes" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-40 px-3 py-2 rounded-lg text-sm bg-graphite-900 border border-graphite-600 text-mist-100 placeholder:text-mist-500 focus:outline-none focus:border-signal-dim/50" /><Button variant="secondary" onClick={() => custom && onSelect(Math.min(240, Math.max(1, Number(custom))))}>Start custom</Button></div>
    <button onClick={onBrowseAll} className="text-xs text-mist-400 hover:text-mist-100 mt-4 inline-flex items-center gap-1.5"><ListChecks size={13} /> Or browse the full topic</button>
  </Card>;
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function ArticleResource({ resource, onProgress }: { resource: TopicDetailType["resources"][number]; onProgress: (progress: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const maxRef = useRef(resource.progress);
  const onScroll = useCallback(() => {
    if (!ref.current || resource.completed) return;
    const scrollable = ref.current.scrollHeight - ref.current.clientHeight;
    const pct = scrollable <= 0 ? 100 : Math.min(100, Math.round((ref.current.scrollTop / scrollable) * 100));
    if (pct > maxRef.current + 4 || pct === 100) { maxRef.current = pct; onProgress(pct); }
  }, [onProgress, resource.completed]);
  return <Card eyebrow="Supporting lesson" title={resource.title} action={<FileText size={18} className="text-mist-400" />}>
    <div ref={ref} onScroll={onScroll} className="max-h-96 overflow-y-auto pr-2 text-sm text-mist-200 leading-relaxed whitespace-pre-wrap border border-graphite-700 rounded-lg p-4 bg-graphite-900/50">{resource.content}</div>
    {!resource.completed && <p className="text-xs text-mist-500 mt-2">Scroll through the lesson to record reading progress.</p>}
  </Card>;
}
