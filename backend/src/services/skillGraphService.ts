import { prisma } from "../utils/prisma";

export interface SkillNode {
  id: string;
  name: string;
  domain: string;
  description: string;
  difficulty: string;
}

export interface GraphEdge {
  skillId: string;
  prerequisiteSkillId: string;
}

/**
 * Pure, DB-free graph builder so this logic can be unit tested and reused.
 */
export function buildAdjacency(edges: GraphEdge[]): Map<string, string[]> {
  // map: skillId -> list of prerequisite skillIds
  const map = new Map<string, string[]>();
  for (const e of edges) {
    if (!map.has(e.skillId)) map.set(e.skillId, []);
    map.get(e.skillId)!.push(e.prerequisiteSkillId);
  }
  return map;
}

/** Direct prerequisites of a skill */
export function directPrerequisites(skillId: string, adjacency: Map<string, string[]>): string[] {
  return adjacency.get(skillId) || [];
}

/** All transitive prerequisites of a skill, deepest-first (topological-ish order) */
export function allPrerequisitesRecursive(
  skillId: string,
  adjacency: Map<string, string[]>,
  visited: Set<string> = new Set()
): string[] {
  const result: string[] = [];
  const direct = directPrerequisites(skillId, adjacency);
  for (const p of direct) {
    if (visited.has(p)) continue;
    visited.add(p);
    // recurse first so deepest prerequisites come first
    result.push(...allPrerequisitesRecursive(p, adjacency, visited));
    result.push(p);
  }
  return result;
}

export interface ProficiencyMap {
  [skillId: string]: number; // 0-100
}

/**
 * Given a skill the learner is struggling with, walk its prerequisite chain
 * and find the root cause. This is the root-cause detector behind the
 * Failure-Aware Learning Engine.
 *
 * IMPORTANT: this deliberately returns the DEEPEST (most foundational)
 * skill below the threshold, not just the single lowest-scoring one.
 * Example: a learner failing "Async/Await" may score low on both
 * "Promises" (30%) and "Callbacks" (40%) — even though Promises has the
 * lower raw number, Callbacks is the true foundation, and fixing it
 * first is what actually unblocks Promises and everything after it.
 * `allPrerequisitesRecursive` already returns the chain deepest-first,
 * so the first weak entry in that order is the foundation-most gap.
 */
export function findWeakestDependency(
  skillId: string,
  adjacency: Map<string, string[]>,
  proficiency: ProficiencyMap,
  threshold = 60
): { weakestSkillId: string | null; chain: string[] } {
  const chain = allPrerequisitesRecursive(skillId, adjacency);

  for (const skillIdInChain of chain) {
    const score = proficiency[skillIdInChain] ?? 0;
    if (score < threshold) {
      return { weakestSkillId: skillIdInChain, chain };
    }
  }

  return { weakestSkillId: null, chain };
}

/**
 * Given a target skill and known weak dependency, build the corrected
 * sequence of skillIds that should precede the target.
 */
export function buildCorrectedSequence(
  targetSkillId: string,
  weakestSkillId: string,
  adjacency: Map<string, string[]>
): string[] {
  const chain = allPrerequisitesRecursive(targetSkillId, adjacency);
  const weakIndex = chain.indexOf(weakestSkillId);
  // include everything from the weak skill onward (weak skill + everything that depends on it up to target)
  const relevant = weakIndex >= 0 ? chain.slice(weakIndex) : chain;
  return [...relevant, targetSkillId];
}

// ---------------- DB-backed convenience wrappers ----------------

export async function loadDomainGraph(domain: string) {
  const skills = await prisma.skill.findMany({ where: { domain } });
  const skillIds = skills.map((s) => s.id);
  const deps = await prisma.skillDependency.findMany({
    where: { skillId: { in: skillIds } },
  });
  const edges: GraphEdge[] = deps.map((d) => ({
    skillId: d.skillId,
    prerequisiteSkillId: d.prerequisiteSkillId,
  }));
  return { skills, adjacency: buildAdjacency(edges) };
}

export async function getUserProficiencyMap(userId: string): Promise<ProficiencyMap> {
  const userSkills = await prisma.userSkill.findMany({ where: { userId } });
  const map: ProficiencyMap = {};
  for (const us of userSkills) map[us.skillId] = us.proficiency;
  return map;
}

export async function findMissingPrerequisites(
  userId: string,
  skillId: string,
  threshold = 60
): Promise<string[]> {
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) return [];
  const { adjacency } = await loadDomainGraph(skill.domain);
  const proficiency = await getUserProficiencyMap(userId);
  const chain = allPrerequisitesRecursive(skillId, adjacency);
  return chain.filter((id) => (proficiency[id] ?? 0) < threshold);
}

export async function findWeakestDependencyForUser(userId: string, skillId: string) {
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) return { weakestSkillId: null, chain: [] as string[] };
  const { adjacency } = await loadDomainGraph(skill.domain);
  const proficiency = await getUserProficiencyMap(userId);
  return findWeakestDependency(skillId, adjacency, proficiency);
}

export async function generateCorrectedPathForUser(userId: string, targetSkillId: string) {
  const skill = await prisma.skill.findUnique({ where: { id: targetSkillId } });
  if (!skill) return null;
  const { adjacency, skills } = await loadDomainGraph(skill.domain);
  const proficiency = await getUserProficiencyMap(userId);
  const { weakestSkillId, chain } = findWeakestDependency(targetSkillId, adjacency, proficiency);

  if (!weakestSkillId) {
    return { correctedSequenceIds: [targetSkillId], weakestSkillId: null, chain, skillsById: indexById(skills) };
  }

  const correctedSequenceIds = buildCorrectedSequence(targetSkillId, weakestSkillId, adjacency);
  return { correctedSequenceIds, weakestSkillId, chain, skillsById: indexById(skills) };
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const i of items) out[i.id] = i;
  return out;
}
