import type { SupabaseClient } from "@supabase/supabase-js";

/** Nudges mastery_scores for a set of concepts toward or away from 1.0 based on recall accuracy. */
export async function nudgeMastery(
  supabase: SupabaseClient,
  userId: string,
  conceptIds: string[],
  accuracy: number,
): Promise<void> {
  if (conceptIds.length === 0) return;

  const delta = (accuracy - 0.5) * 0.3; // e.g. 100% correct -> +0.15, 0% correct -> -0.15

  const { data: existing } = await supabase
    .from("mastery_scores")
    .select("concept_id, score")
    .eq("user_id", userId)
    .in("concept_id", conceptIds);

  const scoreByConcept = new Map((existing ?? []).map((r) => [r.concept_id, r.score]));

  const rows = conceptIds.map((conceptId) => ({
    user_id: userId,
    concept_id: conceptId,
    score: Math.max(0, Math.min(1, (scoreByConcept.get(conceptId) ?? 0.5) + delta)),
    updated_at: new Date().toISOString(),
  }));

  await supabase.from("mastery_scores").upsert(rows, { onConflict: "user_id,concept_id" });
}

/** Finds or creates concepts by name for a course, linking them to the given artifact. */
export async function upsertConcepts(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  artifactId: string,
  names: string[],
): Promise<string[]> {
  if (names.length === 0) return [];

  await supabase
    .from("concepts")
    .upsert(
      names.map((name) => ({ course_id: courseId, user_id: userId, name })),
      { onConflict: "course_id,name", ignoreDuplicates: true },
    );

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name")
    .eq("course_id", courseId)
    .in("name", names);

  const ids = (concepts ?? []).map((c) => c.id);

  if (ids.length > 0) {
    await supabase
      .from("concept_links")
      .upsert(
        ids.map((conceptId) => ({ concept_id: conceptId, artifact_id: artifactId, user_id: userId })),
        { onConflict: "concept_id,artifact_id", ignoreDuplicates: true },
      );
  }

  return ids;
}
