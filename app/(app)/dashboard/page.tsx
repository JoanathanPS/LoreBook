import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Flame, Library, Star, Settings } from "lucide-react";
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

  let streakData = { current_streak: 0, longest_streak: 0, xp: 0 };
  let attemptsData: Array<{ score: number; taken_at: string }> = [];
  let masteryData: Array<{ name: string; score: number }> = [];
  let dueCards = 0;
  let docCount = 0;
  let artCount = 0;

  // 1. Single-roundtrip RPC query for instant response
  const { data: rpcSummary, error: rpcErr } = await supabase.rpc("get_dashboard_summary");

  if (!rpcErr && rpcSummary) {
    const summary = rpcSummary as {
      streak?: { current_streak: number; longest_streak: number; xp: number };
      attempts?: Array<{ score: number; taken_at: string }>;
      mastery?: Array<{ concept_name?: string; score: number }>;
      due_count?: number;
      document_count?: number;
      artifact_count?: number;
    };
    streakData = summary.streak ?? streakData;
    attemptsData = summary.attempts ?? [];
    masteryData = (summary.mastery ?? []).map((m) => ({
      name: m.concept_name ?? "Unknown",
      score: m.score ?? 0,
    }));
    dueCards = summary.due_count ?? 0;
    docCount = summary.document_count ?? 0;
    artCount = summary.artifact_count ?? 0;
  } else {
    // 2. Fallback parallel queries
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

    streakData = {
      current_streak: streaks?.current_streak ?? 0,
      longest_streak: streaks?.longest_streak ?? 0,
      xp: streaks?.xp ?? 0,
    };
    attemptsData = attempts ?? [];
    masteryData = (masteryRows ?? []).map((row) => {
      const concept = Array.isArray(row.concepts) ? row.concepts[0] : row.concepts;
      return { name: concept?.name ?? "Unknown", score: row.score };
    });
    dueCards = dueCount ?? 0;
    docCount = documentCount ?? 0;
    artCount = artifactCount ?? 0;
  }

  return (
    <>
      <GradientMesh />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/library" className={styles.brand} prefetch={false}>
              <Image
                src="/brand/lore-header-v2.png"
                alt="LoreBook"
                width={150}
                height={40}
                priority
                className={styles.logoImg}
              />
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CommandPaletteTrigger />
              <SoundToggle />
              <Button render={<Link href="/library" prefetch={false} />} nativeButton={false} variant="ghost" size="sm">
                <Library size={14} />
                Library
              </Button>
              <Button render={<Link href="/settings" prefetch={false} />} nativeButton={false} variant="ghost" size="sm">
                <Settings size={14} />
                Settings
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
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Your progress</span>
            <h1 className={styles.title}>The ledger.</h1>
          </div>

          <div className={styles.grid}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Streak</span>
              <div className={styles.streakRow}>
                <div>
                  <div className={styles.statRow}>
                    <Flame size={20} color="var(--primary)" />
                    <span className={styles.statValue}>{streakData.current_streak}</span>
                    <span className={styles.statUnit}>days</span>
                  </div>
                  <span className={styles.statSub}>
                    longest: {streakData.longest_streak}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <span className={styles.cardLabel}>XP</span>
              <div className={styles.statRow}>
                <Star size={20} color="var(--primary)" />
                <span className={styles.statValue}>{streakData.xp}</span>
              </div>
              <span className={styles.statSub}>from quizzes, reels, and reviews</span>
            </div>

            <div className={styles.card}>
              <span className={styles.cardLabel}>Cards due</span>
              <div className={styles.statRow}>
                <span className={styles.statValue}>{dueCards}</span>
              </div>
              <span className={styles.statSub}>flashcards ready to review now</span>
            </div>

            <div className={styles.card}>
              <span className={styles.cardLabel}>Material</span>
              <div className={styles.miniStats}>
                <div>
                  <div className={styles.statValue} style={{ fontSize: "1.25rem" }}>
                    {docCount}
                  </div>
                  <span className={styles.statSub}>documents</span>
                </div>
                <div>
                  <div className={styles.statValue} style={{ fontSize: "1.25rem" }}>
                    {artCount}
                  </div>
                  <span className={styles.statSub}>artifacts</span>
                </div>
              </div>
            </div>

            <div className={`${styles.card} ${styles.wide}`}>
              <span className={styles.cardLabel}>Quiz accuracy over time</span>
              <AccuracyTrend attempts={attemptsData} />
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
