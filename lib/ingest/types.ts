export interface ExtractedSegment {
  text: string;
  pageRef?: number;
  timestampRef?: number;
}

export type DocumentType = "pdf" | "docx" | "pptx" | "image" | "audio" | "video" | "note";
