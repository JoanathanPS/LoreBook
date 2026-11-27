import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session-user";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { FlashcardReview } from "@/components/study/FlashcardReview";

export default async function FlashcardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  const [{ data: deck }, { data: cardsWithTopic, error: cardsError }] = await Promise.all([
    supabase
      .from("study_artifacts")
      .select("id, title, status, error_message")
      .eq("id", id)
      .single(),
    supabase
      .from("flashcards")
      .select("id, topic, front, back")
      .eq("deck_id", id)
      .order("due_at", { ascending: true }),
  ]);

  if (!deck) notFound();

  let cards: Array<{ id: string; topic: string; front: string; back: string }> = [];

  if (cardsError) {
    console.warn("Failed to query flashcards with topic, falling back without topic column:", cardsError.message);
    const { data: fallbackCards } = await supabase
      .from("flashcards")
      .select("id, front, back")
      .eq("deck_id", id)
      .order("due_at", { ascending: true });

    if (fallbackCards) {
      cards = fallbackCards.map((c) => ({
        id: c.id,
        topic: "General",
        front: c.front,
        back: c.back,
      }));
    }
  } else if (cardsWithTopic) {
    cards = cardsWithTopic.map((c) => ({
      id: c.id,
      topic: c.topic || "General",
      front: c.front,
      back: c.back,
    }));
  }

  return (
    <>
      <GradientMesh />
      <FlashcardReview
        deckId={deck.id}
        title={deck.title}
        status={deck.status}
        errorMessage={deck.error_message}
        cards={cards}
      />
    </>
  );
}
