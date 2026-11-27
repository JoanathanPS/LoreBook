import { createClient } from "@/lib/supabase/server";

const MAX_CONTEXT_CHARS = 14000;
/** Most recent documents considered for course-wide context. */
const MAX_DOCUMENTS = 12;
/** Chunks are ~1.8k chars (lib/ingest/chunk.ts), so 8 covers the budget for one document. */
const MAX_CHUNKS_PER_DOCUMENT = 8;
const MIN_CHUNKS_PER_DOCUMENT = 2;
const APPROX_CHUNK_CHARS = 1800;

/**
 * Builds generation context for a course (or a single document within it).
 *
 * Fetches only the first few chunks of each document — sized so the total
 * roughly fills MAX_CONTEXT_CHARS — instead of every chunk in the course,
 * then shares the character budget across documents so one long PDF can't
 * crowd out the rest. Each document's `### title` header appears once.
 */
export async function getCourseContext(
  courseId: string,
  documentId?: string,
): Promise<string> {
  const supabase = await createClient();

  let docQuery = supabase
    .from("documents")
    .select("id, title")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(MAX_DOCUMENTS);
  if (documentId) docQuery = docQuery.eq("id", documentId);
  const { data: docs } = await docQuery;

  if (!docs || docs.length === 0) return "";

  const targetChunks = Math.ceil(MAX_CONTEXT_CHARS / APPROX_CHUNK_CHARS) + 1;
  const perDocLimit = Math.min(
    MAX_CHUNKS_PER_DOCUMENT,
    Math.max(MIN_CHUNKS_PER_DOCUMENT, Math.ceil(targetChunks / docs.length)),
  );

  const perDoc = await Promise.all(
    docs.map(async (doc) => {
      const { data } = await supabase
        .from("document_chunks")
        .select("content")
        .eq("document_id", doc.id)
        .order("chunk_index", { ascending: true })
        .limit(perDocLimit);
      return { title: doc.title ?? "Untitled", chunks: (data ?? []).map((c) => c.content as string) };
    }),
  );

  const withText = perDoc.filter((d) => d.chunks.length > 0);
  if (withText.length === 0) return "";

  // Split the budget evenly; budget a short document leaves unused rolls
  // over to the documents after it.
  const sections: string[] = [];
  let remaining = MAX_CONTEXT_CHARS;
  withText.forEach((doc, i) => {
    const share = Math.floor(remaining / (withText.length - i));
    const header = `### ${doc.title}\n`;
    let body = "";
    for (const chunk of doc.chunks) {
      if (header.length + body.length >= share) break;
      body += `${chunk}\n`;
    }
    const section = (header + body).slice(0, share).trimEnd();
    sections.push(section);
    remaining -= section.length + 2;
  });

  return sections.join("\n\n").slice(0, MAX_CONTEXT_CHARS).trim();
}
