import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { BattlePanel } from "@/components/battle/BattlePanel";
import type { QuizQuestion } from "@/lib/ai/generate";

export default async function BattlePage({
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

  const { data: battle } = await supabase
    .from("battle_sessions")
    .select("id, quiz_id, course_id, host_id, guest_id, status, scores")
    .eq("id", id)
    .single();

  if (!battle) notFound();

  const { data: quiz } = await supabase
    .from("study_artifacts")
    .select("title, content")
    .eq("id", battle.quiz_id)
    .single();

  const questions = (quiz?.content as { questions?: QuizQuestion[] } | null)?.questions ?? [];

  return (
    <>
      <GradientMesh />
      <BattlePanel
        battleId={battle.id}
        quizTitle={quiz?.title ?? "Quiz battle"}
        questions={questions}
        currentUserId={user.id}
        initialHostId={battle.host_id}
        initialGuestId={battle.guest_id}
        initialStatus={battle.status}
        initialScores={(battle.scores as Record<string, number>) ?? {}}
      />
    </>
  );
}
