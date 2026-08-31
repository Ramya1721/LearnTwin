/**
 * Deterministic, offline content generation.
 * ------------------------------------------------------------------
 * These functions produce a complete, usable skill graph + learning
 * content for ANY freeform learning goal without calling any external
 * service. They are the fallback used when ANTHROPIC_API_KEY is not
 * configured (or the AI call fails), so the product never breaks just
 * because AI is unavailable.
 *
 * Content is generated (templated) text, never scraped from the web,
 * and no video URLs are invented.
 * ------------------------------------------------------------------
 */

export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type Level = "Beginner" | "Beginner-Intermediate" | "Intermediate" | "Advanced";

export interface SkillBlueprint {
  key: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  module: string;
  moduleOrder: number;
  prerequisites: string[]; // keys, within the same graph
}

export interface SkillGraphBlueprint {
  domain: string;
  skills: SkillBlueprint[];
}

/** Normalizes a freeform goal string ("i wanna learn Machine Learning!") into a stable domain key. */
export function normalizeGoalToDomain(goal: string): string {
  let cleaned = goal
    .trim()
    .replace(/^(i want to |i'd like to |i wanna |learn |learning |become a |become an )+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) cleaned = "General Studies";
  // Title-case for consistent grouping/display.
  cleaned = cleaned
    .split(" ")
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return cleaned.slice(0, 80);
}

const MODULE_TEMPLATE = [
  { name: "Foundations", order: 0, difficulty: "BEGINNER" as Difficulty },
  { name: "Core Concepts", order: 1, difficulty: "BEGINNER" as Difficulty },
  { name: "Core Workflow", order: 2, difficulty: "INTERMEDIATE" as Difficulty },
  { name: "Practical Projects", order: 3, difficulty: "INTERMEDIATE" as Difficulty },
  { name: "Advanced Practice", order: 4, difficulty: "ADVANCED" as Difficulty },
  { name: "Review & Mastery", order: 5, difficulty: "ADVANCED" as Difficulty },
];

export function buildFallbackSkillGraph(goal: string): SkillGraphBlueprint {
  const domain = normalizeGoalToDomain(goal);
  const topics: Record<string, string[]> = {
    Foundations: [`${domain} Fundamentals`, `${domain} Terminology and Mental Models`, `${domain} Setup, Tools and Environment`],
    "Core Concepts": [`Core Concepts of ${domain}`, `${domain} Patterns and Principles`, `${domain} Data, Inputs and Outputs`],
    "Core Workflow": [`Working with ${domain} End to End`, `Debugging and Problem Solving in ${domain}`, `${domain} Quality, Testing and Validation`],
    "Practical Projects": [`Guided ${domain} Project`, `Real-World ${domain} Use Case`, `Independent ${domain} Mini Project`],
    "Advanced Practice": [`Advanced ${domain} Techniques`, `${domain} Performance and Optimization`, `${domain} Best Practices and Edge Cases`],
    "Review & Mastery": [`${domain} Interview and Assessment Practice`, `${domain} Architecture and Trade-offs`, `Capstone: Build and Explain a ${domain} Solution`],
  };

  const skills: SkillBlueprint[] = [];
  let previousModuleLast: string | null = null;
  for (const mod of MODULE_TEMPLATE) {
    const names = topics[mod.name];
    let firstKey = "";
    names.forEach((name, idx) => {
      const key = slugify(`${mod.name}-${name}`);
      if (!firstKey) firstKey = key;
      skills.push({
        key,
        name,
        description: describeTopic(name, domain),
        difficulty: mod.difficulty,
        module: mod.name,
        moduleOrder: mod.order,
        prerequisites: idx === 0 ? (previousModuleLast ? [previousModuleLast] : []) : [firstKey],
      });
      previousModuleLast = key;
    });
  }
  return { domain, skills };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function describeTopic(name: string, domain: string): string {
  return `${name} — part of your ${domain} learning path, covering the concepts and applied skills needed to progress toward the goal.`;
}

/** Generates a templated article (explanation + examples) for a topic, with no external/copyrighted content. */
export function buildFallbackArticle(skillName: string, domain: string, difficulty: Difficulty): string {
  const levelNote =
    difficulty === "BEGINNER"
      ? "This lesson assumes no prior background — we'll build up from first principles."
      : difficulty === "INTERMEDIATE"
      ? "This lesson builds on the fundamentals and introduces more nuanced ideas."
      : "This lesson assumes solid working knowledge of the earlier topics and goes deeper into edge cases and best practices.";

  return [
    `# ${skillName}`,
    "",
    `## Overview`,
    `${skillName} is a topic within your ${domain} learning path. ${levelNote}`,
    "",
    `## Key Ideas`,
    `- What ${skillName.toLowerCase()} is and why it matters for ${domain}.`,
    `- The core building blocks you'll use when working with ${skillName.toLowerCase()}.`,
    `- Common mistakes learners make with ${skillName.toLowerCase()}, and how to avoid them.`,
    "",
    `## Worked Example`,
    `Imagine you're applying ${skillName.toLowerCase()} to a small, realistic ${domain} problem. Start by identifying the goal, break it into smaller steps, and apply the core idea from this lesson to each step before combining your results.`,
    "",
    `## Practice Prompts`,
    `1. Explain ${skillName.toLowerCase()} in your own words, as if teaching a beginner.`,
    `2. Identify one real-world scenario in ${domain} where ${skillName.toLowerCase()} applies.`,
    `3. Try a small hands-on exercise applying ${skillName.toLowerCase()} before moving on.`,
    "",
    `When you feel comfortable with the ideas above, continue to the short quiz to check your understanding.`,
  ].join("\n");
}

/** Maps a freeform experience-level string onto a bucket used to decide the starting point of a path. */
export function normalizeLevel(experienceLevel: string | undefined | null): "beginner" | "intermediate" | "advanced" {
  const s = (experienceLevel || "").toLowerCase();
  if (s.includes("advanced")) return "advanced";
  if (s.includes("intermediate")) return "intermediate";
  return "beginner";
}
