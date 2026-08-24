import { describeImage } from "@/lib/ai/groq";
import type { ExtractedSegment } from "../types";

const MIME_BY_EXT: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function extractImage(
  buffer: Buffer,
  filename: string,
): Promise<ExtractedSegment[]> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = MIME_BY_EXT[ext] ?? "image/jpeg";

  const text = await describeImage({ base64: buffer.toString("base64"), mediaType });
  return text.trim() ? [{ text: text.trim() }] : [];
}
