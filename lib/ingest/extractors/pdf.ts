import pdfParse from "pdf-parse";
import type { ExtractedSegment } from "../types";

export async function extractPdf(buffer: Buffer): Promise<ExtractedSegment[]> {
  const result = await pdfParse(buffer);
  const text = result.text.trim();
  return text ? [{ text }] : [];
}
