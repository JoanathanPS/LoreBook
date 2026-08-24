import { PDFParse } from "pdf-parse";
import type { ExtractedSegment } from "../types";

export async function extractPdf(buffer: Buffer): Promise<ExtractedSegment[]> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.pages
      .filter((page) => page.text.trim().length > 0)
      .map((page) => ({ text: page.text.trim(), pageRef: page.num }));
  } finally {
    await parser.destroy();
  }
}
