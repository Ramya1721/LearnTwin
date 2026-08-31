import { Router } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// Open recommendations for the current user (e.g. CONCEPT_REVIEW rows created
// from weak-area quiz detection). Optional ?skillName= filters to recs whose
// title/description mentions a given skill, used by the topic page to show
// only what's relevant to the topic being viewed.
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const recommendations = await prisma.recommendation.findMany({
    where: { userId: req.userId!, status: "OPEN" },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  res.json({ recommendations });
});

export default router;
