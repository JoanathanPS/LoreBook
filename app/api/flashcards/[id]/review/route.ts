import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { schedule, type Grade } from "@/lib/srs/sm2";
import { recordActivity } from "@/lib/study/streaks";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { grade } = (await request.json()) as { grade: Grade };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: card, error } = await supabase
    .from("flashcards")
    .select("ease, interval_days, repetitions")
    .eq("id", id)
    .single();

  if (error || !card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  const next = schedule(
    { ease: card.ease, intervalDays: card.interval_days, repetitions: card.repetitions },
    grade,
  );

  const { error: updateError } = await supabase
    .from("flashcards")
    .update({
      ease: next.ease,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      due_at: next.dueAt.toISOString(),
    })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await recordActivity(supabase, user.id, 2);

  return NextResponse.json({ dueAt: next.dueAt.toISOString(), intervalDays: next.intervalDays });
}
