export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Skill {
  id: string;
  name: string;
  domain: string;
  description: string;
  difficulty: string;
  module?: string;
  moduleOrder?: number;
  prerequisites?: { id: string; name: string }[];
}

export interface UserSkill {
  id: string;
  skillId: string;
  proficiency: number;
  confidenceScore: number;
  status: string;
  skill: Skill;
}

export interface LearningPathItem {
  id: string;
  skillId: string;
  sequence: number;
  status: "COMPLETED" | "CURRENT" | "IN_PROGRESS" | "LOCKED" | "SKIPPED" | "WEAK" | "FAILED" | string;
  recommendedReason?: string | null;
  progressPercent?: number;
  estimatedMinutes?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  skill: Skill;
}

export interface LearningPath {
  id: string;
  goal: string;
  status: string;
  items: LearningPathItem[];
}

export interface VideoSegmentView {
  id: string;
  title: string;
  summary?: string | null;
  startSeconds: number;
  endSeconds: number;
  order: number;
}

export interface VideoCheckpointView {
  id: string;
  timestampSeconds: number;
  question: string;
  options: string[];
  explanation: string;
  language: string;
  completed: boolean;
  answeredCorrectly: boolean;
}

export interface LearningResourceView {
  id: string;
  type: "ARTICLE" | "VIDEO" | string;
  title: string;
  content?: string | null;
  videoUrl?: string | null;
  youtubeVideoId?: string | null;
  channel?: string | null;
  durationSeconds?: number | null;
  minProgressRequired: number;
  progress: number;
  completed: boolean;
  segments: VideoSegmentView[];
  checkpoints: VideoCheckpointView[];
  currentTimeSeconds: number;
  percentageWatched: number;
  sourceLanguageCode?: string | null;
  languageFallback?: boolean;
  transcriptAvailable?: boolean;
}

export interface SessionItemView {
  id: string;
  order: number;
  kind: "VIDEO_SEGMENT" | "RESOURCE" | "QUIZ" | string;
  refId: string;
  title: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface LearningSessionView {
  id: string;
  targetMinutes: number;
  requestedDurationMinutes?: number | null;
  status: "ACTIVE" | "COMPLETED" | "ABANDONED" | string;
  startTimeSeconds?: number | null;
  targetEndTimeSeconds?: number | null;
  actualEndTimeSeconds?: number | null;
  videoResourceId?: string | null;
  items: SessionItemView[];
}

export interface WeakConceptView {
  concept: string;
  description: string;
  priority: string;
}

export interface TopicAssessmentView {
  id: string;
  title: string;
  passingScore: number;
  questionCount: number;
  bestScore: number | null;
  attempts: { score: number; attemptedAt: string }[];
}

export interface ItemRequirement {
  type: "RESOURCE" | "QUIZ" | "VIDEO_CHECKPOINTS";
  id: string;
  title: string;
  satisfied: boolean;
  detail: string;
}

export interface TopicDetail {
  item: LearningPathItem;
  resources: LearningResourceView[];
  assessment: TopicAssessmentView | null;
  requirements: ItemRequirement[];
  estimatedMinutes: number;
  activeSession: LearningSessionView | null;
  weakConcepts: WeakConceptView[];
}

export interface DigitalTwinView {
  goal: string;
  skills: { skillId: string; name: string; proficiency: number; status: string }[];
  strengths: string[];
  weaknesses: string[];
  learningDna: {
    learningStyle: string;
    theoryPreference: string;
    practicalPreference: string;
    revisionRequirement: string;
    problemSolvingStrength: string;
    consistencyScore: number;
    contentConsumptionScore: number;
    applicationRateScore: number;
    inferredNote: string | null;
  } | null;
  activeBottlenecks: { id: string; type: string; severity: string; description: string }[];
  currentBottleneckLabel: string;
  insight: string;
}

export interface Bottleneck {
  id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  detectedAt: string;
  status: string;
}

export interface PathCorrection {
  id: string;
  reason: string;
  oldPath: { skillId: string; name: string }[];
  newPath: { skillId: string; name: string }[];
  createdAt: string;
}

export interface DashboardData {
  summary: {
    currentGoal: string;
    completedSkills: number;
    totalSkills: number;
    skippedSkills?: number;
    currentMilestone: string;
    activeBottleneckCount: number;
    learningStreakDays: number;
  };
  skillRadar: { skill: string; proficiency: number }[];
  theoryVsPractice: { theory: number; practice: number };
  weeklyActivity: { day: string; minutes: number }[];
  assessmentTrend: { skill: string; score: number; date: string }[];
  bottlenecks: Bottleneck[];
  recentCorrections: PathCorrection[];
  weakConcepts: WeakConceptView[];
  nextUp: {
    itemId: string;
    skillName: string;
    estimatedMinutes: number;
    videoProgress?: number;
    videoTitle?: string | null;
    videoCurrentTimeSeconds?: number;
    bestQuizScore?: number | null;
  } | null;
}
