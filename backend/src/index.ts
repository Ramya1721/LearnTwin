import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import digitalTwinRoutes from "./routes/digitalTwin";
import skillsRoutes from "./routes/skills";
import learningPathRoutes from "./routes/learningPath";
import assessmentsRoutes from "./routes/assessments";
import activitiesRoutes from "./routes/activities";
import bottlenecksRoutes from "./routes/bottlenecks";
import pathCorrectionsRoutes from "./routes/pathCorrections";
import aiRoutes from "./routes/ai";
import analyticsRoutes from "./routes/analytics";
import recommendationsRoutes from "./routes/recommendations";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "learntwin-backend", aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY), youtubeEnabled: Boolean(process.env.YOUTUBE_API_KEY) });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/digital-twin", digitalTwinRoutes);
app.use("/api/skills", skillsRoutes);
app.use("/api/learning-path", learningPathRoutes);
app.use("/api/assessments", assessmentsRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/bottlenecks", bottlenecksRoutes);
app.use("/api/path-corrections", pathCorrectionsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/recommendations", recommendationsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`LearnTwin backend running on http://localhost:${PORT}`);
});
