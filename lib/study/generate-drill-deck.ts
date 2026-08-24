import { createClient } from "@/lib/supabase/server";
import { getCourseContext } from "@/lib/ingest/context";
import { generateFlashcards } from "@/lib/ai/generate";
import { upsertConcepts } from "@/lib/study/mastery";

/** Exam Predictor: builds a flashcard deck targeting the given high-priority concepts. */
export async function generateDrillDeck(params: {
  courseId: string;
  courseName: string;
  focusConcepts: string[];
}): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: artifact, error: insertError } = await supabase
    .from("study_artifacts")
    .insert({
      course_id: params.courseId,
      user_id: user.id,
      kind: "flashcard_deck",
      title: `Exam drill deck — ${params.courseName}`,
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !artifact) throw new Error(insertError?.message ?? "Insert failed");

  try {
    const context = await getCourseContext(params.courseId);
    if (!context.trim()) throw new Error("No processed material to generate from yet.");

    const cards = await generateFlashcards(context, 15, params.focusConcepts);

    await supabase.from("flashcards").insert(
      cards.map((c) => ({
        deck_id: artifact.id,
        user_id: user.id,
        front: c.front,
        back: c.back,
      })),
    );

    await upsertConcepts(supabase, user.id, params.courseId, artifact.id, params.focusConcepts);

    await supabase
      .from("study_artifacts")
      .update({ content: { cardCount: cards.length, focusConcepts: params.focusConcepts }, status: "ready" })
      .eq("id", artifact.id);

    return artifact.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await supabase
      .from("study_artifacts")
      .update({ status: "error", error_message: message })
      .eq("id", artifact.id);
    throw err;
  }
}
