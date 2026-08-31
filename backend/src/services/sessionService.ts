import { prisma } from "../utils/prisma";
import { computeItemProgressPercent } from "./contentService";

export interface SessionPlanItem {
  kind: "VIDEO_SEGMENT" | "RESOURCE" | "QUIZ";
  refId: string;
  title: string;
  estimatedMinutes: number;
}

function clampSeconds(value: number) {
  return Math.max(0, Math.round(value * 10) / 10);
}

async function getOwnedItem(userId: string, itemId: string) {
  const item = await prisma.learningPathItem.findUnique({ where: { id: itemId }, include: { learningPath: true } });
  if (!item || item.learningPath.userId !== userId) throw Object.assign(new Error("Not found"), { status: 404 });
  if (item.status === "LOCKED") throw Object.assign(new Error("This topic is locked"), { status: 403 });
  return item;
}

async function buildPlan(skillId: string, targetMinutes: number, startTimeSeconds = 0): Promise<SessionPlanItem[]> {
  const resources = await prisma.learningResource.findMany({
    where: { skillId },
    orderBy: { order: "asc" },
    include: { segments: { orderBy: { order: "asc" } } },
  });
  const assessment = await prisma.assessment.findFirst({ where: { skillId }, include: { questions: true } });
  const video = resources.find((r) => r.type === "VIDEO" && r.youtubeVideoId);
  const plan: SessionPlanItem[] = [];

  if (video?.segments.length) {
    let remaining = targetMinutes * 60;
    for (const segment of video.segments) {
      if (segment.endSeconds <= startTimeSeconds + 2) continue;
      const effectiveStart = Math.max(segment.startSeconds, startTimeSeconds);
      const segmentSeconds = Math.max(1, segment.endSeconds - effectiveStart);
      if (plan.length > 0 && remaining < 60) break;
      plan.push({ kind: "VIDEO_SEGMENT", refId: segment.id, title: segment.title, estimatedMinutes: Math.max(1, Math.round(segmentSeconds / 60)) });
      remaining -= segmentSeconds;
      if (remaining <= 0) break;
    }
    if (!plan.length) plan.push({ kind: "VIDEO_SEGMENT", refId: video.segments[video.segments.length - 1].id, title: video.segments[video.segments.length - 1].title, estimatedMinutes: 1 });
  } else if (video) {
    plan.push({ kind: "RESOURCE", refId: video.id, title: video.title, estimatedMinutes: Math.max(1, targetMinutes) });
  } else {
    const article = resources.find((r) => r.type === "ARTICLE");
    if (article) plan.push({ kind: "RESOURCE", refId: article.id, title: article.title, estimatedMinutes: Math.max(2, targetMinutes) });
  }

  if (!video && assessment?.questions.length) {
    plan.push({ kind: "QUIZ", refId: assessment.id, title: assessment.title, estimatedMinutes: Math.max(2, Math.min(5, Math.round(assessment.questions.length * 0.75))) });
  }
  return plan;
}

export async function createSession(userId: string, itemId: string, targetMinutes: number) {
  const item = await getOwnedItem(userId, itemId);
  await prisma.learningSession.updateMany({ where: { userId, learningPathItemId: itemId, status: "ACTIVE" }, data: { status: "ABANDONED" } });

  const video = await prisma.learningResource.findFirst({
    where: { skillId: item.skillId, type: "VIDEO", youtubeVideoId: { not: null } },
    orderBy: { order: "asc" },
    include: { segments: { orderBy: { order: "asc" } } },
  });
  const progress = video ? await prisma.resourceProgress.findUnique({ where: { userId_resourceId: { userId, resourceId: video.id } } }) : null;
  const startTimeSeconds = video ? clampSeconds(progress?.currentTimeSeconds ?? 0) : null;
  const plan = await buildPlan(item.skillId, targetMinutes, startTimeSeconds || 0);

  let targetEndTimeSeconds: number | null = null;
  if (video) {
    const lastSegmentId = [...plan].reverse().find((p) => p.kind === "VIDEO_SEGMENT")?.refId;
    const lastSegment = lastSegmentId ? video.segments.find((s) => s.id === lastSegmentId) : null;
    const requestedEnd = (startTimeSeconds || 0) + targetMinutes * 60;
    targetEndTimeSeconds = clampSeconds(lastSegment?.endSeconds ?? Math.min(requestedEnd, video.durationSeconds || requestedEnd));
    if (targetEndTimeSeconds <= (startTimeSeconds || 0)) targetEndTimeSeconds = clampSeconds(Math.min(requestedEnd, video.durationSeconds || requestedEnd));
  }

  return prisma.learningSession.create({
    data: {
      userId,
      learningPathItemId: itemId,
      targetMinutes,
      requestedDurationMinutes: targetMinutes,
      videoResourceId: video?.id,
      startTimeSeconds,
      targetEndTimeSeconds,
      items: { create: plan.map((p, idx) => ({ order: idx, kind: p.kind, refId: p.refId, title: p.title, estimatedMinutes: p.estimatedMinutes })) },
    },
    include: { items: { orderBy: { order: "asc" } }, videoResource: true },
  });
}

export async function getActiveSession(userId: string, itemId: string) {
  return prisma.learningSession.findFirst({
    where: { userId, learningPathItemId: itemId, status: "ACTIVE" },
    include: { items: { orderBy: { order: "asc" } }, videoResource: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function saveVideoProgress(userId: string, itemId: string, resourceId: string, currentTimeSeconds: number, durationSeconds: number) {
  const item = await getOwnedItem(userId, itemId);
  const resource = await prisma.learningResource.findUnique({ where: { id: resourceId } });
  if (!resource || resource.skillId !== item.skillId || resource.type !== "VIDEO") throw Object.assign(new Error("Video resource not found for this topic"), { status: 404 });

  const safeDuration = Math.max(1, Math.round(durationSeconds || resource.durationSeconds || 1));
  const safeCurrent = Math.min(safeDuration, Math.max(0, Number(currentTimeSeconds) || 0));
  const percentage = Math.min(100, Math.round((safeCurrent / safeDuration) * 100));
  const existing = await prisma.resourceProgress.findUnique({ where: { userId_resourceId: { userId, resourceId } } });
  const progress = Math.max(existing?.progress ?? 0, percentage);
  const completed = Boolean(existing?.completed || progress >= resource.minProgressRequired);

  const resourceProgress = await prisma.resourceProgress.upsert({
    where: { userId_resourceId: { userId, resourceId } },
    update: {
      progress,
      percentageWatched: Math.max(existing?.percentageWatched ?? 0, percentage),
      currentTimeSeconds: safeCurrent,
      durationSeconds: safeDuration,
      completed,
      startedAt: existing?.startedAt ?? new Date(),
      lastAccessedAt: new Date(),
      completedAt: completed && !existing?.completed ? new Date() : existing?.completedAt,
    },
    create: { userId, resourceId, progress, percentageWatched: percentage, currentTimeSeconds: safeCurrent, durationSeconds: safeDuration, completed, startedAt: new Date(), lastAccessedAt: new Date(), completedAt: completed ? new Date() : null },
  });

  await prisma.learningPathItem.update({ where: { id: item.id }, data: { status: item.status === "CURRENT" ? "IN_PROGRESS" : item.status, lastAccessedAt: new Date() } });
  return { resourceProgress, itemProgressPercent: await computeItemProgressPercent(userId, item.skillId) };
}

export async function completeSessionBoundary(userId: string, sessionId: string, actualEndTimeSeconds: number) {
  const session = await prisma.learningSession.findUnique({ where: { id: sessionId }, include: { learningPathItem: true, videoResource: true, items: true } });
  if (!session || session.userId !== userId) throw Object.assign(new Error("Not found"), { status: 404 });
  if (!session.videoResourceId || !session.videoResource || session.targetEndTimeSeconds == null) throw Object.assign(new Error("This session has no video boundary"), { status: 400 });

  const actual = clampSeconds(actualEndTimeSeconds);
  const target = session.targetEndTimeSeconds;
  if (actual + 30 < target) throw Object.assign(new Error(`Keep watching until approximately ${Math.ceil(target)} seconds.`), { status: 400 });

  await saveVideoProgress(userId, session.learningPathItemId, session.videoResourceId, actual, session.videoResource.durationSeconds || Math.max(target, actual, 1));
  for (const item of session.items.filter((i) => i.kind === "RESOURCE" && i.refId === session.videoResourceId && !i.completed)) await prisma.sessionItem.update({ where: { id: item.id }, data: { completed: true, completedAt: new Date() } });
  for (const item of session.items.filter((i) => i.kind === "VIDEO_SEGMENT" && !i.completed)) {
    const segment = await prisma.videoSegment.findUnique({ where: { id: item.refId } });
    if (segment && actual + 2 >= segment.endSeconds) await prisma.sessionItem.update({ where: { id: item.id }, data: { completed: true, completedAt: new Date() } });
  }

  const updated = await prisma.learningSession.update({ where: { id: sessionId }, data: { status: "COMPLETED", actualEndTimeSeconds: actual, lastAccessedAt: new Date(), completedAt: new Date() }, include: { items: { orderBy: { order: "asc" } }, videoResource: true } });
  return { session: updated, itemProgressPercent: await computeItemProgressPercent(userId, session.learningPathItem.skillId) };
}

export async function completeSessionItem(userId: string, sessionId: string, sessionItemId: string) {
  const session = await prisma.learningSession.findUnique({ where: { id: sessionId }, include: { items: true, learningPathItem: true } });
  if (!session || session.userId !== userId) throw Object.assign(new Error("Not found"), { status: 404 });
  const sessionItem = session.items.find((i) => i.id === sessionItemId);
  if (!sessionItem) throw Object.assign(new Error("Session item not found"), { status: 404 });
  if (sessionItem.kind === "VIDEO_SEGMENT") throw Object.assign(new Error("Video segments are completed by reaching their real timestamp"), { status: 400 });

  if (!sessionItem.completed) {
    await prisma.sessionItem.update({ where: { id: sessionItemId }, data: { completed: true, completedAt: new Date() } });
    if (sessionItem.kind === "RESOURCE") {
      const resource = await prisma.learningResource.findUnique({ where: { id: sessionItem.refId } });
      if (resource) await upsertResourceProgress(userId, resource.id, 100, resource.minProgressRequired);
    }
  }

  const remaining = await prisma.sessionItem.count({ where: { sessionId, completed: false } });
  await prisma.learningSession.update({ where: { id: sessionId }, data: remaining === 0 ? { status: "COMPLETED", completedAt: new Date() } : { lastAccessedAt: new Date() } });
  const updated = await prisma.learningSession.findUnique({ where: { id: sessionId }, include: { items: { orderBy: { order: "asc" } }, videoResource: true } });
  return { session: updated, itemProgressPercent: await computeItemProgressPercent(userId, session.learningPathItem.skillId) };
}

async function upsertResourceProgress(userId: string, resourceId: string, progress: number, minProgressRequired: number) {
  const existing = await prisma.resourceProgress.findUnique({ where: { userId_resourceId: { userId, resourceId } } });
  const newProgress = Math.max(existing?.progress ?? 0, progress);
  const nowCompleted = newProgress >= minProgressRequired;
  await prisma.resourceProgress.upsert({
    where: { userId_resourceId: { userId, resourceId } },
    update: { progress: newProgress, percentageWatched: Math.max(existing?.percentageWatched ?? 0, newProgress), completed: nowCompleted || existing?.completed || false, lastAccessedAt: new Date(), completedAt: nowCompleted && !existing?.completed ? new Date() : existing?.completedAt },
    create: { userId, resourceId, progress: newProgress, percentageWatched: newProgress, completed: nowCompleted, startedAt: new Date(), lastAccessedAt: new Date(), completedAt: nowCompleted ? new Date() : null },
  });
}
