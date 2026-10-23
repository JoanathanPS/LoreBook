import pdfParse from "pdf-parse";
import type { ExtractedSegment } from "../types";

export async function extractPdf(buffer: Buffer): Promise<ExtractedSegment[]> {
  try {
    const result = await pdfParse(buffer);
    const text = result.text.trim();
    return text ? [{ text }] : [];
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();

    if (
      lower.includes("bad xref entry") ||
      lower.includes("formaterror") ||
      lower.includes("invalidpdf") ||
      lower.includes("invalid pdf")
    ) {
      throw new Error(
        "This PDF appears corrupted or uses an unsupported internal structure (bad cross-reference table). Please re-save or print it as a new PDF, then upload again.",
      );
    }

    throw new Error(`Failed to extract PDF text: ${raw}`);
  }
}
