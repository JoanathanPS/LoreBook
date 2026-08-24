# Lorebook — AI-Powered Multimodal Research & Study Analysis for Engineering Students

*Revision 3 — final. Pushed from "solid capstone" to "the one people
screenshot," then closed the loop with a concrete design reference, the
actual build workflow to use with Claude Code, and copy-paste prompts for
every phase. Nothing left to plan — §10 is the starting gun.*

## 1. Product

A workspace where an engineering student dumps in whatever they're studying
from — PDFs/textbooks, lecture slides, lecture video/audio, photographed
handwritten notes, circuit/mechanism diagrams, datasheets, code — and the
app:

1. **Understands it** (text, tables, equations, diagrams, speech) and indexes it.
2. **Lets you talk to it** — chat scoped to a document/course, answers cite the exact
   page/timestamp/diagram they came from.
3. **Turns it into study material** — summaries, flashcards (spaced repetition),
   quizzes, formula sheets, cross-document **concept graph**, and swipeable
   **Study Reels** (see 2.4).
4. **Shows you where you stand** — mastery per topic, quiz trends, time spent,
   spaced-repetition queue, via a real analytics dashboard.
5. **Feels like a premium product**, not a student project — the kind of
   motion, polish, and pacing you'd expect from Linear, Arc, or Raycast,
   applied to a study tool nobody has bothered to make beautiful.

Final name: **Lorebook**.

## 2. Core Modules

| # | Module | What it does |
|---|--------|---------------|
| 1 | **Ingestion pipeline** | Upload PDF/DOCX/PPT/image/audio/video → extract text, tables, equations, diagrams; transcribe audio/video; OCR + vision-model reading of handwritten/diagram images. Chunk + embed for retrieval. |
| 2 | **Chat-over-corpus (RAG)** | Ask questions scoped to one doc, one course, or everything. Multimodal citations — click a citation, it scrolls the PDF to the page or seeks the video to the timestamp. Streams token-by-token. |
| 3 | **Study artifact generator** | One click → summary, flashcard deck, MCQ/short-answer quiz, or formula sheet for a topic. Flashcards feed a spaced-repetition scheduler (SM-2 style). |
| 4 | **Study Reels** ⭐ new | Any topic → a vertical, swipeable, auto-playing stack of bite-sized cards (concept → visual → one-line takeaway → recall check), narrated by TTS, IG-Stories-style progress bar, swipe up/down to move, tap to pause. This is the "vibecoded reel" energy applied to actual spaced learning. Full spec in §2a. |
| 5 | **Concept graph** | Force-directed graph (D3, later optionally R3F) linking concepts across all ingested material; node size = importance, color = mastery level; click a node → jump to every source passage that covers it. |
| 6 | **Analytics dashboard** | Study time, quiz accuracy trends, topic mastery heatmap, spaced-repetition due count, streaks/XP — D3 line/radar/heatmap charts in a bento-grid layout. |
| 7 | **Document workspace** | Split view: original doc/video on one side, AI panel (chat, notes, generated artifacts) on the other. Highlight text → floating "ask/explain/simplify" toolbar. |
| 8 | **AI Tutor mode** ⭐ new | Not just Q&A — a Socratic mode that asks *you* questions about the material instead of answering, plus optional live voice conversation (speak your question, hear the answer) for hands-free review while commuting/at the gym. |
| 9 | **3D explainers** (where it earns its keep) | R3F scenes for genuinely 3D subject matter — mechanisms, stress/strain, circuit topologies, molecular/crystal structures — not decoration for its own sake. |
| 10 | **Command palette (⌘K)** ⭐ new | Global fuzzy search + actions across every course/doc/concept, keyboard-navigable, the thing that makes power users trust a product is well built. |
| 11 | *(stretch)* **Exam predictor** | Feed past papers → model flags which concepts recur most / are overdue in your mastery scores → auto-builds a targeted drill deck. |
| 12 | *(stretch)* **Battle mode** | Two students, same course, live quiz head-to-head with a shared leaderboard — turns cramming into something social. |
| 13 | *(stretch)* Collaboration | Shared course spaces, shared decks, shared Reels. |

## 2a. Study Reels — the signature feature

This is the module worth building carefully, because it's the one that makes
the demo *feel* different from every other "AI study app."

**What it is:** pick a topic (or let the app pick your weakest one) → Claude
decomposes it into a sequence of 5–10 short "slides": a hook line, a core
idea stated in one sentence, a supporting visual (auto-generated diagram,
pulled figure from the source PDF, or a tiny R3F/Lottie animation for
physical concepts), and a one-tap recall check at the end of the sequence.

**Interaction model (Framer Motion, mobile-first even on desktop):**
- Full-bleed vertical card stack, `AnimatePresence` + drag gestures
  (`framer-motion`'s `useDragControls`) — swipe up = next, swipe down = back,
  matching TikTok/Reels physics (rubber-band resistance, velocity-based fling).
- IG-Stories-style segmented progress bar at the top, auto-advances on a
  timer synced to the TTS narration length; tap-and-hold pauses, tap left/
  right edge = prev/next, exactly like Stories.
- Each card transitions with a spring (`type: "spring", stiffness: 300,
  damping: 30`) plus a subtle scale/blur on the outgoing card so it reads as
  physical depth, not a slide change.
- Optional ambient audio narration (ElevenLabs or Web Speech API fallback)
  with a waveform scrubber; captions burned in for silent scrolling.
- Ends every deck with a 3-question rapid quiz card (same swipe gesture,
  swipe left = wrong, right = correct — Tinder-style) that writes straight
  into the mastery/spaced-repetition system, so "watching reels" is
  quietly also "doing spaced repetition."
- Shareable: export a single Reel as a portrait MP4/GIF (Remotion, or a
  simple canvas-capture) so students can send a concept explainer to a
  group chat — free marketing built into the product.

**Why this is the right kind of ambitious:** it reuses the exact same
pipeline as flashcards/summaries (same ingestion, same RAG, same concept
graph) — it's a new *presentation layer* on data you already have, not a new
subsystem. Low backend risk, maximum visual payoff.

## 3. Tech Stack & How Each Piece Is Used

- **Next.js 15 (App Router) + TypeScript + React** — the app itself. Server
  Components for data-heavy pages (dashboard, library), Client Components for
  anything interactive/animated.
- **Tailwind CSS** — layout, spacing, responsive grid, utility states. Not the
  place for bespoke visual identity.
- **CSS Modules** — the actual look: glass panels, gradient meshes, custom
  typographic treatments, per-component design flair. Tailwind builds the
  skeleton, CSS Modules give it a face.
- **shadcn/ui (as a base, heavily re-skinned)** — accessible primitives
  (dialog, popover, dropdown, tabs, command menu) so you're not hand-rolling
  focus traps and ARIA from scratch; every one gets a CSS-Modules skin so
  nothing looks stock.
- **GSAP + ScrollTrigger** — marketing/landing page: scroll-driven hero
  sequence, "how it works" scrollytelling, pinned sections, timeline
  reveals, SplitText character staggers for headlines. Not used inside the
  authenticated app (keeps interaction latency low there).
- **Lenis** (or GSAP ScrollSmoother) — buttery inertia scrolling on the
  landing page so GSAP scroll-triggers feel expensive, not janky.
- **Framer Motion (Motion)** — all in-app interaction: route/page transitions,
  modal/drawer open-close, flashcard flip (`layoutId` shared-element), Reels
  swipe stack, list reordering (`layout` + `Reorder`), hover/tap
  micro-feedback, skeleton→content crossfades. Respects
  `prefers-reduced-motion` globally via a single hook.
- **React Three Fiber + drei** — landing-page hero centerpiece (a floating,
  slowly-rotating knowledge-graph orb built from real node data, pointer-
  parallax), and the subject-specific 3D explainers in module 9. Kept out of
  the core study-loop UI so it never blocks someone trying to just read and
  quiz.
- **D3.js** — analytics charts and the concept-graph force simulation
  (`d3-force` computes positions, rendered as SVG/Canvas; can be lifted into
  R3F later for a literal 3D graph if it's worth the complexity).
- **Zustand** — light client state (active course, Reels playback position,
  command-palette open state) without dragging in Redux ceremony.
- **Vercel AI SDK** — streaming chat responses, tool-calling for citations,
  makes the "answer is typing in real time" feel free instead of hand-rolled
  SSE plumbing.
- **Remotion** *(for Study Reels export)* — programmatic MP4 generation from
  the same React components used to render a Reel on-screen, so "export as
  video" is nearly free once the Reel component exists.
- **Supabase** — Postgres (+ `pgvector` for embeddings) as the database, Auth,
  Realtime (for Battle mode / collab presence), and Storage for uploaded
  files. You already have Supabase MCP access, and it keeps you in a stack
  you've used before (same shape as the Clindex project).
- **LLM** — Claude (Anthropic) for note/summary/quiz/Reel-script generation
  and RAG chat, using its native vision input for diagrams/handwriting
  instead of a separate OCR pipeline where possible. Whisper (or a hosted
  STT) for audio/video transcription and voice-mode input; ElevenLabs (or
  Web Speech API as a free fallback) for Reel narration and voice-mode
  output.
- **next-pwa / Workbox** — installable, offline-capable shell so cached
  decks and Reels work with a flaky hostel wifi — a small addition that
  reads as serious engineering.
- **Deployment** — Vercel for the app, Supabase for data — both already
  available to you as MCP tools when you're ready to ship.

## 4. Data Model (sketch)

```
users
courses           (user_id, name)
documents         (course_id, type: pdf|video|audio|image|note, storage_path, status)
document_chunks   (document_id, text, embedding vector, page_ref | timestamp_ref)
concepts          (name, description, importance)
concept_links     (concept_id, chunk_id)          -- graph edges via shared source
study_artifacts   (document_id | course_id, kind: summary|flashcard_deck|quiz|formula_sheet|reel, content jsonb)
reel_cards        (reel_id, order, hook, body, visual_ref, narration_audio_url, duration_ms)
flashcards        (deck_id, front, back, ease, interval, due_at)
quiz_attempts     (quiz_id, user_id, score, answers jsonb, taken_at)
mastery_scores    (user_id, concept_id, score, updated_at)
streaks           (user_id, current_streak, longest_streak, xp, last_active_at)
battle_sessions   (course_id, host_id, guest_id, quiz_id, status, scores jsonb)   -- stretch
```

## 5. Folder Structure

```
app/
  (marketing)/              landing page route group — GSAP-heavy
    page.tsx
  (app)/                    authenticated shell
    dashboard/
    library/
    document/[id]/
    chat/[sessionId]/
    quiz/[id]/
    reels/[deckId]/         Study Reels player
    graph/
    battle/[sessionId]/     stretch
    settings/
  api/                      route handlers (upload, ingest, chat, generate, reels, tts)
components/
  ui/                       shadcn primitives, re-skinned
  motion/                   Framer Motion wrapper components (PageTransition, Reveal, Stagger)
  reels/                    ReelCard, ReelStack, ProgressBar, NarrationPlayer
  three/                    R3F scenes
  charts/                   D3 chart components
  marketing/                landing sections (CSS Modules for bespoke visuals)
  command/                  ⌘K palette
lib/
  ai/                       prompt templates, Claude/Whisper/TTS client wrappers
  db/                       Supabase client + typed queries
  rag/                      chunking, embedding, retrieval logic
  srs/                      spaced-repetition scheduling (SM-2)
  reels/                    topic → reel-script generation, pacing/timing logic
styles/
  globals.css               design tokens as CSS variables (consumed by Tailwind config + modules)
```

## 6. Design Direction — "premium SaaS template" language, made concrete

Reference points to steal *taste* from, not code, from: Linear, Arc browser,
Raycast, the Framer.com marketing site itself, Vercel's own site, Cron/Notion
Calendar, and **deck.co** (pulled from Godly as a concrete anchor — near-black
grid layout, an oversized architectural wordmark repeated as a visual
element in the footer, muted green/purple mesh gradients behind dark glass
cards, monospace code/JSON panels used as literal hero content, credential-
vault-style stacked list cards with tiny colored source icons). Lorebook
should land in that same register: swap deck.co's "connect any app" cards
for "connect any document," its credential vault for the concept graph
teaser, its code-response panel for a live RAG-chat snippet. What they all
share, made into rules:

- **Dark-mode-first**, deep graphite/near-black (`#0a0a0f`-ish) with a warm
  gradient-mesh backdrop that's animated *very* slowly (60s+ loop) behind
  glass panels — never static-flat, never busy.
- **One electric accent** (cyan or amber — pick one, use it *sparingly*:
  primary CTAs, active states, chart highlight, nothing else). Restraint is
  what makes it read premium instead of gamer-RGB.
- **Glassmorphism, precisely**: `backdrop-filter: blur(20px)` panels over the
  mesh gradient, a 1px semi-transparent border, never stacked more than two
  layers deep or it turns to mud.
- **Bento-grid layouts** for dashboard and landing "features" section —
  asymmetric card sizes, not a uniform grid — it's the single fastest way to
  make a layout look 2025-current instead of 2019-Bootstrap.
- **Grain/noise texture** (a tiny tiled SVG or CSS `filter: url(#noise)`) at
  ~3% opacity over the gradient mesh — kills banding, adds tactile
  "designed" feel for almost free.
- **Typography**: Geist or Inter for UI, a mono face (JetBrains Mono / Geist
  Mono) for code/formulas/citations. Large, confident headline sizes on
  marketing (`clamp()`-based fluid type), tight tracking on all-caps labels.
- **Motion language**:
  - GSAP tells a *story* on the marketing page — pinned scroll sections,
    SplitText headline reveals, a hero that responds to scroll position, not
    just fade-ins.
  - Framer Motion stays fast and quiet inside the app: page transitions
    <300ms, spring-based (not linear-eased) for anything that should feel
    physical (drag, flip, reorder), no scroll hijacking, `layoutId`
    shared-element transitions between list → detail views (a flashcard in
    a grid morphs into the open flashcard, not a hard cut).
  - Every interactive element gets a *micro*-interaction: buttons scale
    0.97 on tap, cards lift 2–4px with a soft shadow on hover, inputs get a
    focus-ring that animates in rather than snapping.
  - Skeleton loaders (shimmer, not spinners) for anything async — ingestion
    progress, chat streaming setup, dashboard chart load.
  - A **magnetic cursor** effect on the landing page's primary CTA (button
    subtly pulls toward the cursor within a radius) — small, cheap, reads
    expensive.
- **Sound design (optional, off by default)**: a few ultra-subtle UI sounds
  (card flip, correct/incorrect in quizzes, Reel swipe) — toggleable, muted
  by default, the kind of detail nobody expects from a student project.
- Tokens (`--color-*`, `--space-*`, `--radius-*`, `--ease-*`, `--shadow-*`)
  defined once in `globals.css`, referenced from `tailwind.config` *and* CSS
  Modules — one source of truth for both styling systems.
- Full `prefers-reduced-motion` pass: every GSAP/Framer animation has a
  static fallback, not just a shorter duration.

## 7. Build Order

1. **Scaffold** — `create-next-app` (TS, App Router, Tailwind), design tokens,
   base layout, Supabase Auth, landing page skeleton (no animation yet).
2. **Ingestion** — file upload → text/table/equation extraction (PDF), image
   OCR/vision reading, chunking + embeddings into `pgvector`.
3. **Document workspace + RAG chat** — viewer, chat scoped to a document,
   citations that jump to source location, streaming via Vercel AI SDK.
4. **Study artifacts** — summary/flashcard/quiz generation, spaced-repetition
   scheduler.
5. **Study Reels** — reel-script generation from existing chunks/concepts,
   ReelStack player component (Framer Motion drag + spring), TTS narration,
   swipe-to-answer recall check wired into mastery scores.
6. **Concept graph** — D3 force graph, mastery coloring, cross-doc linking.
7. **Analytics dashboard** — D3 charts + streaks/XP wired to real attempt/
   mastery data, bento-grid layout.
8. **Motion & visual pass** — GSAP landing sequence, gradient mesh + grain,
   Framer Motion micro-interactions across the whole app, ⌘K command
   palette, magnetic-cursor CTA, R3F hero + any subject-specific 3D
   explainers.
9. **Multimodal + voice expansion** — audio/video transcription with slide/
   timestamp sync, AI Tutor Socratic + voice mode, better handwriting/
   diagram understanding.
10. **PWA pass** — offline caching for decks/Reels, installable shell.
11. *(stretch)* **Exam predictor**, **Battle mode**, **Collaboration**.
12. **Polish** — accessibility pass (`design:accessibility-review` skill),
    perf (Lighthouse, especially around R3F/GSAP bundle weight), deploy to
    Vercel.

Each phase should land as a working, demoable slice — same pattern as your
ApexDrift capstone's phased commits. Recommended order-of-visible-payoff for
demo day if time gets tight: 1→2→3→4→**5 (Reels)**→8 (motion pass) before
6/7/9-12 — Reels + a polished motion pass is what makes the first 30 seconds
of the demo land.

## 9. Build Workflow — how to actually work with Claude Code on this

Don't hand Claude Code the whole plan and say "build it." Work phase by
phase (§7), and inside each phase run this loop:

1. **Reference** — before a new screen, spend 5–10 min on Godly/Podium/
   deck.co-style galleries, screenshot 2–3 things you like, describe the
   *specific* elements (spacing rhythm, type pairing, motion timing) in the
   prompt. Never say "make it look premium" — that's what produces the
   generic AI-slop look this plan is explicitly trying to avoid.
2. **Build** — shadcn/ui primitives skinned with CSS Modules, Tailwind for
   layout only, Framer Motion/GSAP per §3's split.
3. **Self-check** — after Claude Code writes a screen, have it actually look
   at what it built before you do:
   - If Playwright MCP is installed (see §10), tell it to navigate to the
     page, screenshot it, and check the screenshot against the description
     you gave — this closes the "code compiles" vs. "looks right" gap and
     is the single highest-leverage habit in this whole workflow.
   - Independently of Playwright, ask Claude Code to run the `design`
     plugin's design-critique skill and the `modern-web-guidance` skill
     against anything client-side (Modals/glassmorphism/scroll-driven
     animation/forms) — both are already available in your org's catalog,
     no install needed.
   - Run `design:accessibility-review` before calling any screen "done" —
     contrast, focus order, touch targets, reduced-motion fallback.
4. **Iterate**, don't regenerate — point at specific elements to fix rather
   than re-prompting the whole screen from scratch; keeps Claude Code from
   drifting off the established design tokens.

On third-party skills (the `WomenDefiningAI/claude-code-skills` repo, or
similar): read the skill file before installing it, same as you wouldn't
`curl | bash` a random script — some of them run background file watchers
or automate git/GitHub actions, which is real scope. Fine to use once
you've skimmed it; not something to install blind for a capstone deadline.

## 10. Getting Started — Claude Code setup & prompts

**Prerequisites / commands (run once, in your project folder):**

```bash
# 1. Claude Code CLI (skip if already installed)
npm install -g @anthropic-ai/claude-code

# 2. Scaffold Next.js (only if you haven't already)
npx create-next-app@latest lorebook --typescript --tailwind --app --eslint

cd lorebook

# 3. Recommended MCP additions (optional but high-leverage — run inside the project)
claude mcp add playwright               # lets Claude Code screenshot/inspect what it builds
# claude mcp add 21st-dev               # optional: searchable component library, skip until you feel the ceiling of shadcn alone

# 4. Start Claude Code in this folder
claude
```

The `design` and `modern-web-guidance` plugins/skills referenced throughout
this plan are already available in your Claude org — nothing to install for
those.

**Prompt 1 — orientation (paste first, every session):**
> Read PLAN.md in this repo before doing anything else. This is the spec
> for Lorebook, an AI-powered multimodal study app for engineering
> students. Confirm you've read §1–§10, then tell me which numbered phase
> in §7 (Build Order) we're on based on what currently exists in the repo.

**Prompt 2 — scaffold (Phase 1):**
> Implement Phase 1 from PLAN.md §7: base layout, design tokens from §6
> (colors, type, radius, spacing as CSS variables in globals.css, wired
> into tailwind.config), Supabase Auth, and a landing page *skeleton* only
> — no GSAP/motion yet, just correct structure and the dark/glass visual
> language from §6. Use shadcn/ui for primitives. Stop after this phase so
> I can review before we add animation.

**Prompt 3 — ingestion (Phase 2):**
> Implement Phase 2 from PLAN.md §7: file upload (PDF/DOCX/PPT/image/audio/
> video) to Supabase Storage, text/table/equation extraction for PDFs,
> vision-model reading for images/handwriting per §3's "LLM" notes,
> chunking + embeddings into pgvector per the schema in §4. Show me the
> upload → processing → "ready" status flow before moving on.

**Prompt 4 — document workspace + RAG chat (Phase 3):**
> Implement Phase 3: the split-view document workspace and RAG chat from
> module 2 in §2, streaming via the Vercel AI SDK, with citations that
> jump to the source page/timestamp. No motion polish yet — functional
> first.

**Prompt 5 — study artifacts (Phase 4):**
> Implement Phase 4: summary/flashcard/quiz/formula-sheet generation from
> module 3, and the SM-2 spaced-repetition scheduler from `lib/srs/`.

**Prompt 6 — Study Reels (Phase 5, the signature feature):**
> Implement Phase 5: Study Reels per §2a exactly — full-bleed vertical
> AnimatePresence card stack with drag gestures, IG-Stories-style segmented
> progress bar, spring transitions (stiffness 300 / damping 30), and the
> swipe-left/right recall check at the end wired into mastery_scores. Reuse
> existing chunks/concepts for script generation — don't build a new
> ingestion path. If Playwright MCP is available, record a screenshot
> sequence of the swipe interaction so I can see it before we move on.

**Prompt 7 — motion & visual pass (Phase 8, do this even if you skip 6/7/9 for time):**
> Implement Phase 8: the GSAP scroll-driven landing sequence with Lenis
> smooth scroll, gradient mesh + grain texture, the magnetic-cursor CTA,
> the ⌘K command palette, and a full pass of Framer Motion micro-
> interactions (button tap-scale, card hover-lift, skeleton shimmer,
> layoutId transitions) across every screen built so far, per §6's motion
> language. Respect prefers-reduced-motion everywhere. Then run the
> `design:design-critique` and `design:accessibility-review` skills against
> the result and fix what they flag.

**Prompt 8 — remaining phases:** repeat the same pattern — "Implement Phase
N from PLAN.md §7: [paste that phase's bullet]" — for the concept graph,
analytics dashboard, multimodal/voice expansion, PWA pass, and stretch
goals, in whatever order §7's "order of visible payoff" note suggests given
your remaining time before demo day.

## 11. Open Questions Before Scaffolding

- Which LLM/API keys do you already have available (Anthropic, Groq, OpenAI,
  ElevenLabs for TTS)?
- Solo build or team — does the module split above need to map to teammates?
- Any fixed engineering discipline to demo with (e.g. circuits for EEE,
  mechanisms for Mech), or should the demo corpus be general?
- Is a short exported Reel video (MP4/GIF) a nice-to-have or something you
  specifically want in the demo — it changes whether Remotion is worth the
  setup time now vs. later?
- Any hard constraint on 3D/animation bundle size (older laptop for the
  demo, spotty venue wifi) that should cap how heavy the R3F hero and
  gradient-mesh backgrounds are allowed to get?
