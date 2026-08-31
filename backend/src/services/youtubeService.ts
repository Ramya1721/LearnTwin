import crypto from "crypto";
import { prisma } from "../utils/prisma";
import { generateVideoCheckpointQuestion } from "./aiService";

export const SUPPORTED_LANGUAGES = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_CODES: Record<SupportedLanguage, string> = {
  English: "en",
  Hindi: "hi",
  Kannada: "kn",
  Tamil: "ta",
  Telugu: "te",
  Malayalam: "ml",
};

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  English: "English",
  Hindi: "Hindi",
  Kannada: "Kannada",
  Tamil: "Tamil",
  Telugu: "Telugu",
  Malayalam: "Malayalam",
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SEARCH_VERSION = "v3-language-transcript";
const transcriptCache = new Map<string, VideoTranscript | null>();
async function fetchWithTimeout(input: any, init: any = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}


export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  channel: string;
  durationSeconds: number;
  embeddable: boolean;
  sourceLanguageCode: string | null;
  requestedLanguage: SupportedLanguage;
  languageMatch: "preferred" | "other" | "fallback" | "unknown";
  languageFallback: boolean;
  languageScore: number;
  transcriptAvailable?: boolean;
  transcriptLanguageCode?: string | null;
}

export interface TranscriptCue {
  startSeconds: number;
  durationSeconds: number;
  text: string;
}

export interface VideoTranscript {
  languageCode: string;
  cues: TranscriptCue[];
}

function requireApiKey() {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw Object.assign(new Error("YouTube API is not configured"), { status: 503, code: "YOUTUBE_NOT_CONFIGURED" });
  return key;
}

function parseDuration(value: string): number {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function cacheKey(query: string, languageCode: string, level: string, objective: string) {
  return crypto.createHash("sha256").update(JSON.stringify({ SEARCH_VERSION, query, languageCode, level, objective })).digest("hex");
}

async function youtubeGet<T>(path: string, params: Record<string, string>) {
  const key = requireApiKey();
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  Object.entries({ ...params, key }).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetchWithTimeout(url, {}, 15000);
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.status || "YOUTUBE_API_ERROR";
    const message = reason === "quotaExceeded" || reason === "dailyLimitExceeded" ? "YouTube API quota exceeded" : "YouTube API request failed";
    throw Object.assign(new Error(message), { status: response.status === 403 ? 429 : 502, code: reason });
  }
  return data as T;
}

export function languageCodeFor(language: string | undefined): string {
  const normalized = normalizeLanguage(language);
  return LANGUAGE_CODES[normalized];
}

export function normalizeLanguage(language: string | undefined): SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage) ? (language as SupportedLanguage) : "English";
}

function normalizedLanguageCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.toLowerCase().trim().replace("_", "-");
  return normalized.split("-")[0] || null;
}

function scriptSignals(text: string) {
  return {
    devanagari: /[\u0900-\u097F]/u.test(text),
    kannada: /[\u0C80-\u0CFF]/u.test(text),
    tamil: /[\u0B80-\u0BFF]/u.test(text),
    telugu: /[\u0C00-\u0C7F]/u.test(text),
    malayalam: /[\u0D00-\u0D7F]/u.test(text),
  };
}

function languageScriptPresent(language: SupportedLanguage, text: string): boolean {
  const s = scriptSignals(text);
  if (language === "Hindi") return s.devanagari;
  if (language === "Kannada") return s.kannada;
  if (language === "Tamil") return s.tamil;
  if (language === "Telugu") return s.telugu;
  if (language === "Malayalam") return s.malayalam;
  return !s.devanagari && !s.kannada && !s.tamil && !s.telugu && !s.malayalam;
}

function otherLanguageScriptPresent(language: SupportedLanguage, text: string): boolean {
  const s = scriptSignals(text);
  const flags = Object.entries(s).filter(([key]) => {
    const wanted = language === "Hindi" ? "devanagari" : language.toLowerCase();
    return key !== wanted;
  });
  return flags.some(([, present]) => present);
}

function scoreLanguageCandidate(video: {
  title: string;
  description: string;
  channel: string;
  sourceLanguageCode: string | null;
}, language: SupportedLanguage): { score: number; match: "preferred" | "other" | "unknown" } {
  const wanted = LANGUAGE_CODES[language];
  const actual = normalizedLanguageCode(video.sourceLanguageCode);
  const searchable = `${video.title}\n${video.description}\n${video.channel}`;
  const lower = searchable.toLowerCase();
  const name = LANGUAGE_NAMES[language].toLowerCase();
  let score = 0;

  if (actual === wanted) score += 120;
  else if (actual) score -= 140;

  if (lower.includes(name)) score += 35;
  if (languageScriptPresent(language, searchable)) score += language === "English" ? 20 : 70;
  if (otherLanguageScriptPresent(language, searchable)) score -= language === "English" ? 100 : 45;

  // Explicit "[Hindi]", "Tamil tutorial", etc. are stronger signals than generic title text.
  if (new RegExp(`(?:\\[|\\(|-|\\b)${name}(?:\\]|\\)|\\b)`, "i").test(searchable)) score += 20;

  const match = actual === wanted || (language !== "English" && languageScriptPresent(language, searchable))
    ? "preferred"
    : actual
      ? "other"
      : "unknown";
  return { score, match };
}

function isAcceptableLanguageCandidate(video: YouTubeVideoResult): boolean {
  if (video.requestedLanguage === "English") {
    return video.languageMatch === "preferred" || (video.languageMatch === "unknown" && video.languageScore >= 10);
  }
  return video.languageMatch === "preferred" && video.languageScore >= 60;
}

async function searchYouTubeOnce(params: {
  query: string;
  language: SupportedLanguage;
  languageCode: string;
  level: string;
  objective: string;
  maxResults: number;
}): Promise<YouTubeVideoResult[]> {
  const key = cacheKey(params.query, params.languageCode, params.level, params.objective);
  const cached = await prisma.youTubeSearchCache.findUnique({ where: { cacheKey: key } }).catch(() => null);
  if (cached && cached.expiresAt > new Date()) {
    try {
      return JSON.parse(cached.responseJson) as YouTubeVideoResult[];
    } catch {
      // Corrupt cache entry: ignore it and refresh from YouTube.
    }
  }

  const searchData: any = await youtubeGet("search", {
    part: "snippet",
    q: params.query,
    type: "video",
    maxResults: String(params.maxResults),
    relevanceLanguage: params.languageCode,
    videoEmbeddable: "true",
    videoSyndicated: "true",
  });
  const ids = (searchData.items || []).map((item: any) => item?.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const details: any = await youtubeGet("videos", {
    part: "snippet,contentDetails,status",
    id: ids.join(","),
  });

  const videos = (details.items || [])
    .filter((v: any) => v?.id && v?.status?.embeddable !== false)
    .map((v: any) => {
      const sourceLanguageCode = v.snippet?.defaultAudioLanguage || v.snippet?.defaultLanguage || null;
      const base = {
        videoId: v.id,
        title: v.snippet?.title || "Untitled video",
        description: v.snippet?.description || "",
        thumbnail: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        channel: v.snippet?.channelTitle || "",
        durationSeconds: parseDuration(v.contentDetails?.duration || "PT0S"),
        embeddable: v.status?.embeddable !== false,
        sourceLanguageCode,
        requestedLanguage: params.language,
        languageFallback: false,
      } as YouTubeVideoResult;
      const scored = scoreLanguageCandidate(base, params.language);
      return { ...base, languageScore: scored.score, languageMatch: scored.match };
    })
    .filter((v: YouTubeVideoResult) => v.durationSeconds > 0)
    .sort((a: YouTubeVideoResult, b: YouTubeVideoResult) => b.languageScore - a.languageScore);

  await prisma.youTubeSearchCache.upsert({
    where: { cacheKey: key },
    update: { responseJson: JSON.stringify(videos), expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
    create: {
      cacheKey: key,
      query: params.query,
      languageCode: params.languageCode,
      level: params.level,
      objective: params.objective,
      responseJson: JSON.stringify(videos),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
  });

  return videos;
}

export async function searchYouTubeVideos(params: {
  topic: string;
  preferredLanguage?: string;
  level?: string;
  objective?: string;
  maxResults?: number;
}): Promise<{ videos: YouTubeVideoResult[]; usedFallbackLanguage: boolean; languageUnavailable: boolean }> {
  const language = normalizeLanguage(params.preferredLanguage);
  const languageCode = languageCodeFor(language);
  const level = params.level || "beginner";
  const objective = params.objective || `Learn ${params.topic}`;
  const maxResults = Math.min(10, Math.max(1, params.maxResults || 6));

  const queryVariants = [
    `${params.topic} ${objective} ${level} ${LANGUAGE_NAMES[language]}`,
    `${params.topic} ${level} tutorial ${LANGUAGE_NAMES[language]}`,
    `${params.topic} ${objective} explained ${LANGUAGE_NAMES[language]}`,
  ];

  const all = new Map<string, YouTubeVideoResult>();
  for (const query of queryVariants) {
    const videos = await searchYouTubeOnce({ query: query.trim(), language, languageCode, level, objective, maxResults });
    for (const video of videos) {
      const existing = all.get(video.videoId);
      if (!existing || video.languageScore > existing.languageScore) all.set(video.videoId, video);
    }
    const accepted = Array.from(all.values()).filter(isAcceptableLanguageCandidate);
    if (accepted.length >= maxResults) break;
  }

  const videos = Array.from(all.values())
    .filter(isAcceptableLanguageCandidate)
    .sort((a, b) => b.languageScore - a.languageScore)
    .slice(0, maxResults);

  return { videos, usedFallbackLanguage: false, languageUnavailable: videos.length === 0 };
}

function extractJsonArrayAfterMarker(html: string, marker: string): any[] | null {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf("[", markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function getCaptionTracks(videoId: string): Promise<any[]> {
  const response = await fetchWithTimeout(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    headers: { "User-Agent": "Mozilla/5.0 LearnTwin/1.0" },
  }, 12000);
  if (!response.ok) return [];
  const html = await response.text();
  return extractJsonArrayAfterMarker(html, '"captionTracks":') || [];
}

export async function fetchVideoTranscript(videoId: string, preferredLanguage: string): Promise<VideoTranscript | null> {
  const cacheId = `${videoId}:${languageCodeFor(preferredLanguage)}`;
  if (transcriptCache.has(cacheId)) return transcriptCache.get(cacheId) || null;
  try {
    const wanted = languageCodeFor(preferredLanguage);
    const tracks = await getCaptionTracks(videoId);
    if (!tracks.length) { transcriptCache.set(cacheId, null); return null; }

    const candidates = tracks
      .filter((track: any) => track?.baseUrl && normalizedLanguageCode(track?.languageCode) === wanted)
      .sort((a: any, b: any) => Number(Boolean(a?.kind === "asr")) - Number(Boolean(b?.kind === "asr")));
    const track = candidates[0];
    if (!track) { transcriptCache.set(cacheId, null); return null; }

    const url = new URL(track.baseUrl);
    url.searchParams.set("fmt", "json3");
    const response = await fetchWithTimeout(url, {}, 12000);
    if (!response.ok) { transcriptCache.set(cacheId, null); return null; }
    const data: any = await response.json().catch(() => null);
    if (!data?.events) { transcriptCache.set(cacheId, null); return null; }

    const cues: TranscriptCue[] = [];
    for (const event of data.events) {
      if (!Array.isArray(event?.segs)) continue;
      const text = event.segs.map((s: any) => s?.utf8 || "").join("").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const startSeconds = Math.max(0, Number(event.tStartMs || 0) / 1000);
      const durationSeconds = Math.max(0.1, Number(event.dDurationMs || 0) / 1000);
      cues.push({ startSeconds, durationSeconds, text });
    }
    const result = cues.length ? { languageCode: wanted, cues } : null;
    transcriptCache.set(cacheId, result);
    return result;
  } catch (error) {
    console.warn(`Transcript unavailable for YouTube video ${videoId}:`, error instanceof Error ? error.message : error);
    transcriptCache.set(cacheId, null);
    return null;
  }
}

function sentencePreview(text: string, max = 130): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const last = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  return (last > 45 ? cut.slice(0, last + 1) : `${cut}…`).trim();
}

function buildTranscriptSegments(transcript: VideoTranscript, durationSeconds: number) {
  const targetSeconds = 8 * 60;
  const maxSeconds = 11 * 60;
  const segments: { title: string; summary: string; startSeconds: number; endSeconds: number; evidence: string }[] = [];
  let current: TranscriptCue[] = [];
  let start = 0;

  const flush = (endSeconds: number) => {
    if (!current.length) return;
    const text = current.map((c) => c.text).join(" ").trim();
    const safeEnd = Math.min(durationSeconds, Math.max(endSeconds, start + 30));
    segments.push({
      title: sentencePreview(text, 72) || `Video segment ${segments.length + 1}`,
      summary: sentencePreview(text, 220),
      startSeconds: Math.max(0, Math.floor(start)),
      endSeconds: Math.max(Math.floor(start + 1), Math.min(durationSeconds, Math.ceil(safeEnd))),
      evidence: text.slice(0, 6000),
    });
    current = [];
  };

  for (const cue of transcript.cues) {
    if (!current.length) start = cue.startSeconds;
    current.push(cue);
    const end = cue.startSeconds + cue.durationSeconds;
    if (end - start >= targetSeconds && current.length >= 4) flush(end);
    else if (end - start >= maxSeconds) flush(end);
  }
  if (current.length) flush(current[current.length - 1].startSeconds + current[current.length - 1].durationSeconds);

  // Merge a tiny trailing segment into its predecessor when possible.
  if (segments.length > 1) {
    const last = segments[segments.length - 1];
    if (last.endSeconds - last.startSeconds < 120) {
      const prev = segments[segments.length - 2];
      prev.endSeconds = last.endSeconds;
      prev.evidence = `${prev.evidence} ${last.evidence}`.slice(0, 6000);
      prev.summary = sentencePreview(prev.evidence, 220);
      segments.pop();
    }
  }
  return segments.filter((s) => s.endSeconds > s.startSeconds && s.startSeconds < durationSeconds);
}

export function parseYouTubeChapters(description: string, durationSeconds: number): { timestampSeconds: number; title: string }[] {
  const lines = description.split(/\r?\n/);
  const chapters: { timestampSeconds: number; title: string }[] = [];
  const pattern = /^(?:\s*[-•]\s*)?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/;
  for (const line of lines) {
    const match = line.trim().match(pattern);
    if (!match) continue;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const timestampSeconds = hours * 3600 + minutes * 60 + seconds;
    const title = match[4].trim();
    if (timestampSeconds >= 0 && timestampSeconds < durationSeconds && title.length >= 2) chapters.push({ timestampSeconds, title });
  }
  const unique = Array.from(new Map(chapters.map((c) => [c.timestampSeconds, c])).values()).sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  if (unique.length < 2 || unique[0].timestampSeconds !== 0) return [];
  return unique;
}

async function ensureVideoContent(resource: any, preferredLanguage: string) {
  if (!resource.youtubeVideoId || resource.type !== "VIDEO") return { transcript: null, segments: [] };

  const existingSegments = await prisma.videoSegment.findMany({ where: { resourceId: resource.id }, orderBy: { order: "asc" } });
  const existingCheckpoints = await prisma.videoCheckpoint.findMany({ where: { resourceId: resource.id } });
  const containsLegacyDescriptionCheckpoint = existingCheckpoints.some((c) => c.sourceBasis?.startsWith("YouTube description chapter:"));
  if (existingSegments.length > 0 && existingCheckpoints.length > 0 && !containsLegacyDescriptionCheckpoint) {
    return { transcript: null, segments: existingSegments };
  }

  const transcript = await fetchVideoTranscript(resource.youtubeVideoId, preferredLanguage);
  if (!transcript) {
    if (containsLegacyDescriptionCheckpoint) {
      await prisma.videoCheckpoint.deleteMany({ where: { resourceId: resource.id } });
      await prisma.videoSegment.deleteMany({ where: { resourceId: resource.id } });
    }
    return { transcript: null, segments: [] };
  }

  const segments = buildTranscriptSegments(transcript, resource.durationSeconds || 0);
  if (!segments.length) return { transcript, segments: [] };

  await prisma.videoSegment.deleteMany({ where: { resourceId: resource.id } });
  await prisma.videoCheckpoint.deleteMany({ where: { resourceId: resource.id } });

  const createdSegments: any[] = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const created = await prisma.videoSegment.create({
      data: {
        resourceId: resource.id,
        title: segment.title,
        summary: segment.summary,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        order: i,
      },
    });
    createdSegments.push(created);
  }

  // Checkpoints are placed at the end of a segment. Their evidence is ONLY the
  // transcript that occurred before that timestamp, so future content cannot leak into the question.
  for (let i = 0; i < createdSegments.length - 1; i++) {
    const segment = segments[i];
    const checkpointAt = createdSegments[i].endSeconds;
    if (checkpointAt <= 20 || !segment.evidence.trim()) continue;
    const question = await generateVideoCheckpointQuestion({
      videoTitle: resource.title,
      chapterTitle: segment.title,
      chapterSummary: segment.summary,
      transcriptEvidence: segment.evidence,
      language: preferredLanguage,
    });
    if (!question) continue;
    await prisma.videoCheckpoint.create({
      data: {
        resourceId: resource.id,
        timestampSeconds: checkpointAt,
        question: question.question,
        options: JSON.stringify(question.options),
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        language: preferredLanguage,
        sourceBasis: `Transcript segment ${segment.startSeconds}-${segment.endSeconds}s; checkpoint tests only content taught before ${checkpointAt}s.`,
      },
    });
  }

  return { transcript, segments: createdSegments };
}

export async function attachBestYouTubeResource(params: {
  skillId: string;
  skillName: string;
  domain: string;
  difficulty: string;
  preferredLanguage: string;
  objective?: string;
}): Promise<any | null> {
  if (!process.env.YOUTUBE_API_KEY?.trim()) return null;
  const preferredCode = languageCodeFor(params.preferredLanguage);
  const matchingVideos = await prisma.learningResource.findMany({
    where: { skillId: params.skillId, type: "VIDEO", sourceLanguageCode: preferredCode },
    orderBy: { createdAt: "desc" },
  });
  if (matchingVideos.length) {
    const resource = matchingVideos[0];
    await ensureVideoContent(resource, params.preferredLanguage);
    return prisma.learningResource.findUnique({ where: { id: resource.id }, include: { segments: true, checkpoints: true } });
  }

  const result = await searchYouTubeVideos({
    topic: `${params.domain} ${params.skillName}`,
    preferredLanguage: params.preferredLanguage,
    level: params.difficulty,
    objective: params.objective || `Understand ${params.skillName}`,
    maxResults: 8,
  });
  const selected = result.videos.find((v) => v.embeddable && v.durationSeconds > 0 && isAcceptableLanguageCandidate(v));
  if (!selected) return null;

  const resource = await prisma.learningResource.create({
    data: {
      skillId: params.skillId,
      type: "VIDEO",
      title: selected.title,
      content: selected.description || null,
      videoUrl: `https://www.youtube.com/watch?v=${selected.videoId}`,
      youtubeVideoId: selected.videoId,
      channel: selected.channel,
      durationSeconds: selected.durationSeconds,
      sourceLanguageCode: normalizedLanguageCode(selected.sourceLanguageCode),
      order: 0,
      minProgressRequired: 80,
    },
  });

  await ensureVideoContent(resource, params.preferredLanguage);
  return prisma.learningResource.findUnique({ where: { id: resource.id }, include: { segments: true, checkpoints: true } });
}
