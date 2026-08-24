import type { ExtractedSegment } from "../types";

/** Plain text / markdown uploads — no OCR or transcription needed. */
export function extractNote(buffer: Buffer): ExtractedSegment[] {
  const text = buffer.toString("utf-8").trim();
  return text ? [{ text }] : [];
}
