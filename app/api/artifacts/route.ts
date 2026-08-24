import { NextResponse } from "next/server";
import { generateArtifact, type ArtifactKind } from "@/lib/study/generate-artifact";

export async function POST(request: Request) {
  const body = await request.json();
  const { courseId, courseName, kind, documentId } = body as {
    courseId: string;
    courseName: string;
    kind: ArtifactKind;
    documentId?: string;
  };

  if (!courseId || !courseName || !kind) {
    return NextResponse.json({ error: "Missing courseId, courseName, or kind" }, { status: 400 });
  }

  try {
    const id = await generateArtifact({ courseId, courseName, kind, documentId });
    return NextResponse.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
