"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Deletes a document: its storage object, then the row (document_chunks
 * cascade via FK). Covers the "uploaded but never got chunked" stuck state —
 * the user can just remove it and re-upload rather than being stuck forever.
 * RLS (documents_owner_all) already restricts this to the uploader.
 */
export async function deleteDocument(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (doc?.storage_path) {
    await supabase.storage.from("documents").remove([doc.storage_path]);
  }

  await supabase.from("documents").delete().eq("id", documentId);
  revalidatePath("/library");
}

/** Re-runs ingestion for a document stuck in 'uploaded' or 'error' (e.g. a chunking failure). */
export async function retryDocumentProcessing(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { processDocument } = await import("@/lib/ingest/pipeline");
  try {
    await processDocument(documentId);
  } catch {
    // processDocument already persists status='error' + error_message.
  }
  revalidatePath("/library");
}
