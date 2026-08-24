import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenText, Flame, LayoutDashboard, Library, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { Button } from "@/components/ui/button";
import { AccuracyTrend } from "@/components/charts/AccuracyTrend";
import { MasteryBars } from "@/components/charts/MasteryBars";
import { CommandPaletteTrigger } from "@/components/command/CommandPaletteTrigger";
import { SoundToggle } from "@/components/audio/SoundToggle";
import styles from "./page.module.css";

interface MasteryJoinRow {
  score: number;
  concepts: { name: string } | { name: string }[] | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();

  const [
    { data: streaks },
    { data: attempts },
    { data: masteryRows },
    { count: dueCount },
    { count: documentCount },
    { count: artifactCount },
  ] = await Promise.all([
    supabase.from("streaks").select("current_streak, longest_streak, xp").maybeSingle(),
    supabase
      .from("quiz_attempts")
      .select("score, taken_at")
      .order("taken_at", { ascending: false })
      .limit(20),
    supabase
      .from("mastery_scores")
      .select("score, concepts(name)")
      .order("updated_at", { ascending: false })
      .limit(12)
      .returns<MasteryJoinRow[]>(),
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .lte("due_at", nowIso),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("study_artifacts").select("id", { count: "exact", head: true }),
  ]);

  const masteryData = (masteryRows ?? []).map((row) => {
    const concept = Array.isArray(row.concepts) ? row.concepts[0] : row.concepts;
    return { name: concept?.name ?? "Unknown", score: row.score };
  });

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/" className={styles.brand}>
              <BookOpenText size={16} style={{ display: "inline", marginRight: 6 }} />
              LoreBook
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CommandPaletteTrigger />
              <SoundToggle />
              <Button render={<Link href="/library" />} nativeButton={false} variant="ghost" size="sm">
                <Library size={14} />
                Library
              </Button>
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <h1 className={styles.title}>
            <LayoutDashboard size={20} style={{ display: "inline", marginRight: 8 }} />
            Dashboard
          </h1>

          <div className={styles.grid}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Streak</span>
              <div className={styles.streakRow}>
                <div>
                  <div className={styles.statRow}>
                    <Flame size={20} color="var(--primary)" />
                    <span className={styles.statValue}>{streaks?.current_streak ?? 0}</span>
                    <span className={styles.statUnit}>days</span>
                  </div>
                  <span className={styles.statSub}>
                    longest: {streaks?.longest_streak ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <span className={styles.cardLabel}>XP</span>
              <div className={styles.statRow}>
                <Star size={20} color="var(--primary)" />
                <span className={styles.statValue}>{streaks?.xp ?? 0}</span>
              </div>
              <span className={styles.statSub}>from quizzes, reels, and reviews</span>
            </div>

            <div className={styles.card}>
              <span className={styles.cardLabel}>Cards due</span>
              <div className={styles.statRow}>
                <span className={styles.statValue}>{dueCount ?? 0}</span>
              </div>
              <span className={styles.statSub}>flashcards ready to review now</span>
            </div>

            <div className={styles.card}>
              <span className={styles.cardLabel}>Material</span>
              <div className={styles.miniStats}>
                <div>
                  <div className={styles.statValue} style={{ fontSize: "1.25rem" }}>
                    {documentCount ?? 0}
                  </div>
                  <span className={styles.statSub}>documents</span>
                </div>
                <div>
                  <div className={styles.statValue} style={{ fontSize: "1.25rem" }}>
                    {artifactCount ?? 0}
                  </div>
                  <span className={styles.statSub}>artifacts</span>
                </div>
              </div>
            </div>

            <div className={`${styles.card} ${styles.wide}`}>
              <span className={styles.cardLabel}>Quiz accuracy over time</span>
              <AccuracyTrend attempts={attempts ?? []} />
            </div>

            <div className={`${styles.card} ${styles.wide}`}>
              <span className={styles.cardLabel}>Concept mastery</span>
              <MasteryBars rows={masteryData} />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
