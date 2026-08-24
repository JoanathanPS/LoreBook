import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processDocument } from "@/lib/ingest/pipeline";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  try {
    await processDocument(id);
    return NextResponse.json({ status: "ready" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
