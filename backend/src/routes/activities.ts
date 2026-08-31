import { Router } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { analyzeAndPersistBottlenecks } from "../services/bottleneckService";

const router = Router();

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { skillId, activityType, duration } = req.body;
  if (!activityType || !duration) return res.status(400).json({ error: "activityType and duration are required" });

  const activity = await prisma.learningActivity.create({
    data: { userId: req.userId!, skillId: skillId || null, activityType, duration },
  });

  // small proficiency bump for practice/project activities
  if (skillId && (activityType === "PRACTICE" || activityType === "PROJECT")) {
    const existing = await prisma.userSkill.findUnique({
      where: { userId_skillId: { userId: req.userId!, skillId } },
    });
    const newProficiency = Math.min(100, (existing?.proficiency ?? 0) + (activityType === "PROJECT" ? 8 : 4));
    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId: req.userId!, skillId } },
      update: { proficiency: newProficiency, lastPracticed: new Date(), status: "IN_PROGRESS" },
      create: { userId: req.userId!, skillId, proficiency: newProficiency, status: "IN_PROGRESS", lastPracticed: new Date() },
    });
  }

  const bottleneckResult = await analyzeAndPersistBottlenecks(req.userId!);

  res.status(201).json({ activity, bottlenecks: bottleneckResult.detected });
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const activities = await prisma.learningActivity.findMany({
    where: { userId: req.userId! },
    include: { skill: true },
    orderBy: { completedAt: "desc" },
    take: 100,
  });
  res.json({ activities });
});

export default router;
