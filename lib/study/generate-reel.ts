import { createClient } from "@/lib/supabase/server";
import { getCourseContext } from "@/lib/ingest/context";
import { generateReel } from "@/lib/ai/generate";
import { upsertConcepts } from "@/lib/study/mastery";

export async function generateReelArtifact(params: {
  courseId: string;
  courseName: string;
  topic?: string;
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
      kind: "reel",
      title: params.topic ?? `Reel — ${params.courseName}`,
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !artifact) throw new Error(insertError?.message ?? "Insert failed");

  try {
    const context = await getCourseContext(params.courseId);
    if (!context.trim()) {
      throw new Error("No processed material to generate from yet — wait for uploads to finish.");
    }

    const script = await generateReel(context, params.topic);

    const conceptIds = await upsertConcepts(
      supabase,
      user.id,
      params.courseId,
      artifact.id,
      script.concepts,
    );

    await supabase.from("reel_cards").insert(
      script.cards.map((card, i) => ({
        reel_id: artifact.id,
        user_id: user.id,
        order_index: i,
        hook: card.hook,
        body: card.body,
        visual_hint: card.visualHint,
      })),
    );

    await supabase
      .from("study_artifacts")
      .update({
        title: script.concepts[0] ? `${script.concepts[0]} — ${params.courseName}` : artifact.id,
        content: { recallQuestions: script.recallQuestions, conceptIds },
        status: "ready",
      })
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
