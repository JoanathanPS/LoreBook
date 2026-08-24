import { NextResponse } from "next/server";
import { generateReelArtifact } from "@/lib/study/generate-reel";

export async function POST(request: Request) {
  const { courseId, courseName, topic } = (await request.json()) as {
    courseId: string;
    courseName: string;
    topic?: string;
  };

  if (!courseId || !courseName) {
    return NextResponse.json({ error: "Missing courseId or courseName" }, { status: 400 });
  }

  try {
    const id = await generateReelArtifact({ courseId, courseName, topic });
    return NextResponse.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
