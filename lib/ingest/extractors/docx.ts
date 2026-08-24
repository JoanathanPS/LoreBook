import mammoth from "mammoth";
import type { ExtractedSegment } from "../types";

export async function extractDocx(buffer: Buffer): Promise<ExtractedSegment[]> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  return text ? [{ text }] : [];
}
