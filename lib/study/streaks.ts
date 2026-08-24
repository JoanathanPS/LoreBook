import type { SupabaseClient } from "@supabase/supabase-js";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Records a study action: adds XP, and bumps the daily streak at most once per day. */
export async function recordActivity(
  supabase: SupabaseClient,
  userId: string,
  xpGain: number,
): Promise<void> {
  const today = isoDate(new Date());
  const yesterday = isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const { data: row } = await supabase
    .from("streaks")
    .select("current_streak, longest_streak, xp, last_active_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    await supabase
      .from("streaks")
      .insert({ user_id: userId, current_streak: 1, longest_streak: 1, xp: xpGain, last_active_at: today });
    return;
  }

  if (row.last_active_at === today) {
    await supabase
      .from("streaks")
      .update({ xp: row.xp + xpGain })
      .eq("user_id", userId);
    return;
  }

  const nextStreak = row.last_active_at === yesterday ? row.current_streak + 1 : 1;

  await supabase
    .from("streaks")
    .update({
      current_streak: nextStreak,
      longest_streak: Math.max(row.longest_streak, nextStreak),
      xp: row.xp + xpGain,
      last_active_at: today,
    })
    .eq("user_id", userId);
}
