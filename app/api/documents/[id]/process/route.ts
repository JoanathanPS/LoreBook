import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Document extraction + embedding can exceed the default route budget,
// especially on larger files and free-tier model retries.
export const maxDuration = 300;
export const runtime = "nodejs";

function isUserInputProcessingError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("appears corrupted") ||
    lower.includes("unsupported internal structure") ||
    lower.includes("no extractable content")
  );
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const { processDocument } = await import("@/lib/ingest/pipeline");

    await processDocument(id);
    return NextResponse.json({ status: "ready" });
  } catch (err) {
    console.error("[documents/process] fatal error:", err);
    const message = err instanceof Error ? err.message : "Processing failed";
    const status = isUserInputProcessingError(message) ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
