import JSZip from "jszip";
import type { ExtractedSegment } from "../types";

export async function extractPptx(buffer: Buffer): Promise<ExtractedSegment[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles: string[] = [];

  zip.forEach((relativePath) => {
    if (/^ppt\/slides\/slide\d+\.xml$/i.test(relativePath)) {
      slideFiles.push(relativePath);
    }
  });

  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] ?? "0", 10);
    const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] ?? "0", 10);
    return numA - numB;
  });

  const segments: ExtractedSegment[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const file = zip.file(slideFiles[i]);
    if (!file) continue;
    const xml = await file.async("text");

    const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) ?? [];
    const textPieces = matches
      .map((m) =>
        m
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim()
      )
      .filter(Boolean);

    const slideText = textPieces.join(" ").trim();
    if (slideText) {
      segments.push({
        text: `[Slide ${i + 1}]\n${slideText}`,
        pageRef: i + 1,
      });
    }
  }

  return segments;
}
