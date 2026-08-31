import {
  SkillGraphBlueprint,
  buildFallbackSkillGraph,
  buildFallbackArticle,
  Difficulty,
} from "../utils/contentTemplates";

const API_KEY = process.env.ANTHROPIC_API_KEY?.trim();
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 1200): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const textBlock = data?.content?.find((c: any) => c.type === "text");
    return textBlock?.text?.trim() || null;
  } catch {
    return null;
  }
}

function cleanJson(text: string) {
  return text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

export async function explainPathCorrection(params: { weakSkillName: string; strugglingSkillName: string }): Promise<string> {
  const fallback = `Your learning path was adjusted because repeated difficulty with ${params.strugglingSkillName} indicates a possible gap in ${params.weakSkillName} understanding. We inserted a focused revision and practice block on ${params.weakSkillName} before continuing to ${params.strugglingSkillName}.`;
  const ai = await callClaude(
    "You are LearnTwin's learning-path explainer. Write 2 short, specific sentences referencing the exact skill names. No markdown.",
    `Struggling skill: ${params.strugglingSkillName}. Root-cause weak prerequisite: ${params.weakSkillName}. Explain the correction.`,
    250
  );
  return ai || fallback;
}

export async function generateLearningExplanation(params: { skillName: string; proficiency: number; recentScoreTrend: "improving" | "declining" | "flat" }): Promise<string> {
  const trendText = params.recentScoreTrend === "improving" ? "trending upward" : params.recentScoreTrend === "declining" ? "trending downward" : "holding steady";
  const fallback = `Your proficiency in ${params.skillName} is currently ${params.proficiency}% and ${trendText}. ${params.proficiency < 60 ? `Focus on targeted practice before moving to dependent skills.` : `You're in a solid position to move on to the next skill.`}`;
  const ai = await callClaude(
    "You are LearnTwin's learning coach. Give a short 2-sentence, honest explanation. No markdown.",
    `Skill: ${params.skillName}. Proficiency: ${params.proficiency}%. Trend: ${params.recentScoreTrend}.`,
    250
  );
  return ai || fallback;
}

export async function generatePersonalizedInsight(params: { learningStyle: string; bottleneckTypes: string[]; strongestSkill: string; weakestSkill: string }): Promise<string> {
  const bottleneckText = params.bottleneckTypes.length > 0 ? `Current focus areas: ${params.bottleneckTypes.join(", ")}.` : "No active bottlenecks detected.";
  const fallback = `As a ${params.learningStyle}, you tend to learn best through direct application. You're strongest in ${params.strongestSkill} and should prioritize ${params.weakestSkill} next. ${bottleneckText}`;
  const ai = await callClaude(
    "You are LearnTwin's insight generator. Write one specific motivating paragraph of 2-3 sentences. No markdown.",
    `Learning style: ${params.learningStyle}. Bottlenecks: ${params.bottleneckTypes.join(", ") || "none"}. Strongest skill: ${params.strongestSkill}. Weakest skill: ${params.weakestSkill}.`,
    300
  );
  return ai || fallback;
}

export interface RoadmapLearnerContext {
  goal: string;
  domain: string;
  experienceLevel: string;
  preferredLanguage: string;
  availableHoursPerWeek: number;
  preferredLearningStyle: string;
  theoryPreference: string;
  practicalPreference: string;
  sessionPreference: string;
  revisionRequirement: string;
  problemSolvingStrength: string;
  currentSkills: { name: string; proficiency: number; status: string }[];
}

export async function generateSkillGraphForGoal(
  context: RoadmapLearnerContext
): Promise<SkillGraphBlueprint | null> {
  if (!API_KEY) return null;

  const raw = await callClaude(
    `You are LearnTwin's curriculum architect. Build a detailed, prerequisite-aware roadmap for the learner.
Return ONLY valid JSON matching:
{"domain":string,"skills":[{"key":string,"name":string,"description":string,"difficulty":"BEGINNER"|"INTERMEDIATE"|"ADVANCED","module":string,"moduleOrder":number,"prerequisites":string[]}]}
Rules:
- Create 5-7 modules and 3-4 concrete topics per module (15-28 topics).
- Make the roadmap specific to the exact goal, not a generic "fundamentals/core" course.
- Include prerequisites using only keys in this response.
- Cover foundations, core skills, applied workflow, advanced material, and projects/assessment when relevant to the goal.
- Adapt the starting difficulty and depth to the learner's experience and current proficiency.
- Keep each description to one sentence.
- Never invent unrelated technologies or certifications.
- moduleOrder must increase from foundational to advanced.`,
    `Learner profile:
${JSON.stringify(context, null, 2)}
Generate the complete roadmap now.`,
    2600
  );

  if (!raw) return null;
  try {
    const parsed = JSON.parse(cleanJson(raw));
    if (!parsed || !Array.isArray(parsed.skills) || parsed.skills.length < 10) return null;
    const valid = parsed.skills.filter((s: any) =>
      s && typeof s.key === "string" && /^[a-z0-9_]+$/i.test(s.key) &&
      typeof s.name === "string" && s.name.trim() && typeof s.description === "string" &&
      ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(s.difficulty) &&
      typeof s.module === "string" && s.module.trim() && Array.isArray(s.prerequisites)
    );
    if (valid.length < 10) return null;
    const keySet = new Set(valid.map((s: any) => s.key));
    const uniqueKeys = new Set<string>();
    const skills = valid.filter((s: any) => {
      if (uniqueKeys.has(s.key)) return false;
      uniqueKeys.add(s.key);
      return true;
    }).map((s: any, index: number) => ({
      key: s.key,
      name: s.name.trim().slice(0, 120),
      description: s.description.trim().slice(0, 400),
      difficulty: s.difficulty as Difficulty,
      module: s.module.trim().slice(0, 100),
      moduleOrder: Number.isFinite(Number(s.moduleOrder)) ? Number(s.moduleOrder) : Math.floor(index / 3),
      prerequisites: s.prerequisites.filter((p: any) => typeof p === "string" && keySet.has(p) && p !== s.key).slice(0, 5),
    }));
    return { domain: context.domain, skills };
  } catch {
    return null;
  }
}

export async function generateTopicArticle(params: { skillName: string; domain: string; difficulty: Difficulty; language?: string }): Promise<string> {
  const fallback = buildFallbackArticle(params.skillName, params.domain, params.difficulty);
  const language = params.language || "English";
  const ai = await callClaude(
    `Write original educational lesson content in ${language}. Include a short overview, 3-5 key ideas, one worked example, and 2-3 practice prompts. Keep it under 350 words. No copied source text and no markdown tables.`,
    `Topic: ${params.skillName}. Domain/goal: ${params.domain}. Difficulty: ${params.difficulty}. Write the lesson now.`,
    700
  );
  return ai || fallback;
}

export interface TwinSnapshot {
  goal: string;
  strengths: string[];
  weaknesses: string[];
  learningStyle: string;
  consistencyScore: number;
  activeBottlenecks: { type: string; description: string }[];
  recentCorrections: { reason: string }[];
  skillProficiency: Record<string, number>;
}

export async function answerLearnerQuestion(question: string, twin: TwinSnapshot): Promise<string> {
  const fallback = ruleBasedAnswer(question, twin);
  const ai = await callClaude(
    `You are LearnTwin's AI Learning Assistant. Answer using ONLY the learner data below. Be specific, cite actual numbers/skill names, keep it to 2-4 sentences, no markdown.
LEARNER DIGITAL TWIN:
${JSON.stringify(twin, null, 2)}`,
    question,
    350
  );
  return ai || fallback;
}

function ruleBasedAnswer(question: string, twin: TwinSnapshot): string {
  const q = question.toLowerCase();
  if (q.includes("why") && (q.includes("path") || q.includes("change") || q.includes("correct"))) return twin.recentCorrections[0]?.reason || "Your path hasn't needed correction recently — your assessment scores are currently on track with your prerequisites.";
  if (q.includes("struggl") || q.includes("why am i")) return twin.weaknesses.length > 0 ? `You're struggling most with ${twin.weaknesses.join(" and ")}. Check Bottleneck Analysis for the exact prerequisite gap we detected.` : "You don't have any significant weak areas flagged right now — keep going.";
  if (q.includes("what should i learn next") || q.includes("next")) return `Based on your goal of ${twin.goal}, the recommended next step is the current item at the top of My Learning Path.`;
  if (q.includes("ready")) {
    const values = Object.values(twin.skillProficiency);
    const avg = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
    return avg >= 60 ? "Your current average proficiency suggests you're ready to move forward." : "Your average proficiency is still below the recommended threshold, so a little more practice will help.";
  }
  if (q.includes("improve") || q.includes("focus")) return twin.weaknesses.length > 0 ? `Prioritize improving: ${twin.weaknesses.join(", ")}.` : "Your skill profile looks balanced right now — keep your current pace.";
  return `Your goal is ${twin.goal}, your learning style is ${twin.learningStyle}, and your consistency score is ${twin.consistencyScore}/100.`;
}

export interface VideoCheckpointQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

function validateQuestion(value: any): VideoCheckpointQuestion | null {
  if (!value || typeof value.question !== "string" || !Array.isArray(value.options) || value.options.length !== 4 || value.options.some((o: any) => typeof o !== "string" || !o.trim()) || typeof value.correctAnswer !== "string" || !value.options.includes(value.correctAnswer) || typeof value.explanation !== "string" || !value.explanation.trim()) return null;
  const unique = new Set(value.options.map((o: string) => o.trim().toLowerCase()));
  if (unique.size !== 4) return null;
  return { question: value.question.trim(), options: value.options.map((o: string) => o.trim()), correctAnswer: value.correctAnswer.trim(), explanation: value.explanation.trim() };
}

export async function generateVideoCheckpointQuestion(params: {
  videoTitle: string;
  chapterTitle: string;
  chapterSummary?: string | null;
  transcriptEvidence: string;
  language: string;
}): Promise<VideoCheckpointQuestion | null> {
  const evidence = params.transcriptEvidence.trim();
  if (evidence.length < 80) return null;
  const raw = await callClaude(
    `Create ONE factual multiple-choice learning checkpoint in ${params.language}.
CRITICAL: use ONLY the transcript evidence supplied below. Do not use general knowledge and do not infer facts that are absent. The learner reaches this checkpoint immediately after the supplied segment, so the answer must be supported by that segment alone.
Return ONLY JSON: {"question":string,"options":[string,string,string,string],"correctAnswer":string,"explanation":string}.
The explanation must also be supported by the evidence. Exactly one option is correct.`,
    `Video: ${params.videoTitle}
Segment: ${params.chapterTitle}
Summary: ${params.chapterSummary || ""}
TRANSCRIPT EVIDENCE:
${evidence.slice(0, 9000)}`,
    650
  );
  if (!raw) return null;
  try { return validateQuestion(JSON.parse(cleanJson(raw))); } catch { return null; }
}

export async function generateVideoQuizQuestions(params: {
  videoTitle: string;
  skillName: string;
  language: string;
  transcriptEvidence: string;
  count?: number;
}): Promise<LocalizedQuizQuestion[] | null> {
  const count = Math.min(8, Math.max(3, params.count || 5));
  const evidence = params.transcriptEvidence.trim();
  if (evidence.length < 200) return null;
  const raw = await callClaude(
    `Create ${count} original multiple-choice questions in ${params.language} from the supplied YouTube transcript only.
Every question must be answerable from the transcript. Do not add facts from general knowledge. Avoid duplicates. Exactly one correct option per question. Return ONLY a JSON array of objects with question, options (4 strings), correctAnswer, explanation, concept.`,
    `Video: ${params.videoTitle}
Topic: ${params.skillName}
TRANSCRIPT:
${evidence.slice(0, 30000)}`,
    1800
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(cleanJson(raw));
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.map((q: any) => {
      const v = validateQuestion(q);
      return v ? { ...v, concept: typeof q.concept === "string" ? q.concept.trim().slice(0, 100) : undefined } : null;
    }).filter(Boolean) as LocalizedQuizQuestion[];
    return valid.length >= 3 ? valid.slice(0, count) : null;
  } catch { return null; }
}

export interface LocalizedQuizQuestion extends VideoCheckpointQuestion { concept?: string }

export async function generateLocalizedQuizQuestions(params: { skillName: string; difficulty: string; language: string; count?: number }): Promise<LocalizedQuizQuestion[] | null> {
  const count = Math.min(8, Math.max(3, params.count || 5));
  const raw = await callClaude(
    `Create ${count} original educational multiple-choice questions in ${params.language}. Return ONLY a JSON array of objects with question, options (4 strings), correctAnswer, explanation and concept. Exactly one correct option.`,
    `Topic: ${params.skillName}. Difficulty: ${params.difficulty}. Create a final module quiz.`,
    1400
  );
  if (!raw) return null;
  try {
    const parsed = JSON.parse(cleanJson(raw));
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.map((q: any) => {
      const v = validateQuestion(q);
      return v ? { ...v, concept: typeof q.concept === "string" ? q.concept.trim().slice(0, 100) : undefined } : null;
    }).filter(Boolean) as LocalizedQuizQuestion[];
    return valid.length >= 3 ? valid.slice(0, count) : null;
  } catch { return null; }
}
