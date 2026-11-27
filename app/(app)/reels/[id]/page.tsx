import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session-user";
import { ReelPlayer } from "@/components/reels/ReelPlayer";
import type { RecallQuestion } from "@/lib/ai/generate";

export default async function ReelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // The session check and the data reads are independent (RLS scopes the
  // reads to the same JWT), so start them all at once and redirect after.
  const [
    user,
    { data: artifact },
    { data: cards },
  ] = await Promise.all([
    getSessionUser(supabase),
    supabase
      .from("study_artifacts")
      .select("status, error_message, content")
      .eq("id", id)
      .eq("kind", "reel")
      .single(),
    supabase
      .from("reel_cards")
      .select("hook, body, visual_hint")
      .eq("reel_id", id)
      .order("order_index", { ascending: true }),
  ]);
  if (!user) redirect("/login");

  if (!artifact) notFound();

  const recallQuestions =
    (artifact.content as { recallQuestions?: RecallQuestion[] } | null)?.recallQuestions ?? [];

  return (
    <ReelPlayer
      reelId={id}
      status={artifact.status}
      errorMessage={artifact.error_message}
      cards={cards ?? []}
      recallQuestions={recallQuestions}
    />
  );
}
