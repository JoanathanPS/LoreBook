import { createClient } from "@/lib/supabase/server";
import { getCourseContext } from "@/lib/ingest/context";
import { generateSummaryText, generateFlashcards, generateQuiz, extractConcepts } from "@/lib/ai/generate";
import { upsertConcepts } from "@/lib/study/mastery";

export type ArtifactKind = "summary" | "flashcard_deck" | "quiz" | "formula_sheet";

const TITLE_BY_KIND: Record<ArtifactKind, string> = {
  summary: "Summary",
  flashcard_deck: "Flashcards",
  quiz: "Quiz",
  formula_sheet: "Formula sheet",
};

/** Creates a study_artifacts row and fills it in — throws on failure after marking status='error'. */
export async function generateArtifact(params: {
  courseId: string;
  courseName: string;
  kind: ArtifactKind;
  documentId?: string;
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
      kind: params.kind,
      title: `${TITLE_BY_KIND[params.kind]} — ${params.courseName}`,
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !artifact) throw new Error(insertError?.message ?? "Insert failed");

  try {
    const context = await getCourseContext(params.courseId, params.documentId);
    if (!context.trim()) {
      throw new Error("No processed material to generate from yet — wait for uploads to finish.");
    }

    if (params.kind === "summary" || params.kind === "formula_sheet") {
      const text = await generateSummaryText(context, params.kind);
      await supabase
        .from("study_artifacts")
        .update({ content: { text }, status: "ready" })
        .eq("id", artifact.id);
    } else if (params.kind === "flashcard_deck") {
      const cards = await generateFlashcards(context);
      await supabase.from("flashcards").insert(
        cards.map((c) => ({
          deck_id: artifact.id,
          user_id: user.id,
          topic: c.topic,
          front: c.front,
          back: c.back,
        })),
      );
      await supabase
        .from("study_artifacts")
        .update({ content: { cardCount: cards.length }, status: "ready" })
        .eq("id", artifact.id);
    } else if (params.kind === "quiz") {
      const questions = await generateQuiz(context);
      await supabase
        .from("study_artifacts")
        .update({ content: { questions }, status: "ready" })
        .eq("id", artifact.id);
    }

    const concepts = await extractConcepts(context);
    await upsertConcepts(supabase, user.id, params.courseId, artifact.id, concepts);

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
