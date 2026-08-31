import { Router } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { analyzeAndCorrectPath } from "../services/pathCorrectionService";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const corrections = await prisma.pathCorrection.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  const parsed = corrections.map((c) => ({
    ...c,
    oldPath: JSON.parse(c.oldPath),
    newPath: JSON.parse(c.newPath),
  }));
  res.json({ corrections: parsed });
});

router.post("/analyze", requireAuth, async (req: AuthRequest, res) => {
  const result = await analyzeAndCorrectPath(req.userId!);
  res.json({ correction: result });
});

export default router;
