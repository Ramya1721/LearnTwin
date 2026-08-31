import { Router } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { generateLearningPath } from "../services/learningPathService";
import { normalizeGoalToDomain } from "../utils/contentTemplates";
import { SUPPORTED_LANGUAGES } from "../services/youtubeService";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const profile = await prisma.userProfile.findUnique({ where: { userId: req.userId! } });
  res.json({ profile });
});

// Full onboarding: profile + learning DNA + initial path + starter skills, in one call
router.put("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      careerGoal,
      domain: domainOverride, // optional; derived from careerGoal when omitted
      experienceLevel,
      availableHoursPerWeek,
      preferredLearningStyle,
      preferredLanguage,
      existingSkills, // [{ skillName, level: 0-100 }]
      theoryPreference,
      practicalPreference,
      sessionPreference,
      revisionRequirement,
      problemSolvingStrength,
    } = req.body;

    if (!careerGoal || !careerGoal.trim()) {
      return res.status(400).json({ error: "careerGoal (what you want to learn) is required" });
    }

    const domain = (domainOverride && String(domainOverride).trim()) || normalizeGoalToDomain(careerGoal);
    const normalizedLanguage = SUPPORTED_LANGUAGES.includes(preferredLanguage) ? preferredLanguage : "English";

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        careerGoal,
        domain,
        experienceLevel: experienceLevel || "Beginner",
        availableHoursPerWeek: availableHoursPerWeek || 5,
        preferredLearningStyle: preferredLearningStyle || "Hands-on",
        preferredLanguage: normalizedLanguage,
        onboarded: true,
      },
      create: {
        userId,
        careerGoal,
        domain,
        experienceLevel: experienceLevel || "Beginner",
        availableHoursPerWeek: availableHoursPerWeek || 5,
        preferredLearningStyle: preferredLearningStyle || "Hands-on",
        preferredLanguage: normalizedLanguage,
        onboarded: true,
      },
    });

    await prisma.learningDna.upsert({
      where: { userId },
      update: {
        learningStyle: preferredLearningStyle || "Hands-on Explorer",
        theoryPreference: theoryPreference || "Medium",
        practicalPreference: practicalPreference || "High",
        sessionPreference: sessionPreference || "Short focused sessions",
        revisionRequirement: revisionRequirement || "Medium",
        problemSolvingStrength: problemSolvingStrength || "Developing",
      },
      create: {
        userId,
        learningStyle: preferredLearningStyle || "Hands-on Explorer",
        theoryPreference: theoryPreference || "Medium",
        practicalPreference: practicalPreference || "High",
        sessionPreference: sessionPreference || "Short focused sessions",
        revisionRequirement: revisionRequirement || "Medium",
        problemSolvingStrength: problemSolvingStrength || "Developing",
      },
    });

    // seed existing skill proficiency if provided
    if (Array.isArray(existingSkills)) {
      for (const es of existingSkills) {
        const skill = await prisma.skill.findFirst({ where: { name: es.skillName, domain } });
        if (skill) {
          await prisma.userSkill.upsert({
            where: { userId_skillId: { userId, skillId: skill.id } },
            update: { proficiency: es.level },
            create: { userId, skillId: skill.id, proficiency: es.level, status: es.level > 0 ? "IN_PROGRESS" : "NOT_STARTED" },
          });
        }
      }
    }

    const path = await generateLearningPath(userId, careerGoal, experienceLevel);

    res.json({ profile, path });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save onboarding data" });
  }
});

export default router;
