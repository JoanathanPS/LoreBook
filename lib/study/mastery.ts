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

/**
 * Concept names come from independent LLM calls (one per artifact
 * generation), so the same idea often comes back phrased slightly
 * differently across calls — "Diffusion Model" vs "Diffusion Models",
 * different casing, extra whitespace. Matching on the exact string (as this
 * used to) mints a fresh near-duplicate node in the concept graph every
 * time. Normalize before matching so those collapse onto one row.
 */
function normalizeConceptKey(name: string): string {
  const norm = name.trim().toLowerCase().replace(/\s+/g, " ");
  // Strip a simple trailing plural "s" — but not for words that are already
  // "singular-looking" with a trailing s (glass, virus, axis, ...).
  if (norm.length > 3 && /s$/.test(norm) && !/(ss|us|is)$/.test(norm)) {
    return norm.slice(0, -1);
  }
  return norm;
}

/** Finds or creates concepts by name for a course, returning their ids (deduped). */
async function resolveConceptIds(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  names: string[],
): Promise<string[]> {
  if (names.length === 0) return [];

  const { data: existing } = await supabase
    .from("concepts")
    .select("id, name")
    .eq("course_id", courseId);

  const byKey = new Map<string, { id: string }>();
  for (const c of existing ?? []) byKey.set(normalizeConceptKey(c.name), c);

  const toInsert: string[] = [];
  const seenNewKeys = new Set<string>();
  for (const name of names) {
    const key = normalizeConceptKey(name);
    if (!byKey.has(key) && !seenNewKeys.has(key)) {
      seenNewKeys.add(key);
      toInsert.push(name);
    }
  }

  if (toInsert.length > 0) {
    const { data: inserted } = await supabase
      .from("concepts")
      .upsert(
        toInsert.map((name) => ({ course_id: courseId, user_id: userId, name })),
        { onConflict: "course_id,name", ignoreDuplicates: true },
      )
      .select("id, name");
    for (const c of inserted ?? []) byKey.set(normalizeConceptKey(c.name), c);

    // `ignoreDuplicates` upserts don't reliably return the rows they
    // skipped (a concurrent insert can race this same call) — re-fetch
    // anything still missing rather than silently dropping it.
    const stillMissing = toInsert.filter((n) => !byKey.has(normalizeConceptKey(n)));
    if (stillMissing.length > 0) {
      const { data: refetched } = await supabase
        .from("concepts")
        .select("id, name")
        .eq("course_id", courseId)
        .in("name", stillMissing);
      for (const c of refetched ?? []) byKey.set(normalizeConceptKey(c.name), c);
    }
  }

  const ids = names
    .map((name) => byKey.get(normalizeConceptKey(name))?.id)
    .filter((id): id is string => !!id);
  return Array.from(new Set(ids));
}

/** Finds or creates concepts by name for a course, linking them to the given artifact. */
export async function upsertConcepts(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  artifactId: string,
  names: string[],
): Promise<string[]> {
  const ids = await resolveConceptIds(supabase, userId, courseId, names);

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

/** Finds or creates concepts by name for a course, linking them to the given document. */
export async function linkDocumentConcepts(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  documentId: string,
  names: string[],
): Promise<string[]> {
  const ids = await resolveConceptIds(supabase, userId, courseId, names);

  if (ids.length > 0) {
    await supabase
      .from("document_concepts")
      .upsert(
        ids.map((conceptId) => ({ concept_id: conceptId, document_id: documentId, user_id: userId })),
        { onConflict: "concept_id,document_id", ignoreDuplicates: true },
      );
  }

  return ids;
}
