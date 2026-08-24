import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReelPlayer } from "@/components/reels/ReelPlayer";
import type { RecallQuestion } from "@/lib/ai/generate";

export default async function ReelPage({
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

  const { data: artifact } = await supabase
    .from("study_artifacts")
    .select("status, error_message, content")
    .eq("id", id)
    .eq("kind", "reel")
    .single();

  if (!artifact) notFound();

  const { data: cards } = await supabase
    .from("reel_cards")
    .select("hook, body, visual_hint")
    .eq("reel_id", id)
    .order("order_index", { ascending: true });

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
