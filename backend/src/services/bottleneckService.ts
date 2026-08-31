import { prisma } from "../utils/prisma";

export type BottleneckType =
  | "PASSIVE_LEARNING"
  | "THEORY_PRACTICE_IMBALANCE"
  | "FOUNDATION_GAP"
  | "DIFFICULTY_MISMATCH"
  | "CONSISTENCY_BOTTLENECK"
  | "REVISION_BOTTLENECK";

export interface DetectedBottleneck {
  type: BottleneckType;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
}

export interface ActivityStats {
  videoCount: number;
  articleCount: number;
  practiceCount: number;
  projectCount: number;
  theoryMinutes: number;
  practiceMinutes: number;
  activeDaysLast14: number;
  revisionCount: number;
  distinctSkillsTouched: number;
}

const THEORY_TYPES = new Set(["VIDEO", "ARTICLE"]);
const PRACTICE_TYPES = new Set(["PRACTICE", "PROJECT"]);

/** Pure function: compute activity stats from a raw activity list. Unit-testable. */
export function computeActivityStats(
  activities: { activityType: string; duration: number; completedAt: Date; skillId: string | null }[]
): ActivityStats {
  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  let videoCount = 0,
    articleCount = 0,
    practiceCount = 0,
    projectCount = 0,
    revisionCount = 0,
    theoryMinutes = 0,
    practiceMinutes = 0;

  const activeDays = new Set<string>();
  const skillsTouched = new Set<string>();

  for (const a of activities) {
    if (a.activityType === "VIDEO") videoCount++;
    if (a.activityType === "ARTICLE") articleCount++;
    if (a.activityType === "PRACTICE") practiceCount++;
    if (a.activityType === "PROJECT") projectCount++;
    if (a.activityType === "REVISION") revisionCount++;

    if (THEORY_TYPES.has(a.activityType)) theoryMinutes += a.duration;
    if (PRACTICE_TYPES.has(a.activityType)) practiceMinutes += a.duration;

    if (a.skillId) skillsTouched.add(a.skillId);

    const diff = now - new Date(a.completedAt).getTime();
    if (diff <= fourteenDaysMs) {
      activeDays.add(new Date(a.completedAt).toDateString());
    }
  }

  return {
    videoCount,
    articleCount,
    practiceCount,
    projectCount,
    theoryMinutes,
    practiceMinutes,
    activeDaysLast14: activeDays.size,
    revisionCount,
    distinctSkillsTouched: skillsTouched.size,
  };
}

/**
 * Pure rule-based bottleneck detector. Takes activity stats + assessment
 * failure info and returns a list of detected bottlenecks. No AI required.
 */
export function detectBottlenecks(
  stats: ActivityStats,
  opts: {
    advancedSkillFailures: number; // count of assessment attempts with score < 50 on "advanced" skills
    weakestPrerequisiteScore: number | null; // 0-100, from skillGraphService, null if n/a
    difficultyMismatchCount: number; // attempts on content well above current level
  }
): DetectedBottleneck[] {
  const results: DetectedBottleneck[] = [];

  // 1. PASSIVE LEARNING: high consumption, low application
  const contentCount = stats.videoCount + stats.articleCount;
  if (contentCount > 10 && stats.practiceCount < 3) {
    results.push({
      type: "PASSIVE_LEARNING",
      severity: contentCount > 20 && stats.practiceCount === 0 ? "HIGH" : "MEDIUM",
      description: `You consumed ${contentCount} pieces of content (videos/articles) but completed only ${stats.practiceCount} practice exercises. Passive consumption without application slows real skill growth.`,
    });
  }

  // 2. THEORY / PRACTICE IMBALANCE
  const totalMinutes = stats.theoryMinutes + stats.practiceMinutes;
  if (totalMinutes > 0 && stats.theoryMinutes / totalMinutes > 0.75) {
    const pct = Math.round((stats.theoryMinutes / totalMinutes) * 100);
    results.push({
      type: "THEORY_PRACTICE_IMBALANCE",
      severity: pct > 90 ? "HIGH" : "MEDIUM",
      description: `${pct}% of your learning time is theory-based versus hands-on practice. Increasing practical exercises will improve retention.`,
    });
  }

  // 3. FOUNDATION GAP
  if (opts.advancedSkillFailures >= 2 && opts.weakestPrerequisiteScore !== null && opts.weakestPrerequisiteScore < 60) {
    results.push({
      type: "FOUNDATION_GAP",
      severity: opts.weakestPrerequisiteScore < 40 ? "HIGH" : "MEDIUM",
      description: `Repeated difficulty with advanced concepts (${opts.advancedSkillFailures} failed attempts) traces back to a weak foundational skill scoring ${opts.weakestPrerequisiteScore}%.`,
    });
  }

  // 4. DIFFICULTY MISMATCH
  if (opts.difficultyMismatchCount >= 2) {
    results.push({
      type: "DIFFICULTY_MISMATCH",
      severity: opts.difficultyMismatchCount >= 4 ? "HIGH" : "LOW",
      description: `You've attempted content significantly above your current proficiency ${opts.difficultyMismatchCount} times. Stepping back to intermediate material may help.`,
    });
  }

  // 5. CONSISTENCY BOTTLENECK
  if (stats.activeDaysLast14 < 4) {
    results.push({
      type: "CONSISTENCY_BOTTLENECK",
      severity: stats.activeDaysLast14 <= 1 ? "HIGH" : "MEDIUM",
      description: `Only ${stats.activeDaysLast14} active learning day(s) in the last 14 days. Shorter, more frequent sessions build stronger retention than sporadic long ones.`,
    });
  }

  // 6. REVISION BOTTLENECK
  if (stats.distinctSkillsTouched >= 5 && stats.revisionCount === 0) {
    results.push({
      type: "REVISION_BOTTLENECK",
      severity: "LOW",
      description: `You've moved across ${stats.distinctSkillsTouched} different skills without revisiting any of them. Scheduling revision checkpoints prevents knowledge decay.`,
    });
  }

  return results;
}

/** DB-backed orchestration: analyze a user and persist detected bottlenecks. */
export async function analyzeAndPersistBottlenecks(userId: string) {
  const activities = await prisma.learningActivity.findMany({ where: { userId } });
  const stats = computeActivityStats(activities);

  const attempts = await prisma.assessmentAttempt.findMany({
    where: { userId },
    include: { assessment: { include: { skill: true } } },
  });

  const advancedSkillFailures = attempts.filter(
    (a) => a.score < 50 && (a.assessment.difficulty === "ADVANCED" || a.assessment.difficulty === "INTERMEDIATE")
  ).length;

  const difficultyMismatchCount = attempts.filter((a) => a.score < 30).length;

  // find weakest prerequisite among failed skills using skill graph
  const { findWeakestDependencyForUser } = await import("./skillGraphService");
  let weakestPrerequisiteScore: number | null = null;
  const failedAttempt = attempts.find((a) => a.score < 50);
  if (failedAttempt) {
    const result = await findWeakestDependencyForUser(userId, failedAttempt.assessment.skillId);
    if (result.weakestSkillId) {
      const userSkill = await prisma.userSkill.findUnique({
        where: { userId_skillId: { userId, skillId: result.weakestSkillId } },
      });
      weakestPrerequisiteScore = userSkill?.proficiency ?? 0;
    }
  }

  const detected = detectBottlenecks(stats, {
    advancedSkillFailures,
    weakestPrerequisiteScore,
    difficultyMismatchCount,
  });

  // clear previous active bottlenecks of the same types, then persist fresh ones
  await prisma.bottleneck.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "RESOLVED" },
  });

  const created = [];
  for (const b of detected) {
    const record = await prisma.bottleneck.create({
      data: {
        userId,
        type: b.type,
        severity: b.severity,
        description: b.description,
        status: "ACTIVE",
      },
    });
    created.push(record);
  }

  return { stats, detected: created };
}
