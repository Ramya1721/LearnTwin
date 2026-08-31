import { prisma } from "../utils/prisma";
import { generateCorrectedPathForUser } from "./skillGraphService";
import { explainPathCorrection } from "./aiService";

export interface PathCorrectionResult {
  correctionId: string;
  reason: string;
  oldPath: { skillId: string; name: string }[];
  newPath: { skillId: string; name: string }[];
  weakestSkillId: string | null;
}

/**
 * Looks at a user's active learning path + recent assessment failures,
 * determines whether correction is needed via the skill dependency graph,
 * and if so rewrites the path, persists the correction, and returns an
 * explainable result.
 */
export async function analyzeAndCorrectPath(userId: string): Promise<PathCorrectionResult | null> {
  const activePath = await prisma.learningPath.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { items: { include: { skill: true }, orderBy: { sequence: "asc" } } },
  });
  if (!activePath) return null;

  // find the first "current" or "locked" item the learner is failing on
  const recentAttempts = await prisma.assessmentAttempt.findMany({
    where: { userId },
    include: { assessment: true },
    orderBy: { attemptedAt: "desc" },
    take: 10,
  });

  const failingSkillIds = new Set(
    recentAttempts.filter((a) => a.score < 50).map((a) => a.assessment.skillId)
  );

  const targetItem = activePath.items.find(
    (item) => failingSkillIds.has(item.skillId) || item.status === "FAILED" || item.status === "WEAK"
  );

  if (!targetItem) return null;

  const graphResult = await generateCorrectedPathForUser(userId, targetItem.skillId);
  if (!graphResult || !graphResult.weakestSkillId) return null;

  const { correctedSequenceIds, weakestSkillId, skillsById } = graphResult;

  const oldPath = activePath.items.map((i) => ({ skillId: i.skillId, name: i.skill.name }));

  // Build the new item list: keep completed items, then splice in corrected sequence
  // starting from just before the target item, replacing anything already
  // planned for those same skills.
  const targetIndex = activePath.items.findIndex((i) => i.id === targetItem.id);
  const keptBefore = activePath.items.slice(0, targetIndex).filter((i) => i.status === "COMPLETED");
  const afterTarget = activePath.items.slice(targetIndex + 1);

  const newSkillSequence = [
    ...keptBefore.map((i) => i.skillId),
    ...correctedSequenceIds,
    ...afterTarget.map((i) => i.skillId).filter((id) => !correctedSequenceIds.includes(id)),
  ];

  // dedupe while preserving order
  const seen = new Set<string>();
  const dedupedSequence = newSkillSequence.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const weakSkill = skillsById[weakestSkillId];
  const targetSkill = skillsById[targetItem.skillId];

  const reason = await explainPathCorrection({
    weakSkillName: weakSkill?.name || "a foundational concept",
    strugglingSkillName: targetSkill?.name || targetItem.skill.name,
  });

  // Persist: delete old items, recreate in corrected order
  await prisma.$transaction([
    prisma.learningPathItem.deleteMany({ where: { learningPathId: activePath.id } }),
  ]);

  const newItemsData = dedupedSequence.map((skillId, idx) => {
    let status = "LOCKED";
    let recommendedReason: string | undefined = undefined;
    const wasCompleted = keptBefore.some((k) => k.skillId === skillId);
    if (wasCompleted) status = "COMPLETED";
    else if (idx === keptBefore.length) status = "CURRENT";
    if (skillId === weakestSkillId) {
      recommendedReason = `Inserted as revision: root cause of repeated failure in ${targetSkill?.name}.`;
    }
    return {
      learningPathId: activePath.id,
      skillId,
      sequence: idx,
      status,
      recommendedReason,
    };
  });

  await prisma.learningPathItem.createMany({ data: newItemsData });

  const newPath = dedupedSequence.map((id) => ({ skillId: id, name: skillsById[id]?.name || id }));

  const correction = await prisma.pathCorrection.create({
    data: {
      userId,
      learningPathId: activePath.id,
      reason,
      oldPath: JSON.stringify(oldPath),
      newPath: JSON.stringify(newPath),
    },
  });

  await prisma.recommendation.create({
    data: {
      userId,
      type: "PATH_CORRECTION",
      title: `Revise ${weakSkill?.name || "prerequisite"} before continuing`,
      description: reason,
      reason: `Weakest dependency detected: ${weakSkill?.name} (${weakestSkillId})`,
      priority: "HIGH",
    },
  });

  return {
    correctionId: correction.id,
    reason,
    oldPath,
    newPath,
    weakestSkillId,
  };
}
