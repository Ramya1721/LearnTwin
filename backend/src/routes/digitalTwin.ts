import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getDigitalTwin, reconcileLearningDna } from "../services/digitalTwinService";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const twin = await getDigitalTwin(req.userId!);
  res.json({ twin });
});

router.post("/update", requireAuth, async (req: AuthRequest, res) => {
  await reconcileLearningDna(req.userId!);
  const twin = await getDigitalTwin(req.userId!);
  res.json({ twin });
});

export default router;
