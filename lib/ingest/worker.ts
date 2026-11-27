import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmbeddingConfigError, EmbeddingRateLimitError } from "@/lib/ai/embeddings";
import { PermanentIngestError, isUserInputProcessingError, runIngestStep } from "./pipeline";

/**
 * Ingest worker: claims jobs from ingest_jobs and runs one bounded step per
 * claim, until the time budget is spent or the queue is empty.
 *
 * Called from:
 *  - /api/ingest/tick (Vercel Cron, or a pg_cron/pg_net ping, CRON_SECRET-protected)
 *  - next/server `after()` right after upload or retry, narrowed to that document
 *    so small files finish within seconds without waiting for the cron.
 */

interface IngestJob {
  id: string;
  document_id: string;
  attempts: number;
}

/** Consecutive failed/crashed steps before a job is marked as failed. */
const MAX_ATTEMPTS = 5;
/**
 * Stop claiming new steps after this long. A step itself can take a while
 * (a large PDF extraction or an audio transcription), so leave plenty of the
 * route's 60-second maxDuration for the last one.
 */
export const DEFAULT_BUDGET_MS = 30_000;
/** Self-chaining tick calls before handing back to the cron. */
export const MAX_CHAIN_DEPTH = 40;

export interface TickResult {
  steps: number;
  documents: string[];
  /** Runnable jobs are still waiting (worth chaining another tick). */
  remaining: boolean;
}

export async function runIngestTick(
  options: { documentId?: string; budgetMs?: number } = {},
): Promise<TickResult> {
  const admin = createAdminClient();
  const started = Date.now();
  const budget = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const documents = new Set<string>();
  let steps = 0;

  while (Date.now() - started < budget) {
    const { data, error } = await admin.rpc("claim_ingest_job", {
      p_document_id: options.documentId ?? null,
    });
    if (error) throw new Error(`claim_ingest_job failed: ${error.message}`);
    const job = (data as IngestJob[] | null)?.[0];
    if (!job) break;

    steps++;
    documents.add(job.document_id);
    await runOneStep(admin, job);
  }

  return { steps, documents: [...documents], remaining: await hasRunnableJobs(admin, options.documentId) };
}

async function runOneStep(admin: SupabaseClient, job: IngestJob): Promise<void> {
  try {
    const result = await runIngestStep(admin, job.document_id);
    await admin
      .from("ingest_jobs")
      .update({
        status: result.done ? "done" : "queued",
        attempts: 0,
        locked_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  } catch (err) {
    await handleStepError(admin, job, err);
  }
}

async function handleStepError(admin: SupabaseClient, job: IngestJob, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : "Unknown processing error";
  const now = Date.now();

  if (err instanceof EmbeddingRateLimitError) {
    // Not the document's fault: give back the attempt and try again later.
    const waitMs = Math.max(60_000, err.retryAfterMs ?? 0);
    await admin
      .from("ingest_jobs")
      .update({
        status: "queued",
        attempts: Math.max(0, job.attempts - 1),
        locked_at: null,
        run_after: new Date(now + waitMs).toISOString(),
        last_error: message,
        updated_at: new Date(now).toISOString(),
      })
      .eq("id", job.id);
    return;
  }

  const permanent =
    err instanceof PermanentIngestError ||
    err instanceof EmbeddingConfigError ||
    isUserInputProcessingError(message);

  if (permanent || job.attempts >= MAX_ATTEMPTS) {
    console.error(`[ingest] job ${job.id} failed:`, err);
    await admin
      .from("ingest_jobs")
      .update({
        status: "error",
        locked_at: null,
        last_error: message,
        updated_at: new Date(now).toISOString(),
      })
      .eq("id", job.id);
    await admin
      .from("documents")
      .update({ status: "error", error_message: message, stage: null })
      .eq("id", job.document_id);
    return;
  }

  console.warn(`[ingest] job ${job.id} step failed (attempt ${job.attempts}), will retry:`, message);
  await admin
    .from("ingest_jobs")
    .update({
      status: "queued",
      locked_at: null,
      run_after: new Date(now + 15_000 * job.attempts).toISOString(),
      last_error: message,
      updated_at: new Date(now).toISOString(),
    })
    .eq("id", job.id);
}

async function hasRunnableJobs(admin: SupabaseClient, documentId?: string): Promise<boolean> {
  let query = admin
    .from("ingest_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued")
    .lte("run_after", new Date().toISOString());
  if (documentId) query = query.eq("document_id", documentId);
  const { count } = await query;
  return (count ?? 0) > 0;
}

// --------------------------------------------------------------- triggering

/** Constant-time check of an `Authorization: Bearer <CRON_SECRET>` header. */
export function isAuthorizedTick(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !authHeader) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Asks the tick route to run another tick in its own invocation, so a long
 * document keeps moving without waiting for the next cron run. The route
 * answers 202 at once in background mode, so this only waits for that.
 */
export async function triggerTick(origin: string, depth: number, documentId?: string): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || depth > MAX_CHAIN_DEPTH) return;
  const params = new URLSearchParams({ background: "1", chain: String(depth) });
  if (documentId) params.set("document", documentId);
  try {
    await fetch(`${origin}/api/ingest/tick?${params}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (err) {
    // The cron picks the job up anyway.
    console.warn("[ingest] chained tick failed to start:", err);
  }
}

/**
 * Runs right after an upload or retry (inside `after()`): works on that one
 * document first, then chains a full tick if anything is left.
 */
export async function kickIngest(documentId: string, origin: string): Promise<void> {
  try {
    const result = await runIngestTick({ documentId });
    if (result.remaining) await triggerTick(origin, 1);
  } catch (err) {
    console.error("[ingest] post-upload kick failed:", err);
  }
}
