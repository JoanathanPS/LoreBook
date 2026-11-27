import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session-user";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { BattlePanel, type BattleQuestion } from "@/components/battle/BattlePanel";

export default async function BattlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  const { data: battle } = await supabase
    .from("battle_sessions")
    .select("id, host_id, guest_id, status, scores")
    .eq("id", id)
    .maybeSingle();

  if (!battle) notFound();

  // Questions come from a security-definer RPC: a guest usually isn't a
  // member of the host's course, so they can't read study_artifacts under
  // RLS. The RPC strips correct answers; grading happens in SQL. It only
  // answers participants, so a not-yet-joined guest loads them after joining.
  const isParticipant = user.id === battle.host_id || user.id === battle.guest_id;
  let title = "Quiz battle";
  let questions: BattleQuestion[] = [];
  let loadError: string | null = null;

  if (isParticipant) {
    const { data, error } = await supabase
      .rpc("get_battle_questions", { p_battle_id: battle.id })
      .maybeSingle<{ title: string | null; questions: BattleQuestion[] | null }>();
    if (error) loadError = error.message;
    title = data?.title ?? title;
    questions = data?.questions ?? [];
  }

  return (
    <>
      <GradientMesh />
      <BattlePanel
        battleId={battle.id}
        initialTitle={title}
        initialQuestions={questions}
        initialLoadError={loadError}
        currentUserId={user.id}
        initialHostId={battle.host_id}
        initialGuestId={battle.guest_id}
        initialStatus={battle.status}
        initialScores={(battle.scores as Record<string, number>) ?? {}}
      />
    </>
  );
}
