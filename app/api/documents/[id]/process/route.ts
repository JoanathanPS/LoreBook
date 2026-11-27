import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enqueueDocument, workerConfigured } from "@/lib/ingest/enqueue";
import { kickIngest } from "@/lib/ingest/worker";

/**
 * Kept for compatibility: processing no longer runs inside this request.
 * It (re-)queues the document and returns 202 right away; the ingest worker
 * does the work and the client follows progress over Supabase Realtime.
 */
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    await enqueueDocument(supabase, id);
    if (workerConfigured()) {
      const origin = new URL(request.url).origin;
      after(() => kickIngest(id, origin));
    }
    return NextResponse.json({ status: "processing", stage: "queued" }, { status: 202 });
  } catch (err) {
    console.error("[documents/process] enqueue failed:", err);
    const message = err instanceof Error ? err.message : "Could not queue document";
    const status = /not allowed/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
