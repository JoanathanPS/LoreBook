import { NextResponse } from "next/server";
import { generateDrillDeck } from "@/lib/study/generate-drill-deck";

export async function POST(request: Request) {
  const { courseId, courseName, focusConcepts } = (await request.json()) as {
    courseId: string;
    courseName: string;
    focusConcepts: string[];
  };

  if (!courseId || !courseName || !focusConcepts?.length) {
    return NextResponse.json({ error: "Missing courseId, courseName, or focusConcepts" }, { status: 400 });
  }

  try {
    const id = await generateDrillDeck({ courseId, courseName, focusConcepts });
    return NextResponse.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
