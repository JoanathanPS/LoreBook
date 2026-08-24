import { createClient } from "@/lib/supabase/server";
import { chunkText } from "./chunk";
import { embedDocuments } from "@/lib/ai/embeddings";
import { extractPdf } from "./extractors/pdf";
import { extractDocx } from "./extractors/docx";
import { extractImage } from "./extractors/image";
import { extractAudio } from "./extractors/audio";
import { extractNote } from "./extractors/note";
import type { ExtractedSegment, DocumentType } from "./types";

export async function processDocument(documentId: string): Promise<void> {
  const supabase = await createClient();

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("id, type, storage_path, title, user_id")
    .eq("id", documentId)
    .single();

  if (docError || !doc) throw new Error(docError?.message ?? "Document not found");

  await supabase.from("documents").update({ status: "processing" }).eq("id", documentId);

  try {
    if (!doc.storage_path) throw new Error("Document has no storage_path");

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);
    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message ?? "Download from storage failed");
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const filename = doc.storage_path.split("/").pop() ?? doc.title;

    const segments = await extractSegments(doc.type as DocumentType, buffer, filename);
    if (segments.length === 0) {
      throw new Error("No extractable content found in this file.");
    }

    const chunkRows = segments.flatMap((segment) =>
      chunkText(segment.text).map((content) => ({
        content,
        page_ref: segment.pageRef ?? null,
        timestamp_ref: segment.timestampRef ?? null,
      })),
    );

    const embeddings = await embedDocuments(chunkRows.map((c) => c.content));

    const rows = chunkRows.map((chunk, i) => ({
      document_id: documentId,
      user_id: doc.user_id,
      chunk_index: i,
      content: chunk.content,
      embedding: embeddings[i],
      page_ref: chunk.page_ref,
      timestamp_ref: chunk.timestamp_ref,
    }));

    const { error: insertError } = await supabase.from("document_chunks").insert(rows);
    if (insertError) throw new Error(insertError.message);

    await supabase.from("documents").update({ status: "ready" }).eq("id", documentId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown processing error";
    await supabase
      .from("documents")
      .update({ status: "error", error_message: message })
      .eq("id", documentId);
    throw err;
  }
}

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
      throw new Error("PowerPoint extraction isn't implemented yet — try exporting to PDF.");
  }
}
