import { Router } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { analyzeAndPersistBottlenecks } from "../services/bottleneckService";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const bottlenecks = await prisma.bottleneck.findMany({
    where: { userId: req.userId! },
    orderBy: { detectedAt: "desc" },
  });
  res.json({ bottlenecks });
});

router.post("/analyze", requireAuth, async (req: AuthRequest, res) => {
  const result = await analyzeAndPersistBottlenecks(req.userId!);
  res.json(result);
});

export default router;
