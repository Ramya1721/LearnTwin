import { Router } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const domain = req.query.domain as string | undefined;
  const skills = await prisma.skill.findMany({ where: domain ? { domain } : undefined });
  res.json({ skills });
});

// Domains relevant to the current user (their own learning paths first,
// falling back to every domain that exists) — replaces any hardcoded
// course list in the frontend.
router.get("/domains", requireAuth, async (req: AuthRequest, res) => {
  const myPaths = await prisma.learningPath.findMany({
    where: { userId: req.userId! },
    include: { items: { include: { skill: true }, take: 1 } },
  });
  const myDomains = Array.from(
    new Set(myPaths.map((p) => p.items[0]?.skill.domain).filter((d): d is string => Boolean(d)))
  );
  if (myDomains.length > 0) return res.json({ domains: myDomains });

  const all = await prisma.skill.findMany({ select: { domain: true }, distinct: ["domain"] });
  res.json({ domains: all.map((s) => s.domain) });
});

router.get("/graph", requireAuth, async (req, res) => {
  const domain = req.query.domain as string | undefined;
  if (!domain) return res.json({ nodes: [], edges: [] });
  const skills = await prisma.skill.findMany({ where: { domain } });
  const deps = await prisma.skillDependency.findMany({
    where: { skillId: { in: skills.map((s) => s.id) } },
  });
  res.json({
    nodes: skills.map((s) => ({ id: s.id, name: s.name, difficulty: s.difficulty, description: s.description })),
    edges: deps.map((d) => ({ from: d.prerequisiteSkillId, to: d.skillId })),
  });
});

router.get("/user-skills", requireAuth, async (req: AuthRequest, res) => {
  const userSkills = await prisma.userSkill.findMany({
    where: { userId: req.userId! },
    include: { skill: true },
  });
  res.json({ userSkills });
});

router.put("/user-skills/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { proficiency, status } = req.body;
  const existing = await prisma.userSkill.findUnique({ where: { id } });
  if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.userSkill.update({
    where: { id },
    data: {
      proficiency: proficiency ?? existing.proficiency,
      status: status ?? existing.status,
      lastPracticed: new Date(),
    },
  });
  res.json({ userSkill: updated });
});

export default router;
