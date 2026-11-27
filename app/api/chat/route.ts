import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@/lib/supabase/server";
import { embedQuery } from "@/lib/ai/embeddings";

export const maxDuration = 60;

/**
 * How many trailing UI messages (user + assistant) are sent to the model.
 * Older turns cost prompt tokens and time-to-first-token without helping:
 * each answer is grounded in freshly retrieved excerpts anyway.
 */
const MAX_HISTORY_MESSAGES = 12;

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
  // getClaims verifies the JWT locally (cached JWKS) instead of a round trip
  // to Supabase Auth; still a verified identity, and RLS enforces the rest.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return new Response("Not authenticated", { status: 401 });

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const queryText = lastUserMessage?.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join(" ") ?? "";

  const isGreeting =
    /^(hi|hello|hey|hey there|greetings|good morning|good afternoon|good evening|howdy|sup|thanks|thank you|ok|okay|bye|goodbye|who are you|what can you do)[!.?]*$/i.test(
      queryText.trim(),
    );

  // Persist the user's turn without blocking the stream. onFinish awaits it
  // so the assistant row is always written after the user row.
  const userInsert: Promise<void> = queryText.trim()
    ? Promise.resolve(
        supabase.from("chat_messages").insert({
          course_id: courseId,
          user_id: userId,
          role: "user",
          content: queryText,
          metadata: {},
        }),
      ).then(
        ({ error }) => {
          if (error) console.error("[chat] failed to save user message:", error.message);
        },
        (err: unknown) => console.error("[chat] failed to save user message:", err),
      )
    : Promise.resolve();

  // Retrieval and message conversion are independent; run them together.
  const retrieval: Promise<MatchedChunk[] | null> =
    queryText.trim() && !isGreeting
      ? embedQuery(queryText)
          .then((queryEmbedding) =>
            supabase.rpc("match_document_chunks", {
              query_embedding: queryEmbedding,
              match_course_id: courseId,
              match_count: 8,
            }),
          )
          .then(({ data, error }) => {
            if (error) console.error("[chat] retrieval failed:", error.message);
            return (data as MatchedChunk[] | null) ?? null;
          })
      : Promise.resolve(null);

  const [matches, modelMessages] = await Promise.all([
    retrieval,
    convertToModelMessages(messages.slice(-MAX_HISTORY_MESSAGES)),
  ]);

  let contextBlock = "No relevant material was found for this question.";
  let sources: ChatSource[] = [];

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

  // The chat bubble renders through SimpleMarkdown/MathTex (KaTeX), which
  // only picks up math wrapped in \( \) / \[ \] — anything else prints as
  // literal text, so every branch below must ask for these delimiters.
  const mathRule =
    'For any math — formulas, equations, single variables/symbols like "θ" or "x_i" — wrap it in LaTeX delimiters: \\( ... \\) for inline math, \\[ ... \\] for a standalone equation on its own line. Never write bare LaTeX commands (e.g. \\bigl, \\frac, subscripts) outside these delimiters.';

  const system = isGreeting
    ? `You are LoreBook's study assistant. Greet the student warmly and ask how you can help with their studies. Do not add any citation numbers.`
    : tutorMode
      ? `You are LoreBook's AI Tutor, running Socratic mode. This is a hard rule that overrides your normal instinct to be helpful by answering directly: you are FORBIDDEN from stating the answer to the student's question in your first reply to it, no matter how simple or directly they ask, and no matter what phrasing they use ("just tell me", "what is X", "explain Y").

Every reply you send must end in a question mark. Using ONLY the course material excerpts below, ask ONE guiding question that leads the student toward the answer themselves. Build on their previous responses. If they get it wrong or seem stuck twice in a row, give one small hint (still as part of a question) rather than the answer. Only state the full answer once they've clearly reasoned their way to it themselves, and even then, ask if they'd like you to confirm it first.

Keep the questioning going turn after turn — after they answer one question, ask the next one on a related or deeper point, rather than stopping. Only break this pattern (answer directly, stop quizzing) if the student explicitly says something like "just tell me", "stop asking questions", "no more quizzing", or similar — otherwise always end your turn with another question.

If this is the very first message and it's a generic prompt to start (e.g. "quiz me", "start tutoring me"), pick one concrete concept from the excerpts yourself and open with a question about it — don't ask the student what they want to study.

Cite the excerpt numbers in brackets ONLY when drawing on specific material, e.g. "think about what happens to the surroundings here [1] — what does that do to total entropy?"

${mathRule}

Course material excerpts:
${contextBlock}`
      : `You are LoreBook's study assistant. Answer the student's question using ONLY the course material excerpts below — if the excerpts don't cover it, say so plainly instead of guessing.

Cite sources inline using the bracketed numbers from the excerpts ONLY when directly referencing that excerpt, e.g. "Entropy always increases in irreversible processes [1]." Do not invent or include citations for general statements.

${mathRule}

Course material excerpts:
${contextBlock}`;

  const result = streamText({
    model: groq("openai/gpt-oss-120b"),
    system,
    messages: modelMessages,
    onFinish: async ({ text }) => {
      await userInsert;
      if (text) {
        // Only save citations that were actually referenced in the response text
        const citedNumbers = new Set(
          [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])),
        );
        const usedSources = sources.filter((s) => citedNumbers.has(s.index));

        const { error } = await supabase.from("chat_messages").insert({
          course_id: courseId,
          user_id: userId,
          role: "assistant",
          content: text,
          metadata: { sources: usedSources },
        });
        if (error) console.error("[chat] failed to save assistant message:", error.message);
      }
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => (part.type === "finish" ? { sources } : undefined),
  });
}
