"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enqueueDocument } from "@/lib/ingest/enqueue";
import { triggerTick } from "@/lib/ingest/worker";

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

/**
 * Puts a document back on the ingest queue: for rows in 'uploaded' or
 * 'error', and for rows stuck in 'processing' (e.g. from before the queue
 * existed). The worker does the work; this returns right away.
 */
export async function retryDocumentProcessing(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    await enqueueDocument(supabase, documentId);
  } catch (err) {
    console.error("[retry] enqueue failed:", err);
    revalidatePath("/library");
    return;
  }

  // Server actions run under the page's time limit, so instead of working
  // in-process, ask the tick route (60s budget) to start on this document.
  const origin = await requestOrigin();
  if (origin) after(() => triggerTick(origin, 1, documentId));
  revalidatePath("/library");
}

async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
