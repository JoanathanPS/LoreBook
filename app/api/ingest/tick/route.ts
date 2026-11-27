import { NextResponse, after } from "next/server";
import {
  MAX_CHAIN_DEPTH,
  isAuthorizedTick,
  runIngestTick,
  triggerTick,
} from "@/lib/ingest/worker";

/**
 * Ingest worker tick. Claims queued jobs and runs one bounded step each until
 * its time budget is spent (see lib/ingest/worker.ts).
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`. Vercel Cron sends this header
 * automatically when CRON_SECRET is set in the project's environment.
 *
 * Query params:
 *   background=1  answer 202 now and do the work in after() (used for chaining)
 *   chain=N       how many ticks have chained so far (stops at MAX_CHAIN_DEPTH)
 *   document=ID   work on that one document only
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (!isAuthorizedTick(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const background = url.searchParams.get("background") === "1";
  const depth = Math.max(0, Number(url.searchParams.get("chain")) || 0);
  const docParam = url.searchParams.get("document");
  const documentId = docParam && UUID_RE.test(docParam) ? docParam : undefined;
  const origin = url.origin;

  const work = async () => {
    const result = await runIngestTick({ documentId });
    // More work is due now: keep going in a fresh invocation instead of
    // waiting for the next cron run. The depth cap stops runaway chains.
    if (result.remaining && depth < MAX_CHAIN_DEPTH) {
      await triggerTick(origin, depth + 1);
    }
    return result;
  };

  if (background) {
    after(async () => {
      try {
        await work();
      } catch (err) {
        console.error("[ingest/tick] background tick failed:", err);
      }
    });
    return NextResponse.json({ accepted: true }, { status: 202 });
  }

  try {
    const result = await work();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ingest/tick] tick failed:", err);
    const message = err instanceof Error ? err.message : "Tick failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel Cron calls with GET; chained ticks and external pingers use POST.
export const GET = handle;
export const POST = handle;
