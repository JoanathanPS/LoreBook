<p align="center">
  <img src="public/brand/lore-lockup.png" alt="LoreBook" width="420" />
</p>

<p align="center">
  <strong>Turn everything you're studying into something you can actually talk to.</strong>
</p>

<p align="center">
  Upload a textbook chapter, a lecture recording, or a photo of your handwritten notes.<br />
  LoreBook reads it, answers questions about it with citations, turns it into flashcards and quizzes,<br />
  and tracks what you actually know — so you always know what to study next.
</p>

<p align="center">
  <a href="https://lorebook.joanathan.in/"><strong>Try it live →</strong></a>
</p>

---

## The problem

You have four hundred pages of lecture slides, six recorded lectures, a folder of photographed whiteboards, and three past papers. The exam is in a week. The hard part isn't studying — it's knowing *what* to study.

LoreBook is built for that week. It ingests all of it, and then tells you where you're weakest on the things that actually get examined.

## What it does

### Reads anything you throw at it

Drop in a file and LoreBook extracts the meaning, not just the text:

| You upload | It does |
|---|---|
| **PDF** | Text, tables and equations, page by page — so answers can cite "p. 34" |
| **DOCX** | Full document text |
| **Photos of notes, diagrams, whiteboards** | A vision model reads handwriting, transcribes equations, and describes what a diagram actually shows |
| **Lecture audio or video** | Transcribed with timestamps — so answers can cite "12:04" |
| **`.txt` / `.md` notes** | Straight in |

Everything gets chunked, embedded, and indexed for retrieval.

### Answers questions, with receipts

Ask anything across one document or a whole course. Answers stream back grounded **only** in your own material, with inline citations pointing at the exact page or timestamp they came from. If your notes don't cover it, it says so instead of guessing.

There's also a **Tutor mode** that refuses to hand you the answer. It asks guided questions back — using only your material — until you reason your way there yourself.

### Turns it into study material

One click on any course or document generates:

- **Summaries** — organised by topic, with real LaTeX math rendering
- **Flashcards** — atomic, one-fact-per-card, grouped by topic, scheduled by a proper SM-2 spaced-repetition algorithm
- **Quizzes** — multiple choice with plausible distractors and explanations
- **Formula sheets** — every equation, what each symbol means, and when to use it
- **Reels** — a topic broken into a swipeable stack of short cards with a recall check at the end

### Shows you where you stand

- **Knowledge mind map** — an interactive graph of the concepts across everything you've uploaded, arranged into themes, mechanisms and prerequisites, and coloured by how well you know each one
- **Exam predictor** — mark your past papers, and it surfaces which concepts recur most, then builds a drill deck targeting your weakest high-frequency topics
- **Dashboard** — mastery per concept, quiz accuracy trends, streaks, and what's due for review

Every quiz answer, flashcard grade and reel recall check feeds back into your mastery scores, so the picture sharpens as you use it.

### Works with other people

Share a course by invite link and everyone gets the same documents, chat and study material. **Battle mode** puts two people head-to-head on the same quiz with a live shared scoreboard.

## How it works

```
        upload
          │
          ▼
   ┌─────────────┐   PDF ──── pdf-parse (per page)
   │  extract    │   DOCX ─── mammoth
   │             │   image ── Gemini 2.5 Flash (vision)
   │             │   a/v ──── Whisper large-v3-turbo (timestamped)
   └──────┬──────┘
          ▼
   ┌─────────────┐   ~1,800-char chunks, packed on paragraph
   │   chunk     │   boundaries, page/timestamp refs preserved
   └──────┬──────┘
          ▼
   ┌─────────────┐   gemini-embedding-001 (768d)
   │   embed     │   └ falls back to voyage-3
   └──────┬──────┘
          ▼
   ┌─────────────┐   Postgres + pgvector, HNSW index,
   │   store     │   row-level security per user/course
   └──────┬──────┘
          ▼
   ┌─────────────┐   question → embed → cosine top-k →
   │  retrieve   │   inject as numbered, cited context
   └──────┬──────┘
          ▼
   ┌─────────────┐   gpt-oss-120b, streamed, grounded,
   │  generate   │   citations back to page/timestamp
   └─────────────┘
```

The same retrieval layer feeds every study tool — summaries, flashcards, quizzes and reels are all generated from your retrieved material, never from the model's own knowledge.

## Tech stack

**Framework** — Next.js 15 (App Router, Turbopack) · React 19 · TypeScript

**Styling** — Tailwind CSS 4 for layout · CSS Modules for bespoke components · shadcn/ui primitives, re-skinned

**Motion** — Framer Motion (app interactions, reel swipe stack) · GSAP + ScrollTrigger + Lenis (landing page)

**Data** — Supabase: Postgres + `pgvector` for embeddings, Auth, Storage for uploads, Realtime for battle mode. Authorization is enforced in the database via row-level security, not in application code.

**Visualisation** — React Flow for the mind map (initial layout from `d3-force`) · D3 for analytics charts

**AI** —

| Job | Model | Provider |
|---|---|---|
| Chat, RAG answers, all generation | `openai/gpt-oss-120b` | Groq |
| Audio & video transcription | `whisper-large-v3-turbo` | Groq |
| Reading images, diagrams, handwriting | `gemini-2.5-flash` | Google |
| Embeddings (768d) | `gemini-embedding-001` | Google |
| Embeddings fallback | `voyage-3` | Voyage AI |

All of them have usable free tiers — running LoreBook for yourself costs nothing.

---

## Run it yourself

### Prerequisites

- Node.js 20+
- A free [Supabase](https://supabase.com) project
- A free [Groq](https://console.groq.com) API key
- A free [Google AI Studio](https://aistudio.google.com/apikey) API key

### 1. Install

```bash
git clone https://github.com/JoanathanPS/LoreBook.git
cd LoreBook
npm install
```

### 2. Configure

```bash
cp .env.local.example .env.local
```

| Variable | Required | Used for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `GROQ_API_KEY` | Yes | Chat, generation, and audio/video transcription |
| `GEMINI_API_KEY` | Recommended | Embeddings (768d) and vision. Without it, embeddings fall back to Voyage and image reading falls back to a Groq vision model |
| `VOYAGE_API_KEY` | Optional | Fallback embedding provider |
| `NEXT_PUBLIC_SITE_URL` | Optional | Auth email-redirect base URL. Defaults to `http://localhost:3000` |

### 3. Set up the database

In the Supabase SQL Editor, run every file in [`supabase/migrations/`](supabase/migrations) **in order**, `0001` through `0016`. Each one is idempotent, so re-running is safe.

This provisions ingestion and vector search, study artifacts and spaced repetition, the concept mind map and mastery scoring, streaks, the exam predictor, battle mode, shared courses, and chat history.

> **Note:** migration `0014` sets the embedding column to 768 dimensions for Gemini. If you're running an older database that was built for Voyage's 1024 dimensions, run the migrations in order and it will be handled.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On Windows, [`run.bat`](run.bat) installs dependencies on first run, starts the dev server in its own window, and opens your browser.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Deploying

Deploys to [Vercel](https://vercel.com) as-is. Set the same environment variables in your Vercel project settings and point them at your production Supabase project.

The AI routes declare `maxDuration = 60`, since ingestion and generation regularly run longer than the default serverless limit.

## Project structure

```
app/
  (marketing)/               landing page
  (app)/                     authenticated shell
    dashboard/               mastery, trends, streaks, review queue
    library/                 courses, uploads, artifact generation
    document/[id]/           document reader + AI panel
    chat/[courseId]/         RAG chat and tutor mode
    study/                   summary · flashcards · quiz
    reels/[id]/              reel player
    graph/[courseId]/        knowledge mind map
    predict/[courseId]/      exam predictor
    battle/[id]/             head-to-head quiz
    settings/                account
  api/                       route handlers
components/
  ui/                        shadcn primitives, re-skinned
  charts/ study/ chat/ reels/ document/ library/ battle/ collab/
lib/
  ai/                        model clients, prompts, retry/backoff
  ingest/                    extractors, chunking, pipeline
  study/                     generation, mastery, streaks, drill decks
  srs/                       SM-2 scheduler
  supabase/                  client/server/middleware clients
supabase/migrations/         numbered, idempotent SQL — run in order
```

## Notes for contributors

- **Rate limits are handled centrally.** `lib/ai/retry.ts` wraps every upstream call with exponential backoff, honours `retry-after`, and retries structured-output failures. Add new model calls through it.
- **Don't put hard length limits in generation schemas.** Models can't count characters, and a `maxLength` in a structured-output schema becomes a hard API failure. Ask for brevity in the prompt and clamp in code.
- **Authorization lives in the database.** New tables need row-level security policies; see `0009` and `0010` for the owner-vs-member patterns.

[`PLAN.md`](PLAN.md) has the original architecture brief if you're extending things.
