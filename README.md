# LearnTwin

**"Your learning path should learn from you."**

A self-correcting, personalized learning platform built around a continuously
updated **Learner Digital Twin**. Built for the HCL Amplified Hackathon.

---

## 1. Project Overview

Most learning platforms recommend courses and show progress percentages. They
don't understand *how* a learner actually learns, *why* they keep failing a
topic, or *whether* their learning strategy is even working.

LearnTwin builds a live digital representation of each learner — their goals,
skills, behavior, and bottlenecks — and uses it to continuously rewrite their
learning path when something isn't working, with a plain-language explanation
every time.

## 2. Problem Statement

- A learner can watch 30 videos and solve zero problems.
- A learner can fail an advanced topic because a foundational concept never
  actually stuck.
- Traditional systems track *completion*, not *comprehension*, and never ask
  *why* someone is stuck.

## 3. Solution

LearnTwin observes real learning behavior (content consumed, exercises
completed, quiz scores, consistency) and maintains a **Digital Twin** that:

1. Infers how a learner actually learns (vs. what they claim to prefer).
2. Detects *behavioral* bottlenecks (passive learning, theory/practice
   imbalance, inconsistency, difficulty mismatch).
3. Walks a **skill dependency graph** to trace repeated failures back to their
   true root cause — not just "you failed Promises," but "you failed Promises
   *because* Callbacks never solidified."
4. Rewrites the learning path automatically and explains why.

## 4. Key Innovation

The **Dynamic Learner Digital Twin** + **Failure-Aware Learning Engine**
working together: instead of a static roadmap, the system runs this loop
continuously:

```
Learner Data → Digital Twin → Personalized Path → Learning Activity
→ Failure + Bottleneck Analysis → Skill Dependency Analysis
→ Path Correction → Updated Digital Twin → Explainable Recommendation
→ (repeat)
```

## 5. Features

- Email/password auth (JWT + bcrypt)
- Multi-step onboarding: career goal, experience, available time, Learning DNA
- Skill dependency graphs for 3 domains (Web Development, Python Programming,
  Data Science), each with realistic prerequisite chains
- Personalized learning path generation via topological sort of the skill graph
- Assessment engine (MCQ, scored, updates skill proficiency)
- **Rule-based** bottleneck detector: passive learning, theory/practice
  imbalance, foundation gap, difficulty mismatch, consistency bottleneck,
  revision bottleneck
- **Graph-based** failure-aware root-cause detector + automatic path
  correction, with before/after comparison and a plain-language explanation
- Practice/activity tracker feeding the bottleneck detector
- Learning analytics: skill radar, theory-vs-practice, weekly activity,
  assessment score trend
- AI Learning Assistant, grounded in the learner's actual Digital Twin data,
  with a full deterministic fallback if no LLM API key is configured
- Recommendation explainability baked into every correction and bottleneck
- **Real learning content per topic**: video (with timestamped, jump-to
  segments), reading, and a quiz — completion requires actually consuming
  content and passing the quiz, never a bare "mark complete" button
- **Micro-learning sessions** ("I only have 10 minutes"): generates a
  time-boxed plan (video segment + reading + quiz) from a topic's existing
  content to fit any budget, resumable via "Continue where you left off"
- **Concept-level weak-area detection**: quiz questions can be tagged with a
  sub-concept (e.g. "Promise Combinators"); missing them repeatedly surfaces
  a targeted recommendation instead of a generic "you failed this quiz"

## 6. Architecture

```
Frontend (React/Vite/TS/Tailwind)
        │  Axios / JWT bearer
        ▼
Backend (Express/TS)
  ├─ routes/*            → thin HTTP layer
  ├─ services/
  │   ├─ skillGraphService.ts     (pure graph algorithms — root cause detection)
  │   ├─ bottleneckService.ts     (pure rule-based detectors)
  │   ├─ pathCorrectionService.ts (orchestrates graph + persists corrections)
  │   ├─ learningPathService.ts   (topological path generation)
  │   ├─ digitalTwinService.ts    (aggregates twin view, DNA reconciliation)
  │   ├─ sessionService.ts        (micro-learning session generation/progress)
  │   └─ aiService.ts             (LLM wording layer + deterministic fallback)
  └─ prisma/schema.prisma → PostgreSQL
```

**Design principle from the brief, followed exactly:** core intelligence
(skill dependency traversal, bottleneck detection, path correction) is 100%
deterministic — pure functions in `skillGraphService.ts` and
`bottleneckService.ts` that don't call any AI API. The `aiService.ts` layer is
used *only* for wording explanations and the assistant's natural-language
answers, and every function in it has a rule-based fallback, so the app is
fully demoable with zero API keys configured.

## 7. Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Router,
  Axios, Recharts, lucide-react
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT + bcrypt
- **AI:** Anthropic API (optional), with deterministic fallback for every
  AI-touching feature

## 8. Folder Structure

```
learntwin/
├── README.md
├── docker-compose.yml       # local Postgres
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts          # 3 domains + "Alex Johnson" demo scenario
│   ├── src/
│   │   ├── controllers/     # (routes double as controllers for this MVP)
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── utils/
│   │   └── index.ts
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── layouts/
    │   ├── context/
    │   ├── services/
    │   └── types/
    └── .env.example
```

## 9. Database Setup

The schema (`backend/prisma/schema.prisma`) implements every table from the
spec: `User`, `UserProfile`, `LearningDna`, `Skill`, `SkillDependency`,
`UserSkill`, `LearningPath`, `LearningPathItem`, `Assessment`, `Question`,
`AssessmentAttempt`, `LearningActivity`, `Bottleneck`, `PathCorrection`,
`Recommendation`.

Start Postgres locally with Docker:

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` with user/password/db all set to
`learntwin` (see `docker-compose.yml`). If you already run Postgres locally,
just point `DATABASE_URL` at it instead.

## 10. Environment Variables

**`backend/.env`** (copy from `backend/.env.example`):

```
DATABASE_URL="postgresql://learntwin:learntwin@localhost:5432/learntwin?schema=public"
PORT=4000
JWT_SECRET="change_this_to_a_long_random_string"
ANTHROPIC_API_KEY=        # optional — app works fully without it
ANTHROPIC_MODEL=claude-sonnet-4-6
```

**`frontend/.env`** (copy from `frontend/.env.example`):

```
VITE_API_URL=http://localhost:4000/api
```

## 11. Installation Instructions

```bash
git clone <this-repo>
cd learntwin

# 1. Start Postgres
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev            # http://localhost:4000

# 3. Frontend (new terminal)
cd ../frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

> **Note on `npx prisma generate`:** this step needs normal internet access
> to download Prisma's query engine binaries. It was not runnable inside the
> sandboxed environment this project was authored in (outbound network was
> restricted to a small allow-list that didn't include Prisma's binary CDN),
> so the Prisma-dependent backend code could be typechecked and logically
> verified, but not run end-to-end against a live database in that sandbox.
> It will work normally on a standard developer machine or CI runner.

## 12. Running Frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173`.

## 13. Running Backend

```bash
cd backend
npm run dev
```

Health check: `GET http://localhost:4000/api/health`

## 14. Seeding Demo Data

```bash
cd backend
npm run seed
```

This creates skill graphs for **Web Development**, **Python Programming**, and
**Data Science**, plus a demo learner, **Alex Johnson**, deliberately seeded to
trigger the full self-correcting cycle:

- Heavy video/article consumption (25 videos, 8 articles), almost no practice
  (3 exercises, 0 projects) → **Passive Learning** + **Theory/Practice
  Imbalance**
- Proficiency: Functions 68%, Callbacks 40%, Promises 30%, Async/Await 20%
- Repeated failed assessment attempts on Callbacks, Promises, and Async/Await
- Running the analysis (via the Dashboard, or `POST /api/bottlenecks/analyze`
  and `POST /api/path-corrections/analyze`) surfaces a **Foundation Gap**
  rooted in Callbacks and rewrites the path to:

  `Callbacks Revision → Promises → Async/Await → API Integration`

  — exactly the before/after scenario described in the product brief.

## 15. Demo Credentials

```
Email:    alex@learntwin.dev
Password: demo1234
```

(Prefilled automatically on the login screen.)

## 16. API Documentation

All routes are prefixed with `/api`. Protected routes require
`Authorization: Bearer <token>`.

| Area | Method & Path | Description |
|---|---|---|
| Auth | `POST /auth/register` | Create account |
| Auth | `POST /auth/login` | Login |
| Auth | `GET /auth/me` | Current user + onboarded flag |
| Profile | `GET /profile` | Get profile |
| Profile | `PUT /profile` | Save onboarding (profile + Learning DNA + generates path) |
| Digital Twin | `GET /digital-twin` | Full twin view |
| Digital Twin | `POST /digital-twin/update` | Reconcile DNA from behavior |
| Skills | `GET /skills?domain=` | List skills |
| Skills | `GET /skills/graph?domain=` | Nodes + edges for a domain |
| Skills | `GET /skills/user-skills` | Learner's proficiency per skill |
| Skills | `PUT /skills/user-skills/:id` | Update proficiency/status |
| Learning Path | `POST /learning-path/generate` | Generate path for a domain/goal |
| Learning Path | `GET /learning-path` | Active path |
| Learning Path | `POST /learning-path/update-progress` | Mark item complete |
| Assessments | `GET /assessments?domain=` | List assessments |
| Assessments | `GET /assessments/:id` | Questions (answers stripped) |
| Assessments | `POST /assessments/:id/submit` | Score + triggers bottleneck/correction cycle on weak scores |
| Activities | `POST /activities` | Log video/article/practice/project/revision |
| Activities | `GET /activities` | Activity history |
| Bottlenecks | `GET /bottlenecks` | List detected bottlenecks |
| Bottlenecks | `POST /bottlenecks/analyze` | Re-run rule-based detection |
| Path Corrections | `GET /path-corrections` | Correction history (old vs new path) |
| Path Corrections | `POST /path-corrections/analyze` | Re-run root-cause + correction |
| AI | `POST /ai/ask` | Ask the assistant (grounded in Digital Twin) |
| AI | `POST /ai/explain-path` | Latest correction explanation |
| Analytics | `GET /analytics/dashboard` | Full dashboard payload |

## 17. Future AI Enhancements

- Streaming assistant responses
- Multi-turn assistant memory beyond a single question
- LLM-assisted generation of new domains/skill graphs from a syllabus
- Adaptive assessment difficulty (IRT-style) instead of fixed 3-question quizzes
- Spaced-repetition scheduling driven by the Revision Bottleneck detector

---

Built with an original design system (dark "instrument panel" aesthetic, a
custom mirrored `TwinBar` visualization) — no third-party generator branding
appears anywhere in the UI.
