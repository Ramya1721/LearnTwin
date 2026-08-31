import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildFallbackArticle } from "../src/utils/contentTemplates";

const prisma = new PrismaClient();

// ------------------------------------------------------------------
// Curated video content for a subset of Web Development topics.
// Real, existing YouTube videos (freeCodeCamp.org) — never invented —
// with hand-authored timestamp segments (a real admin/content editor
// would define these chapters the same way; the app never scrapes or
// downloads the source video). Topics without an entry here simply get
// the article-only lesson, which is the existing/expected fallback.
// ------------------------------------------------------------------
type VideoSeed = {
  youtubeVideoId: string;
  channel: string;
  durationSeconds: number;
  segments: { title: string; summary: string; startSeconds: number; endSeconds: number }[];
};

const VIDEO_CONTENT: Record<string, VideoSeed> = {
  html: {
    youtubeVideoId: "pQN-pnXPaVg",
    channel: "freeCodeCamp.org",
    durationSeconds: 5400,
    segments: [
      { title: "Introduction & Setup", summary: "What HTML is, and setting up a text editor.", startSeconds: 0, endSeconds: 114 },
      { title: "Structure & Text Tags", summary: "Headings, paragraphs, and basic document structure.", startSeconds: 114, endSeconds: 1200 },
      { title: "Lists & Links", summary: "Ordered/unordered lists and anchor tags.", startSeconds: 1200, endSeconds: 2400 },
      { title: "Forms & Tables", summary: "Building forms and tabular data.", startSeconds: 2400, endSeconds: 3600 },
      { title: "Semantic HTML5", summary: "header/nav/main/footer and why semantics matter.", startSeconds: 3600, endSeconds: 4800 },
      { title: "Wrap-up & Best Practices", summary: "Common mistakes and a quick recap.", startSeconds: 4800, endSeconds: 5400 },
    ],
  },
  css: {
    youtubeVideoId: "n4R2E7O-Ngo",
    channel: "freeCodeCamp.org",
    durationSeconds: 39600,
    segments: [
      { title: "CSS Basics & Selectors", summary: "Syntax, selectors, and specificity.", startSeconds: 0, endSeconds: 3600 },
      { title: "The Box Model", summary: "Margin, border, padding, and content sizing.", startSeconds: 3600, endSeconds: 7200 },
      { title: "Flexbox", summary: "One-dimensional layout with flexbox.", startSeconds: 7200, endSeconds: 14400 },
      { title: "CSS Grid", summary: "Two-dimensional layout with grid.", startSeconds: 14400, endSeconds: 21600 },
      { title: "Responsive Design", summary: "Media queries and mobile-first layout.", startSeconds: 21600, endSeconds: 28800 },
      { title: "Animations & Transitions", summary: "Bringing interfaces to life.", startSeconds: 28800, endSeconds: 39600 },
    ],
  },
  js_basics: {
    youtubeVideoId: "jS4aFq5-91M",
    channel: "freeCodeCamp.org",
    durationSeconds: 12600,
    segments: [
      { title: "Variables & Data Types", summary: "let/const, primitives, and type coercion.", startSeconds: 0, endSeconds: 1800 },
      { title: "Operators & Control Flow", summary: "Comparisons, if/else, and switch.", startSeconds: 1800, endSeconds: 3600 },
      { title: "Loops & Iteration", summary: "for, while, and iterating collections.", startSeconds: 3600, endSeconds: 5400 },
      { title: "Arrays & Objects", summary: "Core data structures in JavaScript.", startSeconds: 5400, endSeconds: 7200 },
      { title: "DOM Basics", summary: "Selecting and updating elements on a page.", startSeconds: 7200, endSeconds: 9000 },
      { title: "Wrap-up", summary: "Recap and where to go next.", startSeconds: 9000, endSeconds: 12600 },
    ],
  },
  functions: {
    youtubeVideoId: "jS4aFq5-91M",
    channel: "freeCodeCamp.org",
    durationSeconds: 12600,
    segments: [
      { title: "Declaring Functions", summary: "Function declarations vs expressions.", startSeconds: 9000, endSeconds: 10200 },
      { title: "Arrow Functions & Scope", summary: "Arrow syntax, `this`, and lexical scope.", startSeconds: 10200, endSeconds: 11400 },
      { title: "Higher-Order Functions", summary: "Passing and returning functions.", startSeconds: 11400, endSeconds: 12600 },
    ],
  },
};

// Concept-tagged question banks for the topics the demo narrative already
// treats as this learner's weak spot (see attemptRows below) — this is
// what lets weak-area detection point at a specific sub-concept instead of
// a generic "you failed this quiz".
const CONCEPT_QUESTIONS: Record<string, { question: string; options: string[]; correctAnswer: string; explanation: string; concept: string }[]> = {
  callbacks: [
    {
      question: "What is a callback function?",
      options: ["A function passed as an argument to run later", "A function that calls itself", "A CSS animation", "A database index"],
      correctAnswer: "A function passed as an argument to run later",
      explanation: "Callbacks let you defer work until an async operation (or another function) is ready to hand control back.",
      concept: "Callback Basics",
    },
    {
      question: "What is 'callback hell'?",
      options: [
        "Deeply nested callbacks that become hard to read/maintain",
        "A callback that never runs",
        "A syntax error in function declarations",
        "A memory leak in Node.js",
      ],
      correctAnswer: "Deeply nested callbacks that become hard to read/maintain",
      explanation: "Chaining many async steps with nested callbacks produces a 'pyramid of doom' — Promises/async-await exist largely to fix this.",
      concept: "Callback Hell",
    },
    {
      question: "In Node's error-first callback convention, what is the first argument?",
      options: ["An error object (or null if none)", "The result data", "A timestamp", "The function name"],
      correctAnswer: "An error object (or null if none)",
      explanation: "Error-first callbacks always reserve the first parameter for an error, so failures can't be silently ignored.",
      concept: "Error-First Convention",
    },
  ],
  promises: [
    {
      question: "What are the three states of a Promise?",
      options: ["pending, fulfilled, rejected", "start, middle, end", "loading, success, failure", "open, close, error"],
      correctAnswer: "pending, fulfilled, rejected",
      explanation: "A Promise always begins pending and settles exactly once, to either fulfilled or rejected.",
      concept: "Promise States",
    },
    {
      question: "Which method runs after ALL promises in an array have resolved (or one rejects)?",
      options: ["Promise.all()", "Promise.race()", "Promise.resolve()", "Promise.then()"],
      correctAnswer: "Promise.all()",
      explanation: "Promise.all waits for every promise to fulfill, and rejects immediately if any one of them rejects.",
      concept: "Promise Combinators",
    },
    {
      question: "How do you handle a rejected Promise?",
      options: [".catch() (or the second argument to .then())", ".error()", "try/catch only, never .catch()", "Promises can't fail"],
      correctAnswer: ".catch() (or the second argument to .then())",
      explanation: ".catch() (or the reject handler in .then) is how you handle a Promise that settles as rejected.",
      concept: "Error Handling",
    },
  ],
  async_await: [
    {
      question: "What does the `await` keyword do?",
      options: [
        "Pauses execution of the async function until the Promise settles",
        "Runs code in a separate thread",
        "Cancels a Promise",
        "Converts a callback into a Promise automatically",
      ],
      correctAnswer: "Pauses execution of the async function until the Promise settles",
      explanation: "`await` suspends the async function (without blocking the event loop) until the awaited Promise resolves or rejects.",
      concept: "Await Semantics",
    },
    {
      question: "How do you handle errors in an async/await function?",
      options: ["try/catch around the await", ".catch() only", "Errors can't be caught", "on Error() listener"],
      correctAnswer: "try/catch around the await",
      explanation: "A rejected awaited Promise throws inside the async function, so a normal try/catch block catches it.",
      concept: "Error Handling in Async Functions",
    },
    {
      question: "Can you use `await` at the top level of a regular (non-async) function?",
      options: ["No — await is only valid inside an async function (or top-level module)", "Yes, always", "Only in Node.js", "Only with arrow functions"],
      correctAnswer: "No — await is only valid inside an async function (or top-level module)",
      explanation: "`await` outside an async function (or top-level ES module context) is a syntax error.",
      concept: "Await Semantics",
    },
  ],
};

type SkillDef = {
  key: string;
  name: string;
  domain: string;
  description: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  module: string;
  moduleOrder: number;
  prerequisites?: string[]; // keys
};

const WEB_DEV: SkillDef[] = [
  { key: "html", name: "HTML", domain: "Web Development", description: "Structuring web content with semantic markup.", difficulty: "BEGINNER", module: "Foundations", moduleOrder: 0 },
  { key: "css", name: "CSS", domain: "Web Development", description: "Styling and layout for the web.", difficulty: "BEGINNER", module: "Foundations", moduleOrder: 0, prerequisites: ["html"] },
  { key: "js_basics", name: "JavaScript Basics", domain: "Web Development", description: "Variables, control flow, and data types.", difficulty: "BEGINNER", module: "Foundations", moduleOrder: 0, prerequisites: ["html", "css"] },
  { key: "functions", name: "Functions", domain: "Web Development", description: "Declaring, invoking, and composing functions.", difficulty: "BEGINNER", module: "Core Concepts", moduleOrder: 1, prerequisites: ["js_basics"] },
  { key: "callbacks", name: "Callbacks", domain: "Web Development", description: "Passing functions as arguments to handle async work.", difficulty: "INTERMEDIATE", module: "Core Concepts", moduleOrder: 1, prerequisites: ["functions"] },
  { key: "promises", name: "Promises", domain: "Web Development", description: "Modeling eventual completion/failure of async operations.", difficulty: "INTERMEDIATE", module: "Practical Application", moduleOrder: 2, prerequisites: ["callbacks"] },
  { key: "async_await", name: "Async/Await", domain: "Web Development", description: "Syntactic sugar over promises for readable async code.", difficulty: "INTERMEDIATE", module: "Practical Application", moduleOrder: 2, prerequisites: ["promises"] },
  { key: "api_integration", name: "API Integration", domain: "Web Development", description: "Fetching and integrating data from REST APIs.", difficulty: "ADVANCED", module: "Advanced Topics", moduleOrder: 3, prerequisites: ["async_await"] },
  { key: "react", name: "React", domain: "Web Development", description: "Component-based UI development with React.", difficulty: "ADVANCED", module: "Advanced Topics", moduleOrder: 3, prerequisites: ["api_integration"] },
  { key: "node", name: "Node.js", domain: "Web Development", description: "Server-side JavaScript runtime and APIs.", difficulty: "ADVANCED", module: "Advanced Topics", moduleOrder: 3, prerequisites: ["async_await"] },
];

const PYTHON: SkillDef[] = [
  { key: "py_syntax", name: "Python Syntax", domain: "Python Programming", description: "Variables, types, and basic I/O in Python.", difficulty: "BEGINNER", module: "Foundations", moduleOrder: 0 },
  { key: "py_control_flow", name: "Control Flow", domain: "Python Programming", description: "Conditionals and loops.", difficulty: "BEGINNER", module: "Foundations", moduleOrder: 0, prerequisites: ["py_syntax"] },
  { key: "py_functions", name: "Functions & Modules", domain: "Python Programming", description: "Writing reusable functions and organizing code into modules.", difficulty: "BEGINNER", module: "Core Concepts", moduleOrder: 1, prerequisites: ["py_control_flow"] },
  { key: "py_data_structures", name: "Data Structures", domain: "Python Programming", description: "Lists, dicts, sets, tuples and comprehensions.", difficulty: "INTERMEDIATE", module: "Core Concepts", moduleOrder: 1, prerequisites: ["py_functions"] },
  { key: "py_oop", name: "Object-Oriented Python", domain: "Python Programming", description: "Classes, inheritance, and encapsulation.", difficulty: "INTERMEDIATE", module: "Practical Application", moduleOrder: 2, prerequisites: ["py_data_structures"] },
  { key: "py_error_handling", name: "Error Handling", domain: "Python Programming", description: "Exceptions, try/except, and defensive coding.", difficulty: "INTERMEDIATE", module: "Practical Application", moduleOrder: 2, prerequisites: ["py_functions"] },
  { key: "py_file_io", name: "File I/O", domain: "Python Programming", description: "Reading and writing files, working with paths.", difficulty: "INTERMEDIATE", module: "Practical Application", moduleOrder: 2, prerequisites: ["py_error_handling"] },
  { key: "py_apis", name: "Working with APIs", domain: "Python Programming", description: "Making HTTP requests and parsing JSON in Python.", difficulty: "ADVANCED", module: "Advanced Topics", moduleOrder: 3, prerequisites: ["py_oop", "py_file_io"] },
];

const DATA_SCIENCE: SkillDef[] = [
  { key: "ds_stats", name: "Statistics Foundations", domain: "Data Science", description: "Descriptive statistics, distributions, probability basics.", difficulty: "BEGINNER", module: "Foundations", moduleOrder: 0 },
  { key: "ds_python_numeric", name: "NumPy & Pandas", domain: "Data Science", description: "Numeric computing and dataframes for analysis.", difficulty: "BEGINNER", module: "Foundations", moduleOrder: 0, prerequisites: ["ds_stats"] },
  { key: "ds_visualization", name: "Data Visualization", domain: "Data Science", description: "Communicating insight with charts using Matplotlib/Seaborn.", difficulty: "INTERMEDIATE", module: "Core Concepts", moduleOrder: 1, prerequisites: ["ds_python_numeric"] },
  { key: "ds_cleaning", name: "Data Cleaning", domain: "Data Science", description: "Handling missing data, outliers, and inconsistent formats.", difficulty: "INTERMEDIATE", module: "Core Concepts", moduleOrder: 1, prerequisites: ["ds_python_numeric"] },
  { key: "ds_ml_basics", name: "ML Foundations", domain: "Data Science", description: "Supervised vs unsupervised learning, train/test splits.", difficulty: "INTERMEDIATE", module: "Practical Application", moduleOrder: 2, prerequisites: ["ds_cleaning", "ds_visualization"] },
  { key: "ds_regression", name: "Regression Models", domain: "Data Science", description: "Linear/logistic regression and evaluation metrics.", difficulty: "ADVANCED", module: "Advanced Topics", moduleOrder: 3, prerequisites: ["ds_ml_basics"] },
  { key: "ds_model_eval", name: "Model Evaluation", domain: "Data Science", description: "Cross-validation, precision/recall, overfitting.", difficulty: "ADVANCED", module: "Advanced Topics", moduleOrder: 3, prerequisites: ["ds_regression"] },
];

const ALL_DOMAINS = [WEB_DEV, PYTHON, DATA_SCIENCE];


async function main() {
  console.log("Seeding LearnTwin database...");

  await prisma.recommendation.deleteMany();
  await prisma.sessionItem.deleteMany();
  await prisma.learningSession.deleteMany();
  await prisma.pathCorrection.deleteMany();
  await prisma.bottleneck.deleteMany();
  await prisma.learningActivity.deleteMany();
  await prisma.assessmentAttempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.resourceProgress.deleteMany();
  await prisma.videoSegment.deleteMany();
  await prisma.learningResource.deleteMany();
  await prisma.learningPathItem.deleteMany();
  await prisma.learningPath.deleteMany();
  await prisma.userSkill.deleteMany();
  await prisma.skillDependency.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.learningDna.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();

  const keyToId: Record<string, string> = {};

  for (const domainSkills of ALL_DOMAINS) {
    for (const s of domainSkills) {
      const created = await prisma.skill.create({
        data: {
          name: s.name,
          domain: s.domain,
          description: s.description,
          difficulty: s.difficulty,
          module: s.module,
          moduleOrder: s.moduleOrder,
          generated: false,
        },
      });
      keyToId[s.key] = created.id;
    }
  }

  for (const domainSkills of ALL_DOMAINS) {
    for (const s of domainSkills) {
      for (const prereqKey of s.prerequisites || []) {
        await prisma.skillDependency.create({
          data: { skillId: keyToId[s.key], prerequisiteSkillId: keyToId[prereqKey] },
        });
      }
    }
  }

  // ---- Assessments (one per skill, 3 questions each, generic but topic-flavored) ----
  // ---- Learning resources (one article-style lesson per skill) ----
  const allSkillDefs = ALL_DOMAINS.flat();
  const assessmentIdByKey: Record<string, string> = {};
  for (const s of allSkillDefs) {
    const assessment = await prisma.assessment.create({
      data: { skillId: keyToId[s.key], title: `${s.name} Quiz`, difficulty: s.difficulty, passingScore: 70 },
    });
    assessmentIdByKey[s.key] = assessment.id;
    await prisma.question.createMany({
      data: buildQuestions(assessment.id, s.key, s.name),
    });

    // Reading resource — every topic gets one regardless of video availability.
    await prisma.learningResource.create({
      data: {
        skillId: keyToId[s.key],
        type: "ARTICLE",
        title: `${s.name} — Lesson`,
        content: buildFallbackArticle(s.name, s.domain, s.difficulty),
        order: 1,
        minProgressRequired: 80,
      },
    });

    // Video resource + timestamped segments, where curated content exists
    // for this topic (see VIDEO_CONTENT above). Never fabricated for topics
    // without a real, configured video.
    const video = VIDEO_CONTENT[s.key];
    if (video) {
      const videoResource = await prisma.learningResource.create({
        data: {
          skillId: keyToId[s.key],
          type: "VIDEO",
          title: `${s.name} — Video Walkthrough`,
          content: `Selected chapters from a freeCodeCamp.org full-course video, focused on ${s.name}.`,
          videoUrl: `https://www.youtube.com/watch?v=${video.youtubeVideoId}`,
          youtubeVideoId: video.youtubeVideoId,
          channel: video.channel,
          durationSeconds: video.durationSeconds,
          order: 0,
          minProgressRequired: 80,
        },
      });
      await prisma.videoSegment.createMany({
        data: video.segments.map((seg, idx) => ({
          resourceId: videoResource.id,
          title: seg.title,
          summary: seg.summary,
          startSeconds: seg.startSeconds,
          endSeconds: seg.endSeconds,
          order: idx,
        })),
      });
    }
  }

  // ---- Demo user: Alex Johnson ----
  const hashed = await bcrypt.hash("demo1234", 10);
  const alex = await prisma.user.create({
    data: { name: "Alex Johnson", email: "alex@learntwin.dev", password: hashed },
  });

  await prisma.userProfile.create({
    data: {
      userId: alex.id,
      careerGoal: "Full Stack Developer",
      domain: "Web Development",
      experienceLevel: "Beginner-Intermediate",
      availableHoursPerWeek: 10,
      preferredLearningStyle: "Visual / Video",
      onboarded: true,
    },
  });

  await prisma.learningDna.create({
    data: {
      userId: alex.id,
      learningStyle: "Visual Learner (self-reported)",
      theoryPreference: "High",
      practicalPreference: "Low",
      sessionPreference: "Long sessions",
      revisionRequirement: "High",
      problemSolvingStrength: "Developing",
      consistencyScore: 42,
      contentConsumptionScore: 85,
      applicationRateScore: 15,
    },
  });

  const webDevProficiency: Record<string, number> = {
    html: 90,
    css: 85,
    js_basics: 55,
    functions: 68,
    callbacks: 40,
    promises: 30,
    async_await: 20,
    api_integration: 10,
    react: 5,
    node: 5,
  };

  for (const [key, proficiency] of Object.entries(webDevProficiency)) {
    const status = proficiency >= 80 ? "COMPLETED" : proficiency >= 40 ? "IN_PROGRESS" : proficiency > 0 ? "WEAK" : "NOT_STARTED";
    await prisma.userSkill.create({
      data: { userId: alex.id, skillId: keyToId[key], proficiency, status, lastPracticed: new Date() },
    });
  }

  // seed a little baseline proficiency in the other two domains so they're browsable
  for (const domainSkills of [PYTHON, DATA_SCIENCE]) {
    for (const s of domainSkills.slice(0, 2)) {
      await prisma.userSkill.create({
        data: { userId: alex.id, skillId: keyToId[s.key], proficiency: 20, status: "IN_PROGRESS" },
      });
    }
  }

  // ---- Learning activities: heavy video consumption, almost no practice ----
  const now = Date.now();
  const activityRows = [];
  for (let i = 0; i < 25; i++) {
    activityRows.push({
      userId: alex.id,
      skillId: keyToId[i < 8 ? "js_basics" : i < 16 ? "callbacks" : "promises"],
      activityType: "VIDEO",
      duration: 20,
      completedAt: new Date(now - (30 - i) * 24 * 60 * 60 * 1000),
    });
  }
  for (let i = 0; i < 8; i++) {
    activityRows.push({
      userId: alex.id,
      skillId: keyToId["async_await"],
      activityType: "ARTICLE",
      duration: 15,
      completedAt: new Date(now - (20 - i) * 24 * 60 * 60 * 1000),
    });
  }
  for (let i = 0; i < 3; i++) {
    activityRows.push({
      userId: alex.id,
      skillId: keyToId["callbacks"],
      activityType: "PRACTICE",
      duration: 25,
      completedAt: new Date(now - (5 - i) * 24 * 60 * 60 * 1000),
    });
  }
  await prisma.learningActivity.createMany({ data: activityRows });

  // ---- Assessment attempts: repeated failures on Promises / Async/Await ----
  const attemptRows = [
    { skillKey: "callbacks", score: 45, daysAgo: 10 },
    { skillKey: "promises", score: 35, daysAgo: 8 },
    { skillKey: "promises", score: 38, daysAgo: 5 },
    { skillKey: "async_await", score: 25, daysAgo: 3 },
    { skillKey: "async_await", score: 28, daysAgo: 1 },
  ];
  for (const row of attemptRows) {
    await prisma.assessmentAttempt.create({
      data: {
        userId: alex.id,
        assessmentId: assessmentIdByKey[row.skillKey],
        score: row.score,
        attemptedAt: new Date(now - row.daysAgo * 24 * 60 * 60 * 1000),
      },
    });
  }

  // ---- Initial (pre-correction) learning path so the "BEFORE" state is visible ----
  const originalSequence = ["js_basics", "functions", "callbacks", "promises", "async_await", "api_integration", "react"];
  const learningPath = await prisma.learningPath.create({
    data: { userId: alex.id, goal: "Full Stack Developer", status: "ACTIVE" },
  });
  await prisma.learningPathItem.createMany({
    data: originalSequence.map((key, idx) => ({
      learningPathId: learningPath.id,
      skillId: keyToId[key],
      sequence: idx,
      status: idx < 2 ? "COMPLETED" : key === "callbacks" ? "WEAK" : idx === 3 ? "CURRENT" : "LOCKED",
    })),
  });

  console.log("Seed complete.");
  console.log("Demo login -> email: alex@learntwin.dev | password: demo1234");
  console.log(
    "Tip: call POST /api/bottlenecks/analyze and POST /api/path-corrections/analyze (or just log in and open the Dashboard) to trigger the self-correcting cycle on this seeded data."
  );
}

function buildQuestions(assessmentId: string, skillKey: string, skillName: string) {
  const conceptBank = CONCEPT_QUESTIONS[skillKey];
  if (conceptBank) {
    return conceptBank.map((q) => ({
      assessmentId,
      question: q.question,
      options: JSON.stringify(q.options),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      concept: q.concept,
    }));
  }
  return [
    {
      assessmentId,
      question: `Which statement best describes a core concept of ${skillName}?`,
      options: JSON.stringify(["Fundamental definition A", "Unrelated concept B", "Fundamental definition A (duplicate distractor)", "None of the above"]),
      correctAnswer: "Fundamental definition A",
      explanation: `This tests foundational recognition of ${skillName}.`,
    },
    {
      assessmentId,
      question: `What is a common mistake beginners make when learning ${skillName}?`,
      options: JSON.stringify(["Skipping fundamentals", "Reading documentation", "Practicing regularly", "Asking questions"]),
      correctAnswer: "Skipping fundamentals",
      explanation: `Understanding common pitfalls reinforces mastery of ${skillName}.`,
    },
    {
      assessmentId,
      question: `In a real project, when would you apply ${skillName}?`,
      options: JSON.stringify(["When the specific use case arises", "Never", "Only in interviews", "Only when told to"]),
      correctAnswer: "When the specific use case arises",
      explanation: `Applied understanding of when to use ${skillName} indicates deeper mastery.`,
    },
  ];
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
