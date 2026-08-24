import type { DocumentType } from "./types";

const EXT_MAP: Record<string, DocumentType> = {
  pdf: "pdf",
  docx: "docx",
  doc: "docx",
  pptx: "pptx",
  ppt: "pptx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  flac: "audio",
  mp4: "video",
  mov: "video",
  webm: "video",
  txt: "note",
  md: "note",
};

export function detectDocumentType(filename: string): DocumentType | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MAP[ext] ?? null;
}
