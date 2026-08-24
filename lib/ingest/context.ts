import { createClient } from "@/lib/supabase/server";

const MAX_CONTEXT_CHARS = 14000;

/** Concatenates chunk text for a course (or a single document within it) as generation context. */
export async function getCourseContext(
  courseId: string,
  documentId?: string,
): Promise<string> {
  const supabase = await createClient();

  let docQuery = supabase.from("documents").select("id, title").eq("course_id", courseId);
  if (documentId) docQuery = docQuery.eq("id", documentId);
  const { data: docs } = await docQuery;

  if (!docs || docs.length === 0) return "";

  const docIds = docs.map((d) => d.id);
  const titleById = new Map(docs.map((d) => [d.id, d.title]));

  const { data: chunks } = await supabase
    .from("document_chunks")
    .select("document_id, content, chunk_index")
    .in("document_id", docIds)
    .order("chunk_index", { ascending: true });

  if (!chunks || chunks.length === 0) return "";

  let out = "";
  let lastDoc: string | null = null;
  for (const chunk of chunks) {
    if (chunk.document_id !== lastDoc) {
      out += `\n\n### ${titleById.get(chunk.document_id) ?? "Untitled"}\n`;
      lastDoc = chunk.document_id;
    }
    out += `${chunk.content}\n`;
    if (out.length > MAX_CONTEXT_CHARS) break;
  }

  return out.slice(0, MAX_CONTEXT_CHARS).trim();
}
