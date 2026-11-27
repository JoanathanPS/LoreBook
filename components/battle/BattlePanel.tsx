"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import styles from "./BattlePanel.module.css";

type Status = "waiting" | "active" | "finished";

/** A quiz question as the battle RPC returns it — no correct answer. */
export interface BattleQuestion {
  prompt: string;
  choices: string[];
}

export function BattlePanel({
  battleId,
  initialTitle,
  initialQuestions,
  initialLoadError,
  currentUserId,
  initialHostId,
  initialGuestId,
  initialStatus,
  initialScores,
}: {
  battleId: string;
  initialTitle: string;
  initialQuestions: BattleQuestion[];
  initialLoadError: string | null;
  currentUserId: string;
  initialHostId: string;
  initialGuestId: string | null;
  initialStatus: string;
  initialScores: Record<string, number>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [hostId] = useState(initialHostId);
  const [guestId, setGuestId] = useState(initialGuestId);
  const [status, setStatus] = useState<Status>(initialStatus as Status);
  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [title, setTitle] = useState(initialTitle);
  const [questions, setQuestions] = useState<BattleQuestion[]>(initialQuestions);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    new Array(initialQuestions.length).fill(null),
  );
  const [joining, setJoining] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);

  const isHost = currentUserId === hostId;
  const opponentId = isHost ? guestId : hostId;
  const iAmIn = isHost || currentUserId === guestId;
  const submitted = scores[currentUserId] !== undefined;

  useEffect(() => {
    const channel = supabase
      .channel(`battle-${battleId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battle_sessions", filter: `id=eq.${battleId}` },
        (payload) => {
          const row = payload.new as {
            guest_id: string | null;
            status: Status;
            scores: Record<string, number>;
          };
          setGuestId(row.guest_id);
          setStatus(row.status);
          setScores(row.scores ?? {});
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, battleId]);

  async function loadQuestions() {
    setLoadingQuestions(true);
    setError(null);
    const { data, error: rpcError } = await supabase
      .rpc("get_battle_questions", { p_battle_id: battleId })
      .maybeSingle<{ title: string | null; questions: BattleQuestion[] | null }>();
    setLoadingQuestions(false);
    if (rpcError) {
      setError(`Couldn't load the questions: ${rpcError.message}`);
      return;
    }
    const qs = data?.questions ?? [];
    if (data?.title) setTitle(data.title);
    setQuestions(qs);
    setAnswers(new Array(qs.length).fill(null));
  }

  async function joinBattle() {
    setJoining(true);
    setError(null);
    const { error: joinError } = await supabase.rpc("join_battle", { p_battle_id: battleId });
    setJoining(false);
    if (joinError) {
      setError(joinError.message);
      return;
    }
    setGuestId(currentUserId);
    setStatus("active");
    await loadQuestions();
  }

  async function submitAnswers() {
    if (questions.length === 0 || answers.some((a) => a === null)) return;
    setSubmitting(true);
    setError(null);
    const { data, error: submitError } = await supabase.rpc("submit_battle_answers", {
      p_battle_id: battleId,
      p_answers: answers,
    });
    setSubmitting(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    const result = data as { status: Status; scores: Record<string, number> };
    setScores(result.scores);
    setStatus(result.status);
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const hasQuestions = questions.length > 0;
  const allAnswered = hasQuestions && answers.every((a) => a !== null);
  const myScore = scores[currentUserId];
  const theirScore = opponentId ? scores[opponentId] : undefined;

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <h1 className={styles.title}>⚔ Battle — {title}</h1>

        {error && <p className={styles.error}>{error}</p>}

        {status === "waiting" && isHost && (
          <div className={styles.card}>
            <p className={styles.hint}>Waiting for an opponent — send them this link:</p>
            <div className={styles.linkRow}>{shareUrl}</div>
          </div>
        )}

        {status === "waiting" && !isHost && (
          <div className={styles.card}>
            <p className={styles.hint}>You&apos;ve been challenged to a quiz battle.</p>
            <Button onClick={joinBattle} disabled={joining}>
              {joining ? "Joining…" : "Join battle"}
            </Button>
          </div>
        )}

        {!iAmIn && status !== "waiting" && (
          <div className={styles.card}>
            <p className={styles.hint}>This battle already has two players.</p>
          </div>
        )}

        {iAmIn && status !== "waiting" && (
          <>
            <div className={styles.scoreboard}>
              <div className={styles.scoreEntry}>
                <span className={styles.scoreLabel}>You</span>
                <span className={styles.scoreValue}>{myScore ?? "—"}</span>
              </div>
              <div className={styles.scoreEntry}>
                <span className={styles.scoreLabel}>Opponent</span>
                <span className={styles.scoreValue}>
                  {opponentId ? (theirScore ?? "…") : "—"}
                </span>
              </div>
            </div>

            {status === "finished" ? (
              <div className={styles.card}>
                <p className={styles.hint}>
                  {theirScore === undefined || myScore === undefined
                    ? "Battle over."
                    : myScore > theirScore
                      ? "You won 🎉"
                      : myScore === theirScore
                        ? "It's a tie."
                        : "Opponent won this one."}
                </p>
              </div>
            ) : submitted ? (
              <div className={styles.card}>
                <p className={styles.hint}>Answers submitted — waiting for your opponent…</p>
              </div>
            ) : loadingQuestions ? (
              <div className={styles.card}>
                <p className={styles.hint}>Loading questions…</p>
              </div>
            ) : !hasQuestions ? (
              <div className={styles.card}>
                <p className={styles.hint}>
                  The questions for this battle couldn&apos;t be loaded, so it can&apos;t be
                  played yet.
                </p>
                <Button variant="outline" onClick={loadQuestions}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                {questions.map((q, qi) => (
                  <div key={qi} className={styles.question}>
                    <div className={styles.prompt}>{q.prompt}</div>
                    <div className={styles.choices}>
                      {q.choices.map((choice, ci) => (
                        <button
                          key={ci}
                          type="button"
                          className={styles.choice}
                          data-selected={answers[qi] === ci}
                          onClick={() =>
                            setAnswers((prev) => prev.map((a, i) => (i === qi ? ci : a)))
                          }
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <Button disabled={!allAnswered || submitting} onClick={submitAnswers}>
                  {submitting ? "Submitting…" : "Submit answers"}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
