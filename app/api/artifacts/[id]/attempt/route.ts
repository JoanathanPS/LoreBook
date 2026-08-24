import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { QuizQuestion } from "@/lib/ai/generate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { answers } = (await request.json()) as { answers: number[] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: artifact, error } = await supabase
    .from("study_artifacts")
    .select("content")
    .eq("id", id)
    .eq("kind", "quiz")
    .single();

  if (error || !artifact) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const questions = (artifact.content as { questions: QuizQuestion[] }).questions;
  const correctCount = questions.reduce(
    (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
    0,
  );
  const score = questions.length > 0 ? correctCount / questions.length : 0;

  await supabase.from("quiz_attempts").insert({
    quiz_id: id,
    user_id: user.id,
    score,
    answers: { answers },
  });

  return NextResponse.json({
    score,
    correctCount,
    total: questions.length,
    correctIndices: questions.map((q) => q.correctIndex),
  });
}
