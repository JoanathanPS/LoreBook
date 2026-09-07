import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, title, type, storage_path, course_id, status")
    .eq("id", id)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  let signedUrl: string | null = null;
  if (doc.storage_path) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 3600);
    signedUrl = data?.signedUrl ?? null;
  }

  // Fetch chunks for slide viewing and document text preview
  const { data: chunks } = await supabase
    .from("document_chunks")
    .select("chunk_index, content, page_ref, timestamp_ref")
    .eq("document_id", id)
    .order("chunk_index", { ascending: true })
    .limit(100);

  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    type: doc.type,
    signedUrl,
    chunks: chunks ?? [],
  });
}

