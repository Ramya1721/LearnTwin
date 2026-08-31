import { prisma } from "../utils/prisma";
import { generatePersonalizedInsight, TwinSnapshot } from "./aiService";

export interface DigitalTwinView {
  goal: string;
  skills: { skillId: string; name: string; proficiency: number; status: string }[];
  strengths: string[];
  weaknesses: string[];
  learningDna: {
    learningStyle: string;
    theoryPreference: string;
    practicalPreference: string;
    revisionRequirement: string;
    problemSolvingStrength: string;
    consistencyScore: number;
    contentConsumptionScore: number;
    applicationRateScore: number;
    inferredNote: string | null;
  } | null;
  activeBottlenecks: { id: string; type: string; severity: string; description: string }[];
  currentBottleneckLabel: string;
  insight: string;
}

/** Builds the full Digital Twin view for a user, recomputing derived fields. */
export async function getDigitalTwin(userId: string): Promise<DigitalTwinView> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const userSkills = await prisma.userSkill.findMany({
    where: { userId },
    include: { skill: true },
  });
  const dna = await prisma.learningDna.findUnique({ where: { userId } });
  const bottlenecks = await prisma.bottleneck.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { detectedAt: "desc" },
  });

  const sorted = [...userSkills].sort((a, b) => b.proficiency - a.proficiency);
  const strengths = sorted.slice(0, 2).filter((s) => s.proficiency >= 60).map((s) => s.skill.name);
  const weaknesses = sorted
    .slice()
    .reverse()
    .slice(0, 2)
    .filter((s) => s.proficiency < 60)
    .map((s) => s.skill.name);

  const skillProficiency: Record<string, number> = {};
  for (const us of userSkills) skillProficiency[us.skill.name] = us.proficiency;

  const insight = await generatePersonalizedInsight({
    learningStyle: dna?.learningStyle || "Balanced Learner",
    bottleneckTypes: bottlenecks.map((b) => b.type),
    strongestSkill: strengths[0] || "your foundational skills",
    weakestSkill: weaknesses[0] || "advanced topics",
  });

  return {
    goal: profile?.careerGoal || "Not set",
    skills: userSkills.map((us) => ({
      skillId: us.skillId,
      name: us.skill.name,
      proficiency: us.proficiency,
      status: us.status,
    })),
    strengths: strengths.length ? strengths : ["Consistent effort"],
    weaknesses: weaknesses.length ? weaknesses : [],
    learningDna: dna
      ? {
          learningStyle: dna.learningStyle,
          theoryPreference: dna.theoryPreference,
          practicalPreference: dna.practicalPreference,
          revisionRequirement: dna.revisionRequirement,
          problemSolvingStrength: dna.problemSolvingStrength,
          consistencyScore: dna.consistencyScore,
          contentConsumptionScore: dna.contentConsumptionScore,
          applicationRateScore: dna.applicationRateScore,
          inferredNote: dna.inferredNote,
        }
      : null,
    activeBottlenecks: bottlenecks.map((b) => ({
      id: b.id,
      type: b.type,
      severity: b.severity,
      description: b.description,
    })),
    currentBottleneckLabel: bottlenecks[0]
      ? bottlenecks[0].type.replace(/_/g, " ")
      : "None detected",
    insight,
  };
}

export async function toTwinSnapshot(userId: string): Promise<TwinSnapshot> {
  const view = await getDigitalTwin(userId);
  const corrections = await prisma.pathCorrection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const skillProficiency: Record<string, number> = {};
  for (const s of view.skills) skillProficiency[s.name] = s.proficiency;

  return {
    goal: view.goal,
    strengths: view.strengths,
    weaknesses: view.weaknesses,
    learningStyle: view.learningDna?.learningStyle || "Balanced Learner",
    consistencyScore: view.learningDna?.consistencyScore || 50,
    activeBottlenecks: view.activeBottlenecks.map((b) => ({ type: b.type, description: b.description })),
    recentCorrections: corrections.map((c) => ({ reason: c.reason })),
    skillProficiency,
  };
}

/**
 * Re-infers Learning DNA from actual behavior vs self-reported preference.
 * E.g. learner says "I prefer videos" but quiz scores after videos are low
 * while hands-on challenge success is high -> flip inferred style.
 */
export async function reconcileLearningDna(userId: string) {
  const dna = await prisma.learningDna.findUnique({ where: { userId } });
  if (!dna) return;

  const activities = await prisma.learningActivity.findMany({ where: { userId } });
  const videoCount = activities.filter((a) => a.activityType === "VIDEO").length;
  const practiceCount = activities.filter((a) => a.activityType === "PRACTICE").length;

  const attempts = await prisma.assessmentAttempt.findMany({ where: { userId } });
  const avgScore = attempts.length
    ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
    : 50;

  let inferredNote: string | null = null;
  let newStyle = dna.learningStyle;

  if (dna.theoryPreference === "High" && videoCount >= 10 && avgScore < 55 && practiceCount >= 3) {
    newStyle = "Hands-on Explorer";
    inferredNote =
      "You reported a preference for video-based learning, but quiz performance after videos has been low while practical exercises show stronger results. We've updated your Learning DNA to reflect a hands-on learning style.";
  }

  const totalActivities = activities.length || 1;
  const contentConsumptionScore = Math.min(
    100,
    Math.round(((videoCount + activities.filter((a) => a.activityType === "ARTICLE").length) / totalActivities) * 100)
  );
  const applicationRateScore = Math.min(100, Math.round((practiceCount / totalActivities) * 100));

  await prisma.learningDna.update({
    where: { userId },
    data: {
      learningStyle: newStyle,
      inferredNote,
      contentConsumptionScore,
      applicationRateScore,
    },
  });
}
