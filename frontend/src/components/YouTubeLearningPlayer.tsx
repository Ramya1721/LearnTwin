import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, PauseCircle, PlayCircle, RotateCcw } from "lucide-react";
import { api } from "../services/api";
import { Badge, Button, Card } from "./ui";
import { LearningSessionView, VideoCheckpointView, LearningResourceView } from "../types";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YOUTUBE_IFRAME_API = "https://www.youtube.com/iframe_api";

let youtubeApiPromise: Promise<any> | null = null;

function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${YOUTUBE_IFRAME_API}"]`);
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      youtubeApiPromise = null;
      reject(new Error("YouTube player API timed out"));
    }, 15000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else {
        youtubeApiPromise = null;
        reject(new Error("YouTube player API did not initialize"));
      }
    };

    if (!existing) {
      const script = document.createElement("script");
      script.src = YOUTUBE_IFRAME_API;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        youtubeApiPromise = null;
        reject(new Error("Unable to load YouTube player API"));
      };
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatLanguage(code?: string | null) {
  if (!code) return null;
  const normalized = code.toLowerCase();
  const names: Record<string, string> = { en: "English", hi: "Hindi", kn: "Kannada", ta: "Tamil", te: "Telugu", ml: "Malayalam" };
  return names[normalized] || code;
}

export interface YouTubeLearningPlayerProps {
  resource: LearningResourceView;
  itemId: string;
  session?: LearningSessionView | null;
  onProgressSaved?: (progress: any) => void;
  onSessionCompleted?: (session: LearningSessionView) => void;
  compact?: boolean;
}

export function YouTubeLearningPlayer({
  resource,
  itemId,
  session,
  onProgressSaved,
  onSessionCompleted,
  compact = false,
}: YouTubeLearningPlayerProps) {
  const playerRef = useRef<any>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const checkpointIdsRef = useRef<Set<string>>(new Set(resource.checkpoints.filter((c) => c.completed).map((c) => c.id)));
  const checkpointsRef = useRef(resource.checkpoints);
  const sessionRef = useRef(session);
  const currentTimeRef = useRef(resource.currentTimeSeconds || 0);
  const durationRef = useRef(resource.durationSeconds || 0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(resource.currentTimeSeconds || 0);
  const [duration, setDuration] = useState(resource.durationSeconds || 0);
  const [error, setError] = useState<string | null>(null);
  const [checkpoint, setCheckpoint] = useState<VideoCheckpointView | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string; correctAnswer: string } | null>(null);
  const [sessionEnding, setSessionEnding] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const videoId = resource.youtubeVideoId;
  const sessionStart = session?.videoResourceId === resource.id ? session.startTimeSeconds ?? resource.currentTimeSeconds ?? 0 : null;
  const sessionEnd = session?.videoResourceId === resource.id ? session.targetEndTimeSeconds ?? null : null;

  useEffect(() => {
    checkpointsRef.current = resource.checkpoints;
  }, [resource.checkpoints]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const saveProgress = useCallback(
    async (time: number, force = false) => {
      if (!videoId || !itemId || !Number.isFinite(time)) return;
      if (!force && saveTimerRef.current !== null) return;
      if (!force) {
        saveTimerRef.current = window.setTimeout(() => {
          saveTimerRef.current = null;
          void saveProgress(currentTimeRef.current, true);
        }, 5000);
        return;
      }
      try {
        const res = await api.post(`/learning-path/${itemId}/video-progress`, {
          resourceId: resource.id,
          currentTimeSeconds: time,
          durationSeconds: durationRef.current || resource.durationSeconds || 0,
        });
        onProgressSaved?.(res.data);
      } catch {
        // Playback must continue even when a background progress save fails.
      }
    },
    [itemId, onProgressSaved, resource.durationSeconds, resource.id, videoId]
  );

  const pauseForCheckpoint = useCallback((next: VideoCheckpointView) => {
    if (playerRef.current) playerRef.current.pauseVideo();
    setPlaying(false);
    setSelectedAnswer("");
    setFeedback(null);
    setCheckpoint(next);
  }, []);

  const finishSessionAtBoundary = useCallback(
    async (actualTime: number) => {
      const activeSession = sessionRef.current;
      if (!activeSession || activeSession.videoResourceId !== resource.id || activeSession.status !== "ACTIVE" || sessionEnding) return;
      setSessionEnding(true);
      try {
        await saveProgress(actualTime, true);
        const res = await api.post(`/learning-path/session/${activeSession.id}/boundary`, { actualEndTimeSeconds: actualTime });
        setPlaying(false);
        setSessionMessage(`Session complete at ${formatTime(actualTime)}. Your position has been saved.`);
        onSessionCompleted?.(res.data.session);
      } catch (err: any) {
        setError(err?.response?.data?.error || "Couldn't finish this session yet. Keep watching and try again.");
      } finally {
        setSessionEnding(false);
      }
    },
    [onSessionCompleted, resource.id, saveProgress, sessionEnding]
  );

  const onTimeTick = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const time = Number(player.getCurrentTime?.() || 0);
    const total = Number(player.getDuration?.() || durationRef.current || resource.durationSeconds || 0);
    currentTimeRef.current = time;
    durationRef.current = total;
    setCurrentTime(time);
    if (total > 0) setDuration(total);

    const activeSession = sessionRef.current;
    if (activeSession?.status === "ACTIVE" && activeSession.videoResourceId === resource.id && activeSession.targetEndTimeSeconds != null) {
      if (time >= activeSession.targetEndTimeSeconds) {
        void finishSessionAtBoundary(time);
        return;
      }
    }

    const pending = checkpointsRef.current.find((c) => !checkpointIdsRef.current.has(c.id) && time >= c.timestampSeconds);
    if (pending) pauseForCheckpoint(pending);
    void saveProgress(time);
  }, [finishSessionAtBoundary, pauseForCheckpoint, resource.durationSeconds, resource.id, saveProgress]);

  useEffect(() => {
    let cancelled = false;
    let interval: number | null = null;

    if (!videoId || !hostRef.current) {
      setError("This resource does not have a valid YouTube video ID.");
      return;
    }

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        playerRef.current = new YT.Player(hostRef.current, {
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: (event: any) => {
              const total = Number(event.target.getDuration?.() || resource.durationSeconds || 0);
              durationRef.current = total;
              setDuration(total);
              setReady(true);
              const resumeAt = sessionStart != null ? sessionStart : resource.currentTimeSeconds || 0;
              if (resumeAt > 1) event.target.seekTo(resumeAt, true);
            },
            onStateChange: (event: any) => {
              setPlaying(event.data === YT.PlayerState.PLAYING);
              if (event.data === YT.PlayerState.ENDED) {
                const end = Number(event.target.getDuration?.() || durationRef.current || 0);
                void saveProgress(end, true);
              }
            },
            onError: (event: any) => {
              setError(`YouTube could not play this video (error ${event.data}). The video may be unavailable or restricted.`);
            },
          },
        });
        interval = window.setInterval(onTimeTick, 1000);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to initialize YouTube player.");
      });

    return () => {
      cancelled = true;
      if (interval !== null) window.clearInterval(interval);
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      void saveProgress(currentTimeRef.current, true);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId]);

  const percent = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
  const sessionPercent = sessionEnd != null && sessionStart != null && sessionEnd > sessionStart
    ? Math.min(100, Math.max(0, Math.round(((currentTime - sessionStart) / (sessionEnd - sessionStart)) * 100)))
    : percent;
  const language = formatLanguage(resource.sourceLanguageCode);
  const remainingSession = sessionEnd != null ? Math.max(0, sessionEnd - currentTime) : null;

  async function submitCheckpoint() {
    if (!checkpoint || !selectedAnswer) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/learning-path/checkpoints/${checkpoint.id}/submit`, { answer: selectedAnswer });
      checkpointIdsRef.current.add(checkpoint.id);
      setFeedback({ correct: res.data.correct, explanation: res.data.explanation, correctAnswer: res.data.correctAnswer });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Couldn't save this checkpoint answer.");
    } finally {
      setSubmitting(false);
    }
  }

  function continueAfterCheckpoint() {
    setCheckpoint(null);
    setFeedback(null);
    setSelectedAnswer("");
    playerRef.current?.playVideo?.();
    setPlaying(true);
  }

  function resumeFromSavedPosition() {
    playerRef.current?.seekTo?.(resource.currentTimeSeconds || 0, true);
    playerRef.current?.playVideo?.();
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-graphite-700 bg-black aspect-video">
        <div ref={hostRef} className="absolute inset-0" />
        {!ready && !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-mist-400">Loading YouTube player…</div>}
        {checkpoint && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-xl rounded-xl border border-graphite-600 bg-graphite-900 p-5 shadow-2xl">
              {!feedback ? (
                <>
                  <div className="flex items-center gap-2 mb-2"><PauseCircle size={18} className="text-signal" /><span className="text-xs uppercase tracking-widest text-mist-400">Learning checkpoint · {formatTime(checkpoint.timestampSeconds)}</span></div>
                  <h3 className="text-lg font-semibold text-mist-50 mb-4">{checkpoint.question}</h3>
                  <div className="space-y-2 mb-5">
                    {checkpoint.options.map((option) => (
                      <button key={option} onClick={() => setSelectedAnswer(option)} className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${selectedAnswer === option ? "border-signal-dim bg-signal-soft text-signal" : "border-graphite-600 bg-graphite-800 text-mist-200 hover:border-graphite-500"}`}>
                        {option}
                      </button>
                    ))}
                  </div>
                  <Button disabled={!selectedAnswer || submitting} onClick={submitCheckpoint}>{submitting ? "Saving…" : "Submit answer"}</Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">{feedback.correct ? <CheckCircle2 className="text-signal" size={20} /> : <AlertTriangle className="text-alert" size={20} />}<span className={`font-semibold ${feedback.correct ? "text-signal" : "text-alert"}`}>{feedback.correct ? "Correct" : "Review this"}</span></div>
                  <p className="text-sm text-mist-200 leading-relaxed mb-3">{feedback.explanation}</p>
                  {!feedback.correct && <p className="text-xs text-mist-400 mb-4">Correct answer: <span className="text-mist-100">{feedback.correctAnswer}</span></p>}
                  <Button onClick={continueAfterCheckpoint}>Continue video</Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <div className="rounded-lg border border-alert/30 bg-alert-soft/20 px-3 py-2 text-xs text-alert">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={!ready} onClick={() => playerRef.current?.playVideo?.()}><PlayCircle size={14} /> Play</Button>
        <Button variant="ghost" disabled={!ready} onClick={() => playerRef.current?.pauseVideo?.()}><PauseCircle size={14} /> Pause</Button>
        <Button variant="ghost" disabled={!ready} onClick={resumeFromSavedPosition}><RotateCcw size={14} /> Resume saved</Button>
        <span className="text-xs font-mono text-mist-400 ml-auto">{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1.5"><span className="text-mist-400">{session ? "Today's session" : "Video progress"}</span><span className="font-mono text-mist-300">{session ? `${sessionPercent}%` : `${percent}%`}</span></div>
        <div className="h-2 rounded-full bg-graphite-700 overflow-hidden"><div className="h-full bg-signal rounded-full transition-all" style={{ width: `${session ? sessionPercent : percent}%` }} /></div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {language && <Badge tone={resource.languageFallback ? "alert" : "default"}>{resource.languageFallback ? "English fallback video" : `Audio language: ${language}`}</Badge>}
        {session && remainingSession != null && <Badge tone="twin"><Clock3 size={12} /> {formatTime(remainingSession)} session target remaining</Badge>}
        {resource.checkpoints.length > 0 && <Badge tone="default">{resource.checkpoints.filter((c) => checkpointIdsRef.current.has(c.id)).length}/{resource.checkpoints.length} checkpoints</Badge>}
      </div>

      {sessionMessage && <div className="rounded-lg border border-signal-dim/40 bg-signal-soft/20 px-3 py-2 text-sm text-signal">{sessionMessage}</div>}

      {!compact && resource.content && <p className="text-sm text-mist-300 leading-relaxed">{resource.content}</p>}
      {session && sessionStart != null && sessionEnd != null && (
        <p className="text-xs text-mist-500">Session playback: {formatTime(sessionStart)} → approximately {formatTime(sessionEnd)}. LearnTwin controls timestamps only; the YouTube video is never downloaded or cut.</p>
      )}
    </div>
  );
}
