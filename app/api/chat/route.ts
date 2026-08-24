import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";
import { embedQuery } from "@/lib/ai/embeddings";

export const maxDuration = 60;

interface MatchedChunk {
  id: string;
  document_id: string;
  content: string;
  page_ref: number | null;
  timestamp_ref: number | null;
  document_title: string;
  similarity: number;
}

export interface ChatSource {
  index: number;
  documentId: string;
  documentTitle: string;
  pageRef: number | null;
  timestampRef: number | null;
}

export async function POST(request: Request) {
  const {
    messages,
    courseId,
    tutorMode,
  }: { messages: UIMessage[]; courseId: string; tutorMode?: boolean } = await request.json();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const queryText = lastUserMessage?.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join(" ") ?? "";

  let contextBlock = "No relevant material was found for this question.";
  let sources: ChatSource[] = [];

  if (queryText.trim()) {
    const queryEmbedding = await embedQuery(queryText);
    const { data } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_course_id: courseId,
      match_count: 8,
    });
    const matches = data as MatchedChunk[] | null;

    if (matches && matches.length > 0) {
      sources = matches.map((m, i) => ({
        index: i + 1,
        documentId: m.document_id,
        documentTitle: m.document_title,
        pageRef: m.page_ref,
        timestampRef: m.timestamp_ref,
      }));

      contextBlock = matches
        .map((m, i) => {
          const loc = m.page_ref
            ? `p. ${m.page_ref}`
            : m.timestamp_ref
              ? `${Math.floor(m.timestamp_ref / 60)}:${String(Math.floor(m.timestamp_ref % 60)).padStart(2, "0")}`
              : null;
          const citation = loc ? `${m.document_title}, ${loc}` : m.document_title;
          return `[${i + 1}] (${citation})\n${m.content}`;
        })
        .join("\n\n");
    }
  }

  const system = tutorMode
    ? `You are LoreBook's AI Tutor, running Socratic mode. Do NOT answer the student's question directly. Instead, using ONLY the course material excerpts below, ask ONE guiding question at a time that leads them toward the answer themselves — build on their previous responses, give a small hint if they're stuck twice in a row, and only confirm the full answer once they've clearly reasoned their way there.

Cite the excerpt numbers in brackets when a hint draws on specific material, e.g. "think about what happens to the surroundings here [1]."

Course material excerpts:
${contextBlock}`
    : `You are LoreBook's study assistant. Answer the student's question using ONLY the course material excerpts below — if the excerpts don't cover it, say so plainly instead of guessing.

Cite sources inline using the bracketed numbers from the excerpts, e.g. "Entropy always increases in irreversible processes [1]."

Course material excerpts:
${contextBlock}`;

  const result = streamText({
    model: groq("openai/gpt-oss-120b"),
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => (part.type === "finish" ? { sources } : undefined),
  });
}
