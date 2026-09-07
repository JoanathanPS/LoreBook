"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Deletes a study artifact (summary, flashcard deck, quiz, formula sheet, reel).
 * Cascades to flashcards, quiz attempts, reel cards via PostgreSQL FK.
 */
export async function deleteArtifact(formData: FormData) {
  const artifactId = String(formData.get("artifactId") ?? "");
  if (!artifactId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("study_artifacts")
    .delete()
    .eq("id", artifactId)
    .eq("user_id", user.id);

  revalidatePath("/library");
}
