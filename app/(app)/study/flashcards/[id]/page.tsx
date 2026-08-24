import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { FlashcardReview } from "@/components/study/FlashcardReview";

export default async function FlashcardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deck } = await supabase
    .from("study_artifacts")
    .select("id, title, status, error_message")
    .eq("id", id)
    .single();

  if (!deck) notFound();

  const { data: cards } = await supabase
    .from("flashcards")
    .select("id, front, back")
    .eq("deck_id", id)
    .order("due_at", { ascending: true });

  return (
    <>
      <GradientMesh />
      <FlashcardReview
        title={deck.title}
        status={deck.status}
        errorMessage={deck.error_message}
        cards={cards ?? []}
      />
    </>
  );
}
