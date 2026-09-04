import Groq from "groq-sdk";
import { toFile } from "groq-sdk";
import { withRetry } from "./retry";

let client: Groq | null = null;

function getClient() {
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

interface VerboseTranscription {
  text: string;
  segments?: Array<{ text: string; start: number; end: number }>;
}

/** Transcribes audio/video (as audio) with segment-level timestamps for citations. */
export async function transcribeAudio(params: {
  buffer: Buffer;
  filename: string;
}): Promise<TranscriptSegment[]> {
  const groq = getClient();

  const file = await toFile(params.buffer, params.filename);

  const result = await withRetry(
    () =>
      groq.audio.transcriptions.create({
        file,
        model: "whisper-large-v3-turbo",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      }) as unknown as Promise<VerboseTranscription>,
    { label: "Groq (transcription)" },
  );

  if (result.segments?.length) {
    return result.segments.map((s) => ({ text: s.text.trim(), start: s.start, end: s.end }));
  }

  // Fallback: no segment timestamps came back — treat as one untimed chunk.
  return result.text ? [{ text: result.text.trim(), start: 0, end: 0 }] : [];
}

const VISION_PROMPT = `You are reading a page of engineering course material (a photo of handwritten notes, a diagram, a slide, or a scanned page).

Transcribe everything useful for a student studying this later:
- All legible text, verbatim.
- Any equations, written in plain-text/LaTeX-ish form (e.g. "F = m * a", "\\int_0^1 x^2 dx").
- A plain-language description of any diagram, circuit, graph, or figure — what it shows, labeled parts, and how they relate.
- Table contents, reproduced as a simple text table.

Output plain text only — no preamble, no "here is the transcription", just the content itself.`;

/** Reads a page image (handwriting, diagrams, slides) via Groq's free vision model. */
export async function describeImage(params: {
  base64: string;
  mediaType: string;
}): Promise<string> {
  const groq = getClient();

  const completion = await withRetry(
    () =>
      groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: VISION_PROMPT },
              {
                type: "image_url",
                image_url: { url: `data:${params.mediaType};base64,${params.base64}` },
              },
            ],
          },
        ],
      }),
    { label: "Groq (vision)" },
  );

  return completion.choices[0]?.message?.content?.trim() ?? "";
}
