import { transcribeAudio } from "@/lib/ai/groq";
import type { ExtractedSegment } from "../types";

/** Used for both `audio` and `video` document types — Whisper reads the audio track either way. */
export async function extractAudio(buffer: Buffer, filename: string): Promise<ExtractedSegment[]> {
  const segments = await transcribeAudio({ buffer, filename });
  return segments
    .filter((s) => s.text.length > 0)
    .map((s) => ({ text: s.text, timestampRef: s.start }));
}
