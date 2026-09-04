import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCourseContext } from "@/lib/ingest/context";
import { generateFlashcards, extractConcepts } from "@/lib/ai/generate";
import { upsertConcepts } from "@/lib/study/mastery";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: deck, error: deckError } = await supabase
    .from("study_artifacts")
    .select("id, course_id, kind, content")
    .eq("id", id)
    .single();

  if (deckError || !deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  try {
    await supabase
      .from("study_artifacts")
      .update({ status: "generating", error_message: null })
      .eq("id", id);

    const context = await getCourseContext(deck.course_id);
    if (!context.trim()) {
      throw new Error("No processed material available to generate flashcards from.");
    }

    const focusConcepts = (deck.content as { focusConcepts?: string[] } | null)?.focusConcepts;
    const cards = await generateFlashcards(context, 12, focusConcepts);

    // Delete existing cards for this deck if any
    await supabase.from("flashcards").delete().eq("deck_id", id);

    // Insert new cards with schema fallback for missing topic column
    const { error: insertCardsError } = await supabase.from("flashcards").insert(
      cards.map((c) => ({
        deck_id: id,
        user_id: user.id,
        topic: c.topic ?? "General",
        front: c.front,
        back: c.back,
      })),
    );

    if (insertCardsError) {
      console.warn("Flashcards insert with topic failed during regenerate, falling back:", insertCardsError.message);
      const { error: fallbackError } = await supabase.from("flashcards").insert(
        cards.map((c) => ({
          deck_id: id,
          user_id: user.id,
          front: c.front,
          back: c.back,
        })),
      );
      if (fallbackError) {
        throw new Error(`Failed to save flashcards: ${fallbackError.message}`);
      }
    }

    const concepts = await extractConcepts(context);
    await upsertConcepts(supabase, user.id, deck.course_id, id, concepts);

    await supabase
      .from("study_artifacts")
      .update({
        content: { ...(typeof deck.content === "object" ? deck.content : {}), cardCount: cards.length },
        status: "ready",
        error_message: null,
      })
      .eq("id", id);

    return NextResponse.json({ success: true, cardCount: cards.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Regeneration failed";
    await supabase
      .from("study_artifacts")
      .update({ status: "error", error_message: message })
      .eq("id", id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
