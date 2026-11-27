import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { QuizQuestion } from "@/lib/ai/generate";
import { recordActivity } from "@/lib/study/streaks";

export const maxDuration = 15;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { answers?: unknown } | null;
  const answers = body?.answers;
  if (!Array.isArray(answers) || !answers.every((a) => Number.isInteger(a))) {
    return NextResponse.json({ error: "Answer every question before submitting." }, { status: 400 });
  }

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

  const questions = (artifact.content as { questions?: QuizQuestion[] } | null)?.questions ?? [];
  if (questions.length === 0) {
    return NextResponse.json({ error: "This quiz has no questions." }, { status: 422 });
  }
  if (answers.length !== questions.length) {
    return NextResponse.json(
      { error: `Answer all ${questions.length} questions before submitting.` },
      { status: 400 },
    );
  }
  const correctCount = questions.reduce(
    (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
    0,
  );
  const score = correctCount / questions.length;

  const { error: insertError } = await supabase.from("quiz_attempts").insert({
    quiz_id: id,
    user_id: user.id,
    score,
    answers: { answers },
  });

  if (insertError) {
    console.error("quiz_attempts insert failed", insertError);
    return NextResponse.json(
      { error: "Your answers couldn't be saved. Please try again." },
      { status: 500 },
    );
  }

  // The attempt is saved; a streak hiccup shouldn't turn that into an error.
  try {
    await recordActivity(supabase, user.id, 10);
  } catch (err) {
    console.error("recordActivity failed", err);
  }

  return NextResponse.json({
    score,
    correctCount,
    total: questions.length,
    correctIndices: questions.map((q) => q.correctIndex),
  });
}
