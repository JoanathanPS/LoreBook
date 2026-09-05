<img width="2000" height="2000" alt="LoreBook Logo" src="https://github.com/user-attachments/assets/837be1e4-267f-4e13-ae65-c19d8d564352" />


<h1 align="center">LoreBook</h1>

<p align="center">
  An AI-powered, multimodal study workspace for engineering students.<br />
  Upload a PDF, a lecture recording, or a photo of your notes — chat with it, cite it, quiz on it, and track mastery over time.
</p>

---

## What it does

LoreBook takes whatever you're studying from — textbooks, lecture slides, lecture video/audio, photographed handwritten notes, datasheets — and:

1. **Understands it.** Text, tables, and equations are extracted from PDFs/DOCX; audio and video are transcribed with timestamps; photos and diagrams are read by a vision model. Everything is chunked and embedded for retrieval.
2. **Lets you talk to it.** Chat scoped to a single document or a whole course, with answers that cite the exact page or timestamp they came from.
3. **Turns it into study material.** One click generates a summary, a flashcard deck, a quiz, or a formula sheet — flashcards feed a spaced-repetition (SM-2) queue.
4. **Shows you where you stand.** A concept graph links ideas across everything you've uploaded, and a dashboard tracks mastery, quiz trends, and streaks.

Full product spec and design rationale: [PLAN.md](PLAN.md).

## Features

| Module | What it does |
|---|---|
| **Ingestion pipeline** | Upload PDF / DOCX / image / audio / video / plain notes. Extracts text (PDF/DOCX), transcribes audio & video with segment timestamps (Groq Whisper), and reads photos/diagrams/handwriting with a vision model. Chunks and embeds everything into `pgvector` for retrieval. |
| **Chat over your corpus (RAG)** | Ask questions scoped to one document or an entire course. Retrieval-augmented answers stream token-by-token and cite the source page or timestamp inline. |
| **AI Tutor (Socratic mode)** | A chat mode that refuses to just hand you the answer — it asks guided questions back, using only your own course material, until you reason your way there. |
| **Study artifacts** | Generate a summary, a flashcard deck, an MCQ/short-answer quiz, or a formula sheet from a document or course in one click. |
| **Spaced repetition** | Flashcard reviews run on a classic SM-2 scheduler (`lib/srs/sm2.ts`) — ease factor, interval, and due date update per grade. |
| **Study Reels** | A topic decomposed into a swipeable stack of bite-sized cards with a recall check at the end, feeding straight back into mastery scoring. |
| **Concept graph** | An interactive React Flow graph (initial layout computed with `d3-force`) linking concepts across every document you've uploaded — pan, zoom, drag nodes, minimap — colored by mastery, click-through to source passages. |
| **Analytics dashboard** | Study time, quiz accuracy trends, topic mastery, and your spaced-repetition due queue in one view. |
| **Exam predictor** | Feed in past papers — flags which concepts recur most and builds a targeted drill deck from your weakest, most-tested topics. |
| **Battle mode** | Two students on the same course, live head-to-head quiz with a shared score view. |
| **Collaboration** | Invite-link based shared course spaces (`course_invites` / `course_members`). |
| **Command palette (⌘K)** | Global fuzzy search and navigation across courses, documents, and concepts. |
| **PWA** | Installable, offline-capable shell via a hand-written service worker (`public/sw.js`) — works with the docs you've already opened even offline. |

## Tech stack

- **Framework** — Next.js 15 (App Router, Turbopack) · React 19 · TypeScript
- **Styling** — Tailwind CSS 4 for layout, CSS Modules for bespoke visual design, [shadcn/ui](https://ui.shadcn.com) primitives re-skinned per component
- **Motion** — Framer Motion (in-app interaction, Reels swipe stack) · GSAP + ScrollTrigger + Lenis (marketing page scrollytelling)
- **Data viz** — React Flow (concept graph — pan/zoom/drag, initial layout from `d3-force`) · D3 (analytics charts)
- **Backend** — Supabase: Postgres + `pgvector` (embeddings/RAG), Auth, Storage (uploaded files), Realtime (battle mode)
- **AI / inference** — [Groq](https://groq.com) for `openai/gpt-oss-120b` (chat, RAG answers, artifact/Reel generation), `meta-llama/llama-4-scout-17b-16e-instruct` (vision — diagrams/handwriting), and `whisper-large-v3-turbo` (audio/video transcription); [Voyage AI](https://www.voyageai.com) `voyage-3` for embeddings; all wired through the [Vercel AI SDK](https://sdk.vercel.ai) for streaming
- **PWA** — hand-rolled service worker + manifest (no `next-pwa`, to stay compatible with `next build --turbopack`)

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- API keys for [Groq](https://console.groq.com) and [Voyage AI](https://www.voyageai.com)

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy the example env file and fill in your keys:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Used for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VOYAGE_API_KEY` | Yes | `voyage-3` embeddings for ingestion + RAG search |
| `GROQ_API_KEY` | Yes | Chat/generation, vision reading, and audio transcription |
| `NEXT_PUBLIC_SITE_URL` | No | Auth email-redirect base URL; defaults to `http://localhost:3000` |

### 3. Set up the database

In the Supabase SQL Editor, run every file in [`supabase/migrations/`](supabase/migrations) **in order** (`0001` → `0010`). Each is idempotent (`if not exists` / `or replace`), so re-running is safe.

This provisions:
- `courses`, `documents`, `document_chunks` (+ `pgvector` HNSW index and a `documents` storage bucket) — ingestion
- `study_artifacts`, `flashcards`, `quiz_attempts` — generated study material
- `reel_cards`, `concepts`, `concept_links`, `mastery_scores` — Study Reels + the concept graph
- `streaks` — daily streak / XP tracking
- `document_concepts` — exam predictor's per-document concept frequency
- `battle_sessions` — live head-to-head quiz mode
- `course_members`, `course_invites` — collaboration / shared course spaces

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On Windows, double-clicking [`run.bat`](run.bat) installs dependencies on first run, starts the dev server in its own window, and opens the browser automatically.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build (Turbopack) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Project structure

```
app/
  (marketing)/            landing page — GSAP/Lenis scrollytelling
  (app)/                  authenticated shell
    dashboard/            analytics
    library/               documents + artifact generation
    document/[id]/         split-view doc/media + AI panel
    chat/[courseId]/       RAG chat, tutor mode
    study/{summary,flashcards,quiz}/[id]/
    reels/[id]/            Study Reels player
    graph/[courseId]/      concept graph
    predict/[courseId]/    exam predictor
    battle/[id]/           live head-to-head quiz
    join/[id]/             course invite acceptance
  api/                     route handlers (documents, chat, artifacts, reels, battle, ...)
components/
  ui/                      shadcn primitives, re-skinned
  reels/ charts/ battle/ collab/ command/ document/ study/ chat/
  marketing/               landing sections (CSS Modules)
lib/
  ai/                      Groq + Voyage client wrappers, generation prompts
  ingest/                  type detection, extractors (pdf/docx/image/audio/note), chunking, pipeline
  study/                   artifact generation, mastery scoring, streaks, drill decks
  srs/                     SM-2 spaced-repetition scheduler
  supabase/                client/server/middleware Supabase clients
supabase/migrations/       numbered, idempotent SQL migrations (run in order)
```

## Deployment

Built to deploy on [Vercel](https://vercel.com) with Supabase as the backing database — set the same environment variables from the table above in your Vercel project settings, point them at your production Supabase project, and deploy.

## Status

Every module in [PLAN.md](PLAN.md) — including the originally-stretch goals (exam predictor, battle mode, collaboration) — is implemented; see PLAN.md for the original design brief, the six-phase build order, and design-language reference if you're extending it further.
