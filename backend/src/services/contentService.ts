import { prisma } from "../utils/prisma";
import { buildAdjacency } from "./skillGraphService";
import {
  generateSkillGraphForGoal,
  generateTopicArticle,
  generateLocalizedQuizQuestions,
  generateVideoQuizQuestions,
} from "./aiService";
import {
  buildFallbackSkillGraph,
  normalizeGoalToDomain,
  SkillGraphBlueprint,
} from "../utils/contentTemplates";
import {
  attachBestYouTubeResource,
  fetchVideoTranscript,
  languageCodeFor,
} from "./youtubeService";

export interface RoadmapOptions {
  preferredLanguage?: string;
  objective?: string;
  availableHoursPerWeek?: number;
  preferredLearningStyle?: string;
  theoryPreference?: string;
  practicalPreference?: string;
  sessionPreference?: string;
  revisionRequirement?: string;
  problemSolvingStrength?: string;
  currentSkills?: { name: string; proficiency: number; status: string }[];
}

/** Ensure a dynamic, goal-specific skill graph and real learning content. */
export async function ensureDomainSkillGraph(
  goal: string,
  level: "beginner" | "intermediate" | "advanced",
  options: RoadmapOptions = {}
) {
  const domain = normalizeGoalToDomain(goal);

  const existing = await prisma.skill.findMany({
    where: { domain, generated: true },
    orderBy: [{ moduleOrder: "asc" }, { name: "asc" }],
  });

  if (existing.length > 0) {
    for (const skill of existing) {
      await ensureResourcesForSkill(skill, options);

      await ensureAssessmentForSkill(
        skill.id,
        skill.name,
        skill.difficulty,
        options.preferredLanguage || "English",
        skill.description
      );
    }

    return { domain, skills: existing };
  }

  const blueprint =
    (await generateSkillGraphForGoal({
      goal,
      domain,
      experienceLevel: level,
      preferredLanguage: options.preferredLanguage || "English",
      availableHoursPerWeek: options.availableHoursPerWeek || 5,
      preferredLearningStyle:
        options.preferredLearningStyle || "Hands-on",
      theoryPreference: options.theoryPreference || "Medium",
      practicalPreference: options.practicalPreference || "High",
      sessionPreference:
        options.sessionPreference || "Short focused sessions",
      revisionRequirement:
        options.revisionRequirement || "Medium",
      problemSolvingStrength:
        options.problemSolvingStrength || "Developing",
      currentSkills: options.currentSkills || [],
    })) || buildFallbackSkillGraph(goal);

  const keyToId: Record<string, string> = {};
  const created: any[] = [];

  for (const s of blueprint.skills) {
    const row = await prisma.skill.create({
      data: {
        name: s.name,
        domain: blueprint.domain,
        description: s.description,
        difficulty: s.difficulty,
        module: s.module,
        moduleOrder: s.moduleOrder,
        generated: true,
      },
    });

    keyToId[s.key] = row.id;
    created.push(row);
  }

  for (const s of blueprint.skills) {
    for (const prereqKey of s.prerequisites) {
      const prereqId = keyToId[prereqKey];
      const skillId = keyToId[s.key];

      if (!prereqId || !skillId) continue;

      await prisma.skillDependency
        .create({
          data: {
            skillId,
            prerequisiteSkillId: prereqId,
          },
        })
        .catch(() => {});
    }
  }

  for (const s of blueprint.skills) {
    const skill = {
      id: keyToId[s.key],
      name: s.name,
      domain: blueprint.domain,
      difficulty: s.difficulty,
    };

    await ensureResourcesForSkill(skill, options);

    await ensureAssessmentForSkill(
      skill.id,
      skill.name,
      skill.difficulty,
      options.preferredLanguage || "English",
      skill.description
    );
  }

  return {
    domain: blueprint.domain,
    skills: created,
  };
}

export async function ensureResourcesForSkill(
  skill: {
    id: string;
    name: string;
    domain: string;
    difficulty: string;
  },
  options: RoadmapOptions = {}
) {
  const language = options.preferredLanguage || "English";

  const count = await prisma.learningResource.count({
    where: { skillId: skill.id },
  });

  if (count === 0) {
    const content = await generateTopicArticle({
      skillName: skill.name,
      domain: skill.domain,
      difficulty: skill.difficulty as any,
      language,
    });

    await prisma.learningResource.create({
      data: {
        skillId: skill.id,
        type: "ARTICLE",
        title: `${skill.name} — Lesson`,
        content,
        order: 10,
        minProgressRequired: 80,
      },
    });
  }

  try {
    await attachBestYouTubeResource({
      skillId: skill.id,
      skillName: skill.name,
      domain: skill.domain,
      difficulty: skill.difficulty,
      preferredLanguage: language,
      objective: options.objective || `Understand ${skill.name}`,
    });
  } catch (error) {
    console.error(
      `YouTube resource setup failed for ${skill.name}:`,
      error
    );
  }
}

async function ensureAssessmentForSkill(
  skillId: string,
  skillName: string,
  difficulty: string,
  preferredLanguage: string,
  skillDescription = ""
) {
  const languageCode = languageCodeFor(preferredLanguage);

  const existing = await prisma.assessment.findFirst({
    where: {
      skillId,
      languageCode,
    },
    include: {
      questions: true,
    },
  });

  // Repair an assessment that was created previously but has no usable questions.
  if (existing && existing.questions.length > 0) {
    return existing;
  }

  const video = await prisma.learningResource.findFirst({
    where: {
      skillId,
      type: "VIDEO",
      sourceLanguageCode: languageCode,
      youtubeVideoId: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  let questions: any[] | null = null;
  let title = `${skillName} Quiz`;

  if (video?.youtubeVideoId) {
    try {
      const transcript = await fetchVideoTranscript(
        video.youtubeVideoId,
        preferredLanguage
      );

      if (transcript) {
        const evidence = transcript.cues
          .map(
            (cue) =>
              `[${Math.floor(cue.startSeconds)}s] ${cue.text}`
          )
          .join("\n");

        questions = await generateVideoQuizQuestions({
          videoTitle: video.title,
          skillName,
          language: preferredLanguage,
          transcriptEvidence: evidence,
          count: 5,
        });

        if (questions?.length) {
          title = `${skillName} — Video Quiz`;
        }
      }
    } catch (error) {
      console.error(
        `Video quiz generation failed for ${skillName}:`,
        error
      );
    }
  }

  // If the video has no usable transcript, do not pretend a generic quiz is video-specific.
  // A localized topic assessment can still exist, but it is clearly labeled as a topic assessment.
  if (!questions?.length) {
    try {
      questions = await generateLocalizedQuizQuestions({
        skillName,
        difficulty,
        language: preferredLanguage,
        count: 5,
      });

      if (questions?.length) {
        title = `${skillName} — Topic Assessment`;
      }
    } catch (error) {
      console.error(
        `AI quiz generation failed for ${skillName}:`,
        error
      );
    }
  }

  // Offline-safe fallback: the quiz must still exist when no AI key is configured
  // or an AI request fails. It is deliberately labeled a topic assessment rather
  // than pretending to be derived from a YouTube transcript.
  if (!questions?.length && languageCode === "en") {
    questions = buildFallbackAssessmentQuestions(
      skillName,
      skillDescription
    );

    title = `${skillName} — Topic Assessment`;
  }

  if (!questions?.length) {
    return null;
  }

  if (existing) {
    await prisma.question.createMany({
      data: questions.map((q) => ({
        assessmentId: existing.id,
        question: q.question,
        options: JSON.stringify(q.options),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        concept: q.concept,
      })),
    });

    return existing;
  }

  const assessment = await prisma.assessment.create({
    data: {
      skillId,
      title,
      difficulty,
      languageCode,
      passingScore: 70,
    },
  });

  await prisma.question.createMany({
    data: questions.map((q) => ({
      assessmentId: assessment.id,
      question: q.question,
      options: JSON.stringify(q.options),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      concept: q.concept,
    })),
  });

  return assessment;
}

function buildFallbackAssessmentQuestions(
  skillName: string,
  description: string
) {
  const topic =
    description ||
    `the concepts and practical skills covered by ${skillName}`;

  return [
    {
      question: `Which statement best describes the focus of ${skillName}?`,
      options: [
        topic,
        "Only memorizing definitions without applying them",
        "Only installing software without learning the concepts",
        "Only watching demonstrations without practicing",
      ],
      correctAnswer: topic,
      explanation: `The topic is defined by its stated focus: ${topic}.`,
      concept: "Core focus",
    },
    {
      question: `What is the best way to build practical ability in ${skillName}?`,
      options: [
        "Apply the concepts in progressively harder exercises and projects",
        "Avoid practice until every definition is memorized",
        "Use unrelated topics instead of the core concepts",
        "Read one example once and stop practicing",
      ],
      correctAnswer:
        "Apply the concepts in progressively harder exercises and projects",
      explanation:
        "Practical application and progressively harder practice directly develop the target skill.",
      concept: "Practical application",
    },
    {
      question: `When learning ${skillName}, what should you do when an example does not work as expected?`,
      options: [
        "Inspect the assumptions, inputs, errors, and expected result",
        "Ignore the result and copy it unchanged",
        "Delete the example without investigating it",
        "Change several unrelated parts at once",
      ],
      correctAnswer:
        "Inspect the assumptions, inputs, errors, and expected result",
      explanation:
        "Checking assumptions, inputs, errors, and expected behavior is a reliable way to diagnose a learning example.",
      concept: "Problem solving",
    },
    {
      question: `Which outcome is strongest evidence that you understand ${skillName}?`,
      options: [
        "You can explain the main idea and apply it to a new problem",
        "You can recognize the topic name but cannot use it",
        "You can repeat one example without changing it",
        "You can memorize terminology without explaining it",
      ],
      correctAnswer:
        "You can explain the main idea and apply it to a new problem",
      explanation:
        "Understanding is demonstrated by explanation plus transfer to a new problem.",
      concept: "Understanding",
    },
    {
      question: `What should a learner review after making a repeated mistake in ${skillName}?`,
      options: [
        "The specific concept and reasoning that caused the mistake",
        "Only the visual design of the lesson",
        "Unrelated advanced topics",
        "The topic title without reviewing any examples",
      ],
      correctAnswer:
        "The specific concept and reasoning that caused the mistake",
      explanation:
        "Reviewing the underlying concept and reasoning targets the source of a repeated mistake.",
      concept: "Revision",
    },
  ];
}

function estimateArticleMinutes(
  content: string | null | undefined
): number {
  if (!content) return 3;

  return Math.max(
    2,
    Math.round(
      content.trim().split(/\s+/).length / 200
    )
  );
}

export async function estimateItemMinutes(
  skillId: string
): Promise<number> {
  const resources = await prisma.learningResource.findMany({
    where: { skillId },
  });

  const assessment =
    await prisma.assessment.findFirst({
      where: { skillId },
      include: { questions: true },
    });

  let total = 0;

  for (const r of resources) {
    total +=
      r.type === "VIDEO"
        ? r.durationSeconds
          ? Math.round(r.durationSeconds / 60)
          : 10
        : estimateArticleMinutes(r.content);
  }

  if (assessment) {
    total += Math.max(
      2,
      Math.round(assessment.questions.length * 1.5)
    );
  }

  return total || 15;
}

export interface ItemRequirement {
  type: "RESOURCE" | "QUIZ" | "VIDEO_CHECKPOINTS";
  id: string;
  title: string;
  satisfied: boolean;
  detail: string;
}

export async function getItemRequirements(
  userId: string,
  skillId: string
): Promise<ItemRequirement[]> {
  const requirements: ItemRequirement[] = [];

  const resources =
    await prisma.learningResource.findMany({
      where: { skillId },
      orderBy: { order: "asc" },
      include: {
        progress: {
          where: { userId },
        },
      },
    });

  const videoResources = resources.filter(
    (r) => r.type === "VIDEO"
  );

  const requiredResources =
    videoResources.length > 0
      ? videoResources
      : resources.filter(
          (r) => r.type === "ARTICLE"
        );

  for (const r of requiredResources) {
    const progress = r.progress[0];

    requirements.push({
      type: "RESOURCE",
      id: r.id,
      title:
        r.type === "VIDEO"
          ? `${r.title} video progress`
          : r.title,
      satisfied: Boolean(progress?.completed),
      detail: progress?.completed
        ? "Completed"
        : `${progress?.progress ?? 0}% of ${r.minProgressRequired}% required`,
    });
  }

  for (const resource of videoResources) {
    const checkpointCount =
      await prisma.videoCheckpoint.count({
        where: {
          resourceId: resource.id,
        },
      });

    if (checkpointCount === 0) continue;

    const completedCount =
      await prisma.checkpointProgress.count({
        where: {
          userId,
          checkpoint: {
            resourceId: resource.id,
          },
          completed: true,
        },
      });

    requirements.push({
      type: "VIDEO_CHECKPOINTS",
      id: resource.id,
      title: `${resource.title} checkpoints`,
      satisfied:
        completedCount >= checkpointCount,
      detail: `${completedCount}/${checkpointCount} checkpoints completed`,
    });
  }

  const profile =
    await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        preferredLanguage: true,
      },
    });

  const languageCode = languageCodeFor(
    profile?.preferredLanguage || "English"
  );

  const assessment =
    await prisma.assessment.findFirst({
      where: {
        skillId,
        languageCode,
      },
    });

  if (assessment) {
    const bestAttempt =
      await prisma.assessmentAttempt.findFirst({
        where: {
          userId,
          assessmentId: assessment.id,
        },
        orderBy: {
          score: "desc",
        },
      });

    requirements.push({
      type: "QUIZ",
      id: assessment.id,
      title: assessment.title,
      satisfied: Boolean(
        bestAttempt &&
          bestAttempt.score >=
            assessment.passingScore
      ),
      detail: bestAttempt
        ? `Best score ${bestAttempt.score}% (needs ${assessment.passingScore}%)`
        : `Not attempted yet (needs ${assessment.passingScore}%)`,
    });
  }

  return requirements;
}

export async function computeItemProgressPercent(
  userId: string,
  skillId: string
): Promise<number> {
  const reqs = await getItemRequirements(
    userId,
    skillId
  );

  if (!reqs.length) return 0;

  return Math.round(
    (reqs.filter((r) => r.satisfied).length /
      reqs.length) *
      100
  );
}

export async function unlockAvailableItems(
  learningPathId: string
) {
  const items =
    await prisma.learningPathItem.findMany({
      where: { learningPathId },
    });

  const skillIds = items.map(
    (i) => i.skillId
  );

  const deps =
    await prisma.skillDependency.findMany({
      where: {
        skillId: {
          in: skillIds,
        },
      },
    });

  const adjacency = buildAdjacency(
    deps.map((d) => ({
      skillId: d.skillId,
      prerequisiteSkillId:
        d.prerequisiteSkillId,
    }))
  );

  const statusBySkill = new Map(
    items.map((i) => [
      i.skillId,
      i.status,
    ])
  );

  const satisfiedStatuses = new Set([
    "COMPLETED",
    "SKIPPED",
  ]);

  for (const item of items) {
    if (item.status !== "LOCKED") continue;

    const prereqs =
      adjacency.get(item.skillId) || [];

    if (
      prereqs.every(
        (p) =>
          !statusBySkill.has(p) ||
          satisfiedStatuses.has(
            statusBySkill.get(p)!
          )
      )
    ) {
      await prisma.learningPathItem.update({
        where: {
          id: item.id,
        },
        data: {
          status: "CURRENT",
        },
      });

      statusBySkill.set(
        item.skillId,
        "CURRENT"
      );
    }
  }
}
