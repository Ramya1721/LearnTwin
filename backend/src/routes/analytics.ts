import { Router } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { computeActivityStats } from "../services/bottleneckService";
import { estimateItemMinutes } from "../services/contentService";

const router = Router();

router.get("/dashboard", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const [userSkills, activities, attempts, bottlenecks, corrections, path, profile, weakConcepts] = await Promise.all([
    prisma.userSkill.findMany({ where: { userId }, include: { skill: true } }),
    prisma.learningActivity.findMany({ where: { userId } }),
    prisma.assessmentAttempt.findMany({
      where: { userId },
      include: { assessment: { include: { skill: true } } },
      orderBy: { attemptedAt: "asc" },
    }),
    prisma.bottleneck.findMany({ where: { userId, status: "ACTIVE" } }),
    prisma.pathCorrection.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.learningPath.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { items: { include: { skill: true }, orderBy: { sequence: "asc" } } },
    }),
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.recommendation.findMany({ where: { userId, status: "OPEN", type: "CONCEPT_REVIEW" }, orderBy: { priority: "desc" }, take: 3 }),
  ]);

  const stats = computeActivityStats(activities);

  // weekly activity: last 7 days bucketed
  const weekly: { day: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
    const minutes = activities
      .filter((a) => new Date(a.completedAt).toDateString() === d.toDateString())
      .reduce((sum, a) => sum + a.duration, 0);
    weekly.push({ day: dayLabel, minutes });
  }

  const skillRadar = userSkills.map((us) => ({ skill: us.skill.name, proficiency: us.proficiency }));

  const theoryVsPractice = {
    theory: stats.theoryMinutes,
    practice: stats.practiceMinutes,
  };

  const assessmentTrend = attempts.map((a) => ({
    skill: a.assessment.skill.name,
    score: a.score,
    date: a.attemptedAt,
  }));

  const currentItem = path?.items.find((i) => i.status === "CURRENT" || i.status === "IN_PROGRESS");
  const currentVideo = currentItem
    ? await prisma.learningResource.findFirst({
        where: { skillId: currentItem.skillId, type: "VIDEO", youtubeVideoId: { not: null } },
        orderBy: { order: "asc" },
        include: { progress: { where: { userId } } },
      })
    : null;
  const currentAssessment = currentItem
    ? await prisma.assessment.findFirst({ where: { skillId: currentItem.skillId }, orderBy: { languageCode: "asc" } })
    : null;
  const currentBestAttempt = currentAssessment
    ? await prisma.assessmentAttempt.findFirst({ where: { userId, assessmentId: currentAssessment.id }, orderBy: { score: "desc" } })
    : null;
  const completedCount = path?.items.filter((i) => i.status === "COMPLETED").length || 0;
  const skippedCount = path?.items.filter((i) => i.status === "SKIPPED").length || 0;
  const totalCount = path?.items.length || 0;

  res.json({
    summary: {
      currentGoal: profile?.careerGoal || "Not set",
      completedSkills: completedCount,
      totalSkills: totalCount,
      skippedSkills: skippedCount,
      currentMilestone: currentItem?.skill.name || (completedCount + skippedCount >= totalCount && totalCount > 0 ? "Path complete" : "Not started"),
      activeBottleneckCount: bottlenecks.length,
      learningStreakDays: stats.activeDaysLast14,
    },
    skillRadar,
    theoryVsPractice,
    weeklyActivity: weekly,
    assessmentTrend,
    bottlenecks,
    recentCorrections: corrections.map((c) => ({
      ...c,
      oldPath: JSON.parse(c.oldPath),
      newPath: JSON.parse(c.newPath),
    })),
    weakConcepts: weakConcepts.map((w) => ({ concept: w.title, description: w.description, priority: w.priority })),
    nextUp: currentItem
      ? {
          itemId: currentItem.id,
          skillName: currentItem.skill.name,
          estimatedMinutes: await estimateItemMinutes(currentItem.skillId),
          videoProgress: currentVideo?.progress[0]?.percentageWatched ?? currentVideo?.progress[0]?.progress ?? 0,
          videoTitle: currentVideo?.title ?? null,
          videoCurrentTimeSeconds: currentVideo?.progress[0]?.currentTimeSeconds ?? 0,
          bestQuizScore: currentBestAttempt?.score ?? null,
        }
      : null,
  });
});

export default router;
