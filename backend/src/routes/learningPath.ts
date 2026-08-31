import { Router } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { generateLearningPath, getActivePath } from "../services/learningPathService";
import { getItemRequirements, computeItemProgressPercent, unlockAvailableItems, estimateItemMinutes } from "../services/contentService";
import { createSession, getActiveSession, completeSessionItem, saveVideoProgress, completeSessionBoundary } from "../services/sessionService";
import { searchYouTubeVideos } from "../services/youtubeService";

const router = Router();

// Search real YouTube videos through the backend. The API key never reaches the browser.
router.post("/youtube/search", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { topic, preferredLanguage, level, objective, maxResults } = req.body || {};
    if (!topic || typeof topic !== "string" || !topic.trim()) return res.status(400).json({ error: "topic is required" });
    const result = await searchYouTubeVideos({
      topic: topic.trim(),
      preferredLanguage,
      level,
      objective,
      maxResults: Number(maxResults) || 6,
    });
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(err?.status || 502).json({ error: err?.message || "YouTube search failed", code: err?.code });
  }
});

// Generate (or regenerate) a path for ANY freeform learning goal.
router.post("/generate", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { goal, experienceLevel } = req.body;
    if (!goal || typeof goal !== "string" || !goal.trim()) {
      return res.status(400).json({ error: "goal is required" });
    }
    const path = await generateLearningPath(req.userId!, goal.trim(), experienceLevel);
    res.json({ path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate learning path. Please try again." });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const path = await getActivePath(req.userId!);
  if (path) {
    const withMinutes = await Promise.all(
      (path as any).items.map(async (item: any) => ({
        ...item,
        estimatedMinutes: await estimateItemMinutes(item.skillId),
        progressPercent: await computeItemProgressPercent(req.userId!, item.skillId),
      }))
    );
    (path as any).items = withMinutes;
  }
  res.json({ path });
});

// Fetch a single item's content (resources + this user's progress + quiz info).
router.get("/:itemId", requireAuth, async (req: AuthRequest, res) => {
  const item = await prisma.learningPathItem.findUnique({
    where: { id: req.params.itemId },
    include: {
      learningPath: true,
      skill: { include: { prerequisites: { include: { prerequisiteSkill: true } } } },
    },
  });
  if (!item || item.learningPath.userId !== req.userId) return res.status(404).json({ error: "Not found" });

  if (item.status === "LOCKED") {
    // Tell the learner *why* it's locked instead of exposing content.
    const deps = await prisma.skillDependency.findMany({ where: { skillId: item.skillId }, include: { prerequisiteSkill: true } });
    return res.status(403).json({
      error: "This topic is locked",
      lockedReason:
        deps.length > 0
          ? `Complete "${deps.map((d) => d.prerequisiteSkill.name).join('" and "')}" first.`
          : "Complete the prior topic in your path first.",
    });
  }

  const resources = await prisma.learningResource.findMany({
    where: { skillId: item.skillId },
    orderBy: { order: "asc" },
    include: { progress: { where: { userId: req.userId! } }, segments: { orderBy: { order: "asc" } }, checkpoints: { include: { progress: { where: { userId: req.userId! } } }, orderBy: { timestampSeconds: "asc" } } },
  });
  const profile = await prisma.userProfile.findUnique({ where: { userId: req.userId! }, select: { preferredLanguage: true } });
  const preferredLanguage = profile?.preferredLanguage || "English";
  const languageCode = preferredLanguage === "Hindi" ? "hi" : preferredLanguage === "Kannada" ? "kn" : preferredLanguage === "Tamil" ? "ta" : preferredLanguage === "Telugu" ? "te" : preferredLanguage === "Malayalam" ? "ml" : "en";
  const assessment = await prisma.assessment.findFirst({
    where: { skillId: item.skillId, languageCode },
    include: { questions: true },
  });
  const attempts = assessment
    ? await prisma.assessmentAttempt.findMany({
        where: { userId: req.userId!, assessmentId: assessment.id },
        orderBy: { attemptedAt: "desc" },
        take: 5,
      })
    : [];

  const requirements = await getItemRequirements(req.userId!, item.skillId);
  const progressPercent = await computeItemProgressPercent(req.userId!, item.skillId);
  const estimatedMinutes = await estimateItemMinutes(item.skillId);
  const activeSession = await getActiveSession(req.userId!, item.id);
  const weakConcepts = await prisma.recommendation.findMany({
    where: { userId: req.userId!, status: "OPEN", type: "CONCEPT_REVIEW" },
  });

  // mark accessed / started (harmless metadata update, not a completion signal)
  await prisma.learningPathItem.update({
    where: { id: item.id },
    data: {
      lastAccessedAt: new Date(),
      startedAt: item.startedAt ?? new Date(),
      status: item.status === "CURRENT" ? "IN_PROGRESS" : item.status,
      progressPercent,
    },
  });

  res.json({
    item: {
      ...item,
      progressPercent,
      prerequisites: item.skill.prerequisites.map((p) => ({ id: p.prerequisiteSkill.id, name: p.prerequisiteSkill.name })),
    },
    estimatedMinutes,
    activeSession,
    weakConcepts: weakConcepts.map((w) => ({ concept: w.title, description: w.description, priority: w.priority })),
    resources: resources.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      content: r.content,
      videoUrl: r.videoUrl,
      youtubeVideoId: r.youtubeVideoId,
      channel: r.channel,
      durationSeconds: r.durationSeconds,
      sourceLanguageCode: r.sourceLanguageCode,
      languageFallback: preferredLanguage !== "English" && Boolean(r.sourceLanguageCode?.toLowerCase().startsWith("en")),
      transcriptAvailable: r.type === "VIDEO" && r.segments.length > 0,
      minProgressRequired: r.minProgressRequired,
      currentTimeSeconds: r.progress[0]?.currentTimeSeconds ?? 0,
      percentageWatched: r.progress[0]?.percentageWatched ?? r.progress[0]?.progress ?? 0,
      progress: r.progress[0]?.progress ?? 0,
      completed: r.progress[0]?.completed ?? false,
      segments: r.segments.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        startSeconds: s.startSeconds,
        endSeconds: s.endSeconds,
        order: s.order,
      })),
      checkpoints: r.checkpoints.map((c) => ({
        id: c.id,
        timestampSeconds: c.timestampSeconds,
        question: c.question,
        options: JSON.parse(c.options),
        explanation: c.explanation,
        language: c.language,
        completed: c.progress[0]?.completed ?? false,
        answeredCorrectly: c.progress[0]?.answeredCorrectly ?? false,
      })),
    })),
    assessment: assessment
      ? {
          id: assessment.id,
          title: assessment.title,
          passingScore: assessment.passingScore,
          languageCode: assessment.languageCode,
          questionCount: assessment.questions.length,
          bestScore: attempts.length ? Math.max(...attempts.map((a) => a.score)) : null,
          attempts: attempts.map((a) => ({ score: a.score, attemptedAt: a.attemptedAt })),
        }
      : null,
    requirements,
  });
});

// ---- Micro-learning sessions ("I only have N minutes") ----

// Create (or regenerate) a time-boxed session plan for this topic.
router.post("/:itemId/session", requireAuth, async (req: AuthRequest, res) => {
  try {
    const targetMinutes = Number(req.body?.targetMinutes);
    if (!targetMinutes || targetMinutes < 1 || targetMinutes > 240) {
      return res.status(400).json({ error: "targetMinutes must be a number between 1 and 240" });
    }
    const session = await createSession(req.userId!, req.params.itemId, Math.round(targetMinutes));
    res.json({ session });
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to create learning session" });
  }
});

// Fetch this topic's in-progress session, if any ("Continue where you left off").
router.get("/:itemId/session", requireAuth, async (req: AuthRequest, res) => {
  const session = await getActiveSession(req.userId!, req.params.itemId);
  res.json({ session });
});

// Persist the exact IFrame playback position. currentTime is resumable; percentage only moves forward.
router.post("/:itemId/video-progress", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { resourceId, currentTimeSeconds, durationSeconds } = req.body || {};
    if (!resourceId || typeof currentTimeSeconds !== "number") return res.status(400).json({ error: "resourceId and currentTimeSeconds are required" });
    const result = await saveVideoProgress(req.userId!, req.params.itemId, resourceId, currentTimeSeconds, Number(durationSeconds) || 0);
    res.json(result);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to save video progress" });
  }
});

router.get("/:itemId/checkpoints", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await prisma.learningPathItem.findUnique({ where: { id: req.params.itemId }, include: { learningPath: true } });
    if (!item || item.learningPath.userId !== req.userId) return res.status(404).json({ error: "Not found" });
    const checkpoints = await prisma.videoCheckpoint.findMany({
      where: { resource: { skillId: item.skillId } },
      include: { progress: { where: { userId: req.userId! } } },
      orderBy: { timestampSeconds: "asc" },
    });
    res.json({ checkpoints: checkpoints.map((c) => ({
      id: c.id, timestampSeconds: c.timestampSeconds, question: c.question, options: JSON.parse(c.options),
      explanation: c.explanation, language: c.language, completed: c.progress[0]?.completed ?? false,
      answeredCorrectly: c.progress[0]?.answeredCorrectly ?? false,
    })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load video checkpoints" });
  }
});

router.post("/checkpoints/:checkpointId/submit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const checkpoint = await prisma.videoCheckpoint.findUnique({ where: { id: req.params.checkpointId }, include: { resource: true } });
    if (!checkpoint) return res.status(404).json({ error: "Checkpoint not found" });
    const answer = typeof req.body?.answer === "string" ? req.body.answer : "";
    const item = await prisma.learningPathItem.findFirst({ where: { skillId: checkpoint.resource.skillId, learningPath: { userId: req.userId!, status: "ACTIVE" } } });
    if (!item) return res.status(404).json({ error: "Checkpoint is not part of an active learning path" });
    const watched = await prisma.resourceProgress.findUnique({ where: { userId_resourceId: { userId: req.userId!, resourceId: checkpoint.resourceId } } });
    if (!watched || Number(watched.currentTimeSeconds || 0) + 10 < checkpoint.timestampSeconds) {
      return res.status(400).json({ error: "Watch the video up to this checkpoint before answering it." });
    }
    const correct = answer === checkpoint.correctAnswer;
    const progress = await prisma.checkpointProgress.upsert({
      where: { userId_checkpointId: { userId: req.userId!, checkpointId: checkpoint.id } },
      update: { selectedAnswer: answer, answeredCorrectly: correct, completed: true, answeredAt: new Date() },
      create: { userId: req.userId!, checkpointId: checkpoint.id, selectedAnswer: answer, answeredCorrectly: correct, completed: true, answeredAt: new Date() },
    });
    res.json({
      progress,
      correct,
      explanation: checkpoint.explanation,
      correctAnswer: checkpoint.correctAnswer,
      itemProgressPercent: await computeItemProgressPercent(req.userId!, item.skillId),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit checkpoint" });
  }
});

router.post("/session/:sessionId/boundary", requireAuth, async (req: AuthRequest, res) => {
  try {
    const actualEndTimeSeconds = Number(req.body?.actualEndTimeSeconds);
    if (!Number.isFinite(actualEndTimeSeconds) || actualEndTimeSeconds < 0) return res.status(400).json({ error: "actualEndTimeSeconds is required" });
    const result = await completeSessionBoundary(req.userId!, req.params.sessionId, actualEndTimeSeconds);
    res.json(result);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to complete video session" });
  }
});

// Mark a single item within a session as done. Cascades into real
// ResourceProgress so it counts toward the topic's actual completion.
router.post("/session/:sessionId/items/:sessionItemId/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await completeSessionItem(req.userId!, req.params.sessionId, req.params.sessionItemId);
    res.json(result);
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to update session progress" });
  }
});

// Update progress on a single resource (video watch % / article read %).
// The backend is the only thing that decides whether this resource is
// "completed" — the frontend only reports raw progress.
router.post("/:itemId/resource-progress", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { resourceId, progress } = req.body;
    if (!resourceId || typeof progress !== "number" || progress < 0 || progress > 100) {
      return res.status(400).json({ error: "resourceId and a numeric progress (0-100) are required" });
    }

    const item = await prisma.learningPathItem.findUnique({
      where: { id: req.params.itemId },
      include: { learningPath: true },
    });
    if (!item || item.learningPath.userId !== req.userId) return res.status(404).json({ error: "Not found" });
    if (item.status === "LOCKED") return res.status(403).json({ error: "This topic is locked" });

    const resource = await prisma.learningResource.findUnique({ where: { id: resourceId } });
    if (!resource || resource.skillId !== item.skillId) {
      return res.status(404).json({ error: "Resource not found for this topic" });
    }

    const existing = await prisma.resourceProgress.findUnique({
      where: { userId_resourceId: { userId: req.userId!, resourceId } },
    });
    // progress only moves forward — a stale/duplicate/backwards request can't undo real progress
    const newProgress = Math.max(existing?.progress ?? 0, Math.min(100, Math.round(progress)));
    const nowCompleted = newProgress >= resource.minProgressRequired;

    const resourceProgress = await prisma.resourceProgress.upsert({
      where: { userId_resourceId: { userId: req.userId!, resourceId } },
      update: {
        progress: newProgress,
        completed: nowCompleted || existing?.completed || false,
        lastAccessedAt: new Date(),
        completedAt: nowCompleted && !existing?.completed ? new Date() : existing?.completedAt,
      },
      create: {
        userId: req.userId!,
        resourceId,
        progress: newProgress,
        completed: nowCompleted,
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        completedAt: nowCompleted ? new Date() : null,
      },
    });

    // Record real learning activity the first time this resource is completed,
    // so analytics/statistics reflect actual content consumption from this flow
    // too (not only manually-logged Practice Hub activity).
    if (nowCompleted && !existing?.completed) {
      await prisma.learningActivity.create({
        data: {
          userId: req.userId!,
          skillId: item.skillId,
          activityType: resource.type === "VIDEO" ? "VIDEO" : "ARTICLE",
          duration: 10,
        },
      });
    }

    const progressPercent = await computeItemProgressPercent(req.userId!, item.skillId);
    const status = item.status === "CURRENT" ? "IN_PROGRESS" : item.status;
    await prisma.learningPathItem.update({
      where: { id: item.id },
      data: { status, progressPercent, lastAccessedAt: new Date() },
    });

    res.json({ resourceProgress, itemProgressPercent: progressPercent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// Attempt to complete a topic. The backend independently verifies every
// requirement (content consumed + quiz passed) before marking it
// COMPLETED — a request body claiming completion is never trusted.
router.post("/:itemId/complete", requireAuth, async (req: AuthRequest, res) => {
  try {
    const item = await prisma.learningPathItem.findUnique({
      where: { id: req.params.itemId },
      include: { learningPath: true, skill: true },
    });
    if (!item || item.learningPath.userId !== req.userId) return res.status(404).json({ error: "Not found" });

    if (item.status === "COMPLETED") {
      // idempotent: repeated completion requests don't error or double-unlock
      return res.json({ item, alreadyCompleted: true });
    }
    if (item.status === "LOCKED") return res.status(403).json({ error: "This topic is locked" });

    const requirements = await getItemRequirements(req.userId!, item.skillId);
    const unmet = requirements.filter((r) => !r.satisfied);
    if (unmet.length > 0) {
      return res.status(400).json({
        error: "This topic isn't ready to be completed yet",
        unmetRequirements: unmet,
      });
    }

    const updated = await prisma.learningPathItem.update({
      where: { id: item.id },
      data: { status: "COMPLETED", completedAt: new Date(), progressPercent: 100 },
    });

    await unlockAvailableItems(item.learningPathId);

    const path = await prisma.learningPath.findUnique({
      where: { id: item.learningPathId },
      include: { items: { include: { skill: true }, orderBy: { sequence: "asc" } } },
    });

    res.json({ item: updated, path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to complete topic" });
  }
});

export default router;
