import { Router } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { analyzeAndPersistBottlenecks } from "../services/bottleneckService";
import { analyzeAndCorrectPath } from "../services/pathCorrectionService";
import { reconcileLearningDna } from "../services/digitalTwinService";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const domain = req.query.domain as string | undefined;
  const assessments = await prisma.assessment.findMany({
    where: domain ? { skill: { domain } } : undefined,
    include: { skill: true },
  });
  res.json({ assessments });
});

router.get("/:id", requireAuth, async (req, res) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id: req.params.id },
    include: { questions: true, skill: true },
  });
  if (!assessment) return res.status(404).json({ error: "Not found" });
  // strip correct answers before sending to client
  const safe = {
    ...assessment,
    languageCode: assessment.languageCode,
    questions: assessment.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: JSON.parse(q.options),
    })),
  };
  res.json({ assessment: safe });
});

router.post("/:id/submit", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { answers } = req.body as { answers: { questionId: string; answer: string }[] };

    const assessment = await prisma.assessment.findUnique({
      where: { id: req.params.id },
      include: { questions: true, skill: true },
    });
    if (!assessment) return res.status(404).json({ error: "Assessment not found" });

    let correct = 0;
    // Per-concept accuracy, computed from this attempt's answers only (no
    // extra per-answer table needed) so we can point the learner at exactly
    // which sub-concept to review instead of "you did badly, study more".
    const conceptTally = new Map<string, { correct: number; total: number }>();
    for (const q of assessment.questions) {
      const given = answers.find((a) => a.questionId === q.id);
      const isCorrect = Boolean(given && given.answer === q.correctAnswer);
      if (isCorrect) correct++;
      if (q.concept) {
        const t = conceptTally.get(q.concept) || { correct: 0, total: 0 };
        t.total++;
        if (isCorrect) t.correct++;
        conceptTally.set(q.concept, t);
      }
    }
    const score = Math.round((correct / Math.max(1, assessment.questions.length)) * 100);

    const weakConcepts: { concept: string; accuracy: number }[] = [];
    for (const [concept, t] of conceptTally) {
      const accuracy = Math.round((t.correct / t.total) * 100);
      if (accuracy < 60) {
        weakConcepts.push({ concept, accuracy });
        const existingRec = await prisma.recommendation.findFirst({
          where: { userId, type: "CONCEPT_REVIEW", title: concept, status: "OPEN" },
        });
        const description = `You're missing questions on "${concept}" within ${assessment.skill.name} (${accuracy}% accuracy this attempt).`;
        const reason = `Detected from ${assessment.title} attempt scoring ${score}%.`;
        const priority = accuracy < 35 ? "HIGH" : "MEDIUM";
        if (existingRec) {
          await prisma.recommendation.update({ where: { id: existingRec.id }, data: { description, reason, priority } });
        } else {
          await prisma.recommendation.create({
            data: { userId, type: "CONCEPT_REVIEW", title: concept, description, reason, priority, status: "OPEN" },
          });
        }
      } else {
        // Mastered on this attempt — close out any stale open recommendation for it.
        await prisma.recommendation.updateMany({
          where: { userId, type: "CONCEPT_REVIEW", title: concept, status: "OPEN" },
          data: { status: "RESOLVED" },
        });
      }
    }

    const attempt = await prisma.assessmentAttempt.create({
      data: { userId, assessmentId: assessment.id, score },
    });

    // update skill proficiency (blend previous proficiency with new score)
    const existing = await prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId: assessment.skillId } },
    });
    const blended = existing ? Math.round(existing.proficiency * 0.4 + score * 0.6) : score;
    const status = blended < 40 ? "FAILED" : blended < 60 ? "WEAK" : "IN_PROGRESS";

    const userSkill = await prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId: assessment.skillId } },
      update: { proficiency: blended, status, lastPracticed: new Date() },
      create: { userId, skillId: assessment.skillId, proficiency: blended, status, lastPracticed: new Date() },
    });

    await prisma.learningActivity.create({
      data: { userId, skillId: assessment.skillId, activityType: "QUIZ", duration: 10 },
    });

    // ---- Trigger the full self-correcting cycle on a weak/failed result ----
    let pathCorrection = null;
    let bottleneckResult = null;
    if (score < 60) {
      bottleneckResult = await analyzeAndPersistBottlenecks(userId);
      pathCorrection = await analyzeAndCorrectPath(userId);
      await reconcileLearningDna(userId);
    }

    res.json({
      attempt,
      score,
      before: existing?.proficiency ?? 0,
      after: blended,
      userSkill,
      bottlenecks: bottleneckResult?.detected || [],
      pathCorrection,
      weakConcepts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit assessment" });
  }
});

export default router;
