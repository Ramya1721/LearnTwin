import { prisma } from "../utils/prisma";
import { buildAdjacency } from "./skillGraphService";
import { ensureDomainSkillGraph, unlockAvailableItems } from "./contentService";
import { normalizeLevel } from "../utils/contentTemplates";

export async function generateLearningPath(userId: string, goal: string, experienceLevel?: string) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const dna = await prisma.learningDna.findUnique({ where: { userId } });
  const level = normalizeLevel(experienceLevel || profile?.experienceLevel);

  const currentSkills = await prisma.userSkill.findMany({
    where: { userId },
    include: { skill: true },
    orderBy: { proficiency: "desc" },
  });

  const { domain, skills } = await ensureDomainSkillGraph(goal, level, {
    preferredLanguage: profile?.preferredLanguage || "English",
    objective: goal,
    availableHoursPerWeek: profile?.availableHoursPerWeek || 5,
    preferredLearningStyle: profile?.preferredLearningStyle || dna?.learningStyle || "Hands-on",
    theoryPreference: dna?.theoryPreference || "Medium",
    practicalPreference: dna?.practicalPreference || "High",
    sessionPreference: dna?.sessionPreference || "Short focused sessions",
    revisionRequirement: dna?.revisionRequirement || "Medium",
    problemSolvingStrength: dna?.problemSolvingStrength || "Developing",
    currentSkills: currentSkills.map((s) => ({ name: s.skill.name, proficiency: s.proficiency, status: s.status })),
  });

  const deps = await prisma.skillDependency.findMany({ where: { skillId: { in: skills.map((s) => s.id) } } });
  const adjacency = buildAdjacency(deps.map((d) => ({ skillId: d.skillId, prerequisiteSkillId: d.prerequisiteSkillId })));

  const placed: string[] = [];
  const placedSet = new Set<string>();
  const remaining = new Set(skills.map((s) => s.id));
  while (remaining.size > 0) {
    let progressed = false;
    for (const skillId of Array.from(remaining)) {
      const prereqs = adjacency.get(skillId) || [];
      if (prereqs.every((p) => placedSet.has(p) || !remaining.has(p))) {
        placed.push(skillId);
        placedSet.add(skillId);
        remaining.delete(skillId);
        progressed = true;
      }
    }
    if (!progressed) {
      for (const id of remaining) placed.push(id);
      remaining.clear();
    }
  }

  await prisma.learningPath.updateMany({ where: { userId, status: "ACTIVE" }, data: { status: "ARCHIVED" } });
  const path = await prisma.learningPath.create({ data: { userId, goal, status: "ACTIVE" } });
  const proficiencyMap = new Map(currentSkills.map((us) => [us.skillId, us.proficiency]));

  // Advanced/intermediate learners can bypass genuinely mastered foundations,
  // but those rows are SKIPPED rather than falsely marked COMPLETED. Completion
  // always comes from ResourceProgress + checkpoints + a passing assessment.
  const skipFraction = level === "advanced" ? 0.55 : level === "intermediate" ? 0.25 : 0;
  const candidateSkipCount = Math.floor(placed.length * skipFraction);

  const itemsData = placed.map((skillId, idx) => {
    const proficiency = proficiencyMap.get(skillId) ?? 0;
    const status = idx < candidateSkipCount && proficiency >= 60 ? "SKIPPED" : "LOCKED";
    return {
      learningPathId: path.id,
      skillId,
      sequence: idx,
      status,
      recommendedReason:
        status === "SKIPPED"
          ? `Skipped as an initial review based on your ${proficiency}% proficiency; you can revisit it anytime.`
          : idx === 0
            ? `First recommended topic for your goal: ${domain}.`
            : null,
    };
  });

  await prisma.learningPathItem.createMany({ data: itemsData });
  await unlockAvailableItems(path.id);

  // If the first skill was not skippable, unlockAvailableItems will make it CURRENT.
  // If a branch was skipped, every prerequisite-satisfied branch becomes CURRENT.
  return prisma.learningPath.findUnique({
    where: { id: path.id },
    include: { items: { include: { skill: true }, orderBy: { sequence: "asc" } } },
  });
}

export async function getActivePath(userId: string) {
  return prisma.learningPath.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { items: { include: { skill: true }, orderBy: { sequence: "asc" } } },
  });
}
