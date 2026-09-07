import { NextResponse } from "next/server";
import { generateCourseCurriculum } from "@/lib/study/generate-course-curriculum";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;

  if (!courseId) {
    return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  }

  try {
    const result = await generateCourseCurriculum(courseId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to generate course curriculum mindmap:", err);
    const message = err instanceof Error ? err.message : "Failed to generate knowledge map";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
