import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { answerLearnerQuestion } from "../services/aiService";
import { toTwinSnapshot } from "../services/digitalTwinService";
import { analyzeAndCorrectPath } from "../services/pathCorrectionService";
import { explainPathCorrection } from "../services/aiService";
import { prisma } from "../utils/prisma";

const router = Router();

router.post("/ask", requireAuth, async (req: AuthRequest, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "question is required" });
  const twin = await toTwinSnapshot(req.userId!);
  const answer = await answerLearnerQuestion(question, twin);
  res.json({ answer });
});

router.post("/explain-path", requireAuth, async (req: AuthRequest, res) => {
  const latest = await prisma.pathCorrection.findFirst({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  if (latest) return res.json({ explanation: latest.reason });

  const explanation = await explainPathCorrection({
    weakSkillName: "a foundational concept",
    strugglingSkillName: "your current topic",
  });
  res.json({ explanation });
});

export default router;
