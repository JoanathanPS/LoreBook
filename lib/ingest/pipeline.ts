import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText } from "./chunk";
import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  embedDocumentBatch,
  firstBatchSize,
} from "@/lib/ai/embeddings";
import { extractPdf } from "./extractors/pdf";
import { extractDocx } from "./extractors/docx";
import { extractPptx } from "./extractors/pptx";
import { extractImage } from "./extractors/image";
import { extractAudio } from "./extractors/audio";
import { extractNote } from "./extractors/note";
import { extractConcepts } from "@/lib/ai/generate";
import { linkDocumentConcepts } from "@/lib/study/mastery";
import type { ExtractedSegment, DocumentType } from "./types";

/**
 * Resumable ingestion, one bounded step per call.
 *
 * documents.stage drives a small state machine:
 *
 *   queued / extracting ── extract + chunk ──▶ embedding
 *   embedding ── embed ONE batch of NULL embeddings ──▶ embedding … ▶ enriching (status=ready)
 *   enriching ── concepts (best-effort, never blocks ready) ──▶ done
 *
 * Every step is idempotent, so the worker can crash at any point. The job is
 * then re-claimed and the same step runs again: extraction deletes partial
 * chunks first, and embedding only picks up rows that are still NULL.
 *
 * All steps take a service-role client; the worker owns the writes.
 */

export type IngestStage = "queued" | "extracting" | "embedding" | "enriching" | "done";

export interface StepResult {
  /** True when the job has nothing left to do. */
  done: boolean;
  stage: IngestStage;
}

/** Errors that will fail the same way on every retry (bad file, empty file). */
export class PermanentIngestError extends Error {
  override name = "PermanentIngestError";
}

/** Model identifier stored on each chunk, so a future model switch can backfill. */
export const EMBEDDING_MODEL_ID = `${EMBEDDING_MODEL.replace(/^models\//, "")}@${EMBEDDING_DIM}`;

// Progress budget: extraction shows as 0–5%, embedding fills 5–100%.
const EXTRACT_DONE_PROGRESS = 5;
// Chunks fetched per embed step. The token budget in embeddings.ts decides how
// many of these actually go into the single request.
const EMBED_FETCH_LIMIT = 100;
const INSERT_BATCH_SIZE = 200;
const ENRICH_CONTEXT_CHARS = 14_000;

interface DocRow {
  id: string;
  type: string;
  storage_path: string | null;
  title: string;
  user_id: string;
  course_id: string;
  status: string;
  stage: string | null;
  content_sha256: string | null;
}

export async function runIngestStep(admin: SupabaseClient, documentId: string): Promise<StepResult> {
  const { data: doc, error } = await admin
    .from("documents")
    .select("id, type, storage_path, title, user_id, course_id, status, stage, content_sha256")
    .eq("id", documentId)
    .single<DocRow>();
  if (error || !doc) throw new PermanentIngestError(error?.message ?? "Document not found");

  switch (doc.stage) {
    case "embedding":
      return embedStep(admin, doc);
    case "enriching":
      return enrichStep(admin, doc);
    case "done":
      return { done: true, stage: "done" };
    default:
      // null (legacy rows), "queued" or "extracting" (a crashed extraction).
      return extractStep(admin, doc);
  }
}

async function setDoc(admin: SupabaseClient, id: string, patch: Record<string, unknown>) {
  const { error } = await admin.from("documents").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update document: ${error.message}`);
}

// ---------------------------------------------------------------- extract

async function extractStep(admin: SupabaseClient, doc: DocRow): Promise<StepResult> {
  await setDoc(admin, doc.id, { status: "processing", stage: "extracting", progress: 1 });

  if (!doc.storage_path) throw new PermanentIngestError("Document has no storage_path");

  const { data: fileBlob, error: downloadError } = await admin.storage
    .from("documents")
    .download(doc.storage_path);
  if (downloadError || !fileBlob) {
    throw new Error(downloadError?.message ?? "Download from storage failed");
  }
  const buffer = Buffer.from(await fileBlob.arrayBuffer());

  // Dedupe: if this user already has a ready copy of the same bytes, reuse its
  // chunks and embeddings instead of extracting and embedding again.
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  if (doc.content_sha256 !== sha256) {
    await setDoc(admin, doc.id, { content_sha256: sha256 });
  }
  if (await tryCopyFromDuplicate(admin, doc, sha256)) {
    return { done: false, stage: "enriching" };
  }

  const filename = doc.storage_path.split("/").pop() ?? doc.title;
  const segments = await extractSegments(doc.type as DocumentType, buffer, filename);
  const chunkRows = segments.flatMap((segment) =>
    chunkText(segment.text).map((content) => ({
      content,
      page_ref: segment.pageRef ?? null,
      timestamp_ref: segment.timestampRef ?? null,
    })),
  );
  if (chunkRows.length === 0) {
    throw new PermanentIngestError("No extractable content found in this file.");
  }

  // Replace any chunks from an earlier (possibly partial) run.
  const { error: deleteError } = await admin.from("document_chunks").delete().eq("document_id", doc.id);
  if (deleteError) throw new Error(`Failed to replace existing chunks: ${deleteError.message}`);

  // Store every chunk. There is no cap any more: a long textbook just takes
  // more embed steps. Embeddings start NULL and are filled by embedStep.
  const rows = chunkRows.map((chunk, i) => ({
    document_id: doc.id,
    user_id: doc.user_id,
    chunk_index: i,
    content: chunk.content,
    embedding: null,
    page_ref: chunk.page_ref,
    timestamp_ref: chunk.timestamp_ref,
  }));
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const { error: insertError } = await admin
      .from("document_chunks")
      .insert(rows.slice(i, i + INSERT_BATCH_SIZE));
    if (insertError) throw new Error(`Failed to save chunks: ${insertError.message}`);
  }

  await setDoc(admin, doc.id, { stage: "embedding", progress: EXTRACT_DONE_PROGRESS });
  return { done: false, stage: "embedding" };
}

async function tryCopyFromDuplicate(admin: SupabaseClient, doc: DocRow, sha256: string): Promise<boolean> {
  const { data: source } = await admin
    .from("documents")
    .select("id")
    .eq("user_id", doc.user_id)
    .eq("content_sha256", sha256)
    .eq("status", "ready")
    .neq("id", doc.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!source) return false;

  // Only reuse a source whose chunks are all embedded with the current model.
  const [{ count: total }, { count: usable }] = await Promise.all([
    admin.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", source.id),
    admin
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", source.id)
      .not("embedding", "is", null),
  ]);
  if (!total || total !== usable) return false;

  const { data: copied, error } = await admin.rpc("copy_document_chunks", {
    p_source: source.id,
    p_target: doc.id,
  });
  if (error) throw new Error(`Failed to copy chunks from duplicate: ${error.message}`);
  if (!copied) return false;

  // Older rows may predate embedding_model; label copies with the current model.
  await admin
    .from("document_chunks")
    .update({ embedding_model: EMBEDDING_MODEL_ID })
    .eq("document_id", doc.id)
    .is("embedding_model", null);

  await setDoc(admin, doc.id, {
    status: "ready",
    stage: "enriching",
    progress: 100,
    error_message: null,
  });
  return true;
}

// ------------------------------------------------------------------ embed

async function embedStep(admin: SupabaseClient, doc: DocRow): Promise<StepResult> {
  const { data: pending, error } = await admin
    .from("document_chunks")
    .select("id, content")
    .eq("document_id", doc.id)
    .is("embedding", null)
    .order("chunk_index", { ascending: true })
    .limit(EMBED_FETCH_LIMIT);
  if (error) throw new Error(`Failed to load pending chunks: ${error.message}`);

  if (pending && pending.length > 0) {
    const batch = pending.slice(0, Math.max(1, firstBatchSize(pending.map((c) => c.content))));
    // One quick retry at most: a rate limit should hand the job back to the
    // queue (and continue next tick), not burn the function's time budget.
    const vectors = await embedDocumentBatch(
      batch.map((c) => c.content),
      { maxRetries: 1, maxWaitMs: 5_000 },
    );
    const { error: rpcError } = await admin.rpc("set_chunk_embeddings", {
      p_ids: batch.map((c) => c.id),
      p_embeddings: vectors.map((v) => `[${v.join(",")}]`),
      p_model: EMBEDDING_MODEL_ID,
    });
    if (rpcError) throw new Error(`Failed to save embeddings: ${rpcError.message}`);
  }

  const [{ count: total }, { count: remaining }] = await Promise.all([
    admin.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", doc.id),
    admin
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", doc.id)
      .is("embedding", null),
  ]);

  if (!total) {
    // Chunks vanished (e.g. deleted mid-run): start over from extraction.
    await setDoc(admin, doc.id, { stage: "extracting", progress: 0 });
    return { done: false, stage: "extracting" };
  }

  if (!remaining) {
    // Every chunk is searchable: the document is usable now. Enrichment
    // runs afterwards and never holds back `ready`.
    await setDoc(admin, doc.id, {
      status: "ready",
      stage: "enriching",
      progress: 100,
      error_message: null,
    });
    return { done: false, stage: "enriching" };
  }

  const embedded = total - remaining;
  const progress =
    EXTRACT_DONE_PROGRESS + Math.floor(((100 - EXTRACT_DONE_PROGRESS) * embedded) / total);
  await setDoc(admin, doc.id, { progress: Math.min(99, progress) });
  return { done: false, stage: "embedding" };
}

// ----------------------------------------------------------------- enrich

async function enrichStep(admin: SupabaseClient, doc: DocRow): Promise<StepResult> {
  // Concept tagging is an enrichment, not core to ingestion succeeding, so a
  // failure here is swallowed and the document stays ready.
  try {
    const { data: chunks } = await admin
      .from("document_chunks")
      .select("content")
      .eq("document_id", doc.id)
      .order("chunk_index", { ascending: true })
      .limit(20);
    const fullText = (chunks ?? [])
      .map((c) => c.content as string)
      .join("\n\n")
      .slice(0, ENRICH_CONTEXT_CHARS);
    if (fullText.trim()) {
      const concepts = await extractConcepts(fullText);
      await linkDocumentConcepts(admin, doc.user_id, doc.course_id, doc.id, concepts);
    }
  } catch (err) {
    console.warn("[ingest] concept enrichment failed (ignored):", err);
  }
  await setDoc(admin, doc.id, { stage: "done" });
  return { done: true, stage: "done" };
}

// ------------------------------------------------------------- extractors

async function extractSegments(
  type: DocumentType,
  buffer: Buffer,
  filename: string,
): Promise<ExtractedSegment[]> {
  switch (type) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "image":
      return extractImage(buffer, filename);
    case "audio":
    case "video":
      return extractAudio(buffer, filename);
    case "note":
      return extractNote(buffer);
    case "pptx":
      return extractPptx(buffer);
    default:
      throw new PermanentIngestError(`Unsupported document type: ${type}`);
  }
}

/** Messages from extractors that mean the file itself is the problem. */
export function isUserInputProcessingError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("appears corrupted") ||
    lower.includes("unsupported internal structure") ||
    lower.includes("no extractable content")
  );
}
