# LoreBook revival plan

Written 2026-11-27 from a code audit plus production logs. Every claim below has a file reference so it can be checked.

## Where it actually stands

People give up on LoreBook for three reasons, in this order:

1. **Uploads fail in production.** `GEMINI_API_KEY` is not set on Vercel, so the embedding code quietly switched to Voyage. Voyage returns 1024-dim vectors, and the database column is `vector(768)`, so every upload ended in `expected 768 dimensions, not 1024`. Because nothing gets chunked, chat, quizzes, flashcards, reels and the exam predictor all fail after that.
2. **Everything is synchronous and slow.** Every AI step runs inside a single HTTP request: processing a document, generating artifacts, the mind map. There are no loading states (no `loading.tsx` or `<Suspense>` anywhere). Prefetch is turned off in 13 places, and a service worker caches every request.
3. **The mini-features are half-wired.** Battle against a non-member scores 0. Joining a course ignores the invite. Image upload falls back to a decommissioned Groq model. Jobs that get killed stay "generating" forever.

The core idea is good: cited answers over your own material, turned into practice. What breaks trust is the plumbing.

---

## Phase 0: stop the bleeding (this week)

| # | Fix | Status |
|---|-----|--------|
| 0.1 | Make the embedding provider single-model with a hard dimension check, so it can never silently fall back to another model (`lib/ai/embeddings.ts`) | **Done** |
| 0.2 | Pack batches by token budget, use `taskType` RETRIEVAL_DOCUMENT/QUERY, send the key in a header instead of the URL, and fail fast so it stays inside the function timeout | **Done** |
| 0.3 | Long documents: keep an even spread of chunks instead of the first 40 only; the cap is set by `MAX_CHUNKS_PER_DOC` (default 60) | **Done** |
| 0.4 | Mark a document `ready` before the optional concept tagging runs | **Done** |
| 0.5 | Return 503 with a clear message for config and quota errors, instead of a raw 500 | **Done** |
| 0.6 | Hero CTA jitter: the magnetic effect moved the element it was measuring | **Done** |
| 0.7 | **You:** create a new key at aistudio.google.com/apikey (the local key returns 403 PERMISSION_DENIED), add it to Vercel as `GEMINI_API_KEY` for Production and Preview, then redeploy | Todo |
| 0.8 | Remove `VOYAGE_API_KEY` from Vercel; nothing uses it now | Todo |
| 0.9 | Re-process documents that are stuck in `error` | Todo |

## Phase 1: the ingestion engine that can take real load (1–2 weeks)

The current model is "browser waits on one 300-second request". That can't scale, and on Vercel Hobby it is capped at 60 seconds unless Fluid compute is on.

**Target design: a resumable job queue in Postgres.**

```
upload → documents(status=queued) → jobs table
   worker (Vercel Cron every minute, or a Supabase Edge Function on a pg_net trigger)
     ├─ claim job  (SELECT … FOR UPDATE SKIP LOCKED)
     ├─ extract    → store segments
     ├─ chunk      → document_chunks rows with embedding NULL
     ├─ embed      → fill rows with NULL embeddings, one batch per tick, resumable
     └─ enrich     → concepts (optional; never blocks ready)
   UI ← Supabase Realtime on documents.status + progress %
```

- Each tick does a bounded amount of work, so a timeout costs at most one batch, never the whole document.
- Rate limits turn into "it continues next minute" instead of a failure. Drop the 60-chunk cap: large textbooks just take longer.
- Add `progress` (0–100) and `stage` columns, and show a real progress bar.
- A row stuck in `processing` for more than 10 minutes gets re-queued automatically (today it is stuck until the user deletes it).
- **Dedupe by file hash.** When 40 students upload the same lecture PDF, embed it once and share the chunks. This is the biggest cost and quota win, and the shared library it creates is the base for the product idea below.

**Embedding capacity: pick one model and stay on it.**

| Option | Dims | Cost | Limits | Verdict |
|---|---|---|---|---|
| Gemini `gemini-embedding-001`, free tier | 768 | $0 | Low per-minute token quota | Fine for a demo; the queue absorbs the limits |
| Gemini, paid tier with a billing cap | 768 | Low per-token price (check current Google pricing); a 50-page PDF costs a fraction of a cent | High | **Recommended for launch.** No migration needed |
| Supabase built-in `gte-small` (Edge Function `Supabase.ai`) | 384 | $0 | Edge CPU only | A real zero-cost option, but needs a migration to 384 dims and lower-quality retrieval |

Changing models means re-embedding everything, so add an `embedding_model` column now. A future switch can then run as a background backfill.

**Quality fixes found in the audit**

- `getCourseContext` loads every chunk in the course to use 14k characters, and it interleaves documents (`lib/ingest/context.ts:21`). Use retrieval or a per-document limit instead.
- Concepts explore runs `textSearch` across all courses with no index (`app/api/concepts/explore/route.ts:111`).
- The mind map links every document to every concept (`lib/study/generate-course-curriculum.ts:233`), which makes the exam predictor meaningless.
- Images: replace the dead Groq vision fallback (`lib/ai/groq.ts:113`).
- Audio: check the 25 MB Whisper limit before uploading, and drop `.mov`, `.doc` and `.ppt` from accepted types until they are handled.

## Phase 2: make it feel fast (1 week)

ChatGPT feels fast because something appears within about 300 ms. The audit found:

1. **Add `loading.tsx` skeletons** to every route under `app/(app)/`. This is the biggest perceived-speed win for the least work.
2. **Re-enable link prefetch** (remove the 13 `prefetch={false}`).
3. **Fix the service worker.** It caches every GET, including RSC payloads (`public/sw.js:46`). Limit it to static assets, or remove it.
4. **Middleware:** use `auth.getClaims()` (verified locally with JWT signing keys) instead of `getUser()`, which is a network round trip on every request including API calls.
5. **Parallelize the waterfalls** in predict, graph, flashcards, battle, join and document pages with `Promise.all`.
6. **Chat time-to-first-token:** start the stream first, write the user message without awaiting it, send only the last N turns, and cache query embeddings.
7. **Code-split** d3/xyflow (`ConceptGraph`), cmdk and KaTeX CSS with `next/dynamic`. Remove the unused `three` and `@react-three/*` deps.
8. Move every generation route (artifacts, reels, mind map, regenerate) onto the Phase 1 job queue. Return immediately, then stream status over Realtime. Nothing should be left "generating forever".

Target: route transitions under 200 ms to the skeleton, chat first token under 1.5 s, and an upload showing progress within 2 s.

## Phase 3: fix or cut the mini-features (1 week)

Rule: **a feature that half-works costs more trust than a missing one.** Fix these in this order, and hide anything not fixed behind a flag.

| Feature | Problem | Fix |
|---|---|---|
| Battle | Guests can't read the quiz (RLS), so they score 0; scores use a racy client read-modify-write | A security-definer RPC to fetch battle questions; atomic score update in SQL |
| Collab join | `joinCourse` ignores the invite token, so anyone with a course UUID can join | Validate the invite (expiry and uses) in an RPC |
| Quiz attempts | Insert errors are ignored and the UI shows `undefined` | Check errors and surface a retry |
| Chat history | Loads the *oldest* 100 messages | Order descending, limit, then reverse |
| Delete account | Leaves storage files behind, and reports success even when the auth user still exists | Run it server-side with a service role, and be honest about failures |
| Command palette | Data is fetched once and stale | Refetch on open |

## Phase 4: visual direction

Keep the identity you already have: the cream and oxblood "book" palette, serif type and the gilt eyebrow. It is distinctive, and most AI study tools are purple-gradient SaaS. Commit to the metaphor fully:

- **The app is a book you are writing by studying.** Each course is a volume and each concept is a page. Pages start as pencil sketches (light, sparse) and get "inked" as mastery rises, so the concept map turns into a table of contents filling in.
- **Citations as marginalia.** Answers show sources as margin notes with page or timestamp, not footer chips. This is the visual signature, and it makes trust visible.
- **Motion budget:** keep Lenis and GSAP on the marketing page only. Inside the app, use only 150–200 ms opacity and transform transitions. Speed is the aesthetic.
- **One primary action per screen.** The library page should be "drop a file", the course page "ask or practise", nothing else competing.

## Phase 5: the idea that makes it different

Everyone has "chat with your PDF". What nobody does well: **a course's shared, cited "Lore" that the whole class builds and that grades your actual answers.**

1. **Shared course lore.** Students in the same course section (joined by code or class email domain) feed one shared, deduped library. One student uploads the slides, so 60 students have them. The same file-hash dedupe from Phase 1 makes this nearly free to run. This is the growth loop: every upload is an invite.
2. **Answer-photo grading against your own syllabus.** Take a photo of a handwritten answer to a past-paper question, and LoreBook marks it step by step. It cites the exact lecture slide each mark comes from and shows what the professor's own notes say you missed. The parts already exist (image extraction, retrieval, past papers flagged `is_exam_paper`, the predictor); this joins them into the one feature students will screenshot and share.
3. **Exam-week mode.** Given the exam date, the predictor ranks topics and schedules SM-2 reviews backward from that date. You already have `lib/srs/sm2.ts` and the predictor; this connects them into a daily plan.

Pitch: *"Your class's notes become one living book that cites itself and grades your answers like your professor would."*

## Phase 6: launch readiness

- Observability: Sentry or Vercel Observability on API routes, plus a `jobs` admin view.
- Per-user quotas (uploads per day, generations per hour) so one user can't burn the shared AI quota.
- Load test: a script that uploads 200 mixed documents through the queue and asserts every one reaches `ready`. Run it before each release.
- Playwright smoke tests: sign up, upload, chat, quiz, flashcards.
- Legal basics: privacy policy, data deletion that actually deletes (see Delete account above), and a copyright stance for shared course material.
- Distribution: start with one department at your college and use shared course lore as the hook. Measure the share of uploads that turn into 3 or more classmates using the course.

## Suggested order

Week 1: Phase 0 and the job queue. Week 2: Phase 2 speed work. Week 3: Phase 3, cutting anything that isn't fixed. Weeks 4–5: shared lore and answer grading. Week 6: hardening and a pilot with one class.
