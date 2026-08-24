"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { QuizQuestion } from "@/lib/ai/generate";
import styles from "./BattlePanel.module.css";

type Status = "waiting" | "active" | "finished";

export function BattlePanel({
  battleId,
  quizTitle,
  questions,
  currentUserId,
  initialHostId,
  initialGuestId,
  initialStatus,
  initialScores,
}: {
  battleId: string;
  quizTitle: string;
  questions: QuizQuestion[];
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
  const [answers, setAnswers] = useState<(number | null)[]>(() => new Array(questions.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = currentUserId === hostId;
  const opponentId = isHost ? guestId : hostId;
  const iAmIn = isHost || currentUserId === guestId;

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

  async function joinBattle() {
    setError(null);
    const { error: joinError } = await supabase
      .from("battle_sessions")
      .update({ guest_id: currentUserId, status: "active" })
      .eq("id", battleId)
      .is("guest_id", null);
    if (joinError) setError(joinError.message);
  }

  async function submitAnswers() {
    const correctCount = questions.reduce(
      (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
      0,
    );
    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

    const nextScores = { ...scores, [currentUserId]: score };
    const bothIn = hostId && guestId && nextScores[hostId] !== undefined && nextScores[guestId] !== undefined;

    const { error: submitError } = await supabase
      .from("battle_sessions")
      .update({ scores: nextScores, status: bothIn ? "finished" : "active" })
      .eq("id", battleId);

    if (submitError) setError(submitError.message);
    else {
      setScores(nextScores);
      setSubmitted(true);
      if (bothIn) setStatus("finished");
    }
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const allAnswered = answers.every((a) => a !== null);

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <h1 className={styles.title}>⚔ Battle — {quizTitle}</h1>

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
            <Button onClick={joinBattle}>Join battle</Button>
          </div>
        )}

        {iAmIn && status !== "waiting" && (
          <>
            <div className={styles.scoreboard}>
              <div className={styles.scoreEntry}>
                <span className={styles.scoreLabel}>You</span>
                <span className={styles.scoreValue}>{scores[currentUserId] ?? "—"}</span>
              </div>
              <div className={styles.scoreEntry}>
                <span className={styles.scoreLabel}>Opponent</span>
                <span className={styles.scoreValue}>
                  {opponentId ? (scores[opponentId] ?? "…") : "—"}
                </span>
              </div>
            </div>

            {status === "finished" ? (
              <div className={styles.card}>
                <p className={styles.hint}>
                  {scores[currentUserId] > (opponentId ? scores[opponentId] : -1)
                    ? "You won 🎉"
                    : scores[currentUserId] === (opponentId ? scores[opponentId] : -1)
                      ? "It's a tie."
                      : "Opponent won this one."}
                </p>
              </div>
            ) : submitted ? (
              <div className={styles.card}>
                <p className={styles.hint}>Answers submitted — waiting for your opponent…</p>
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
                <Button disabled={!allAnswered} onClick={submitAnswers}>
                  Submit answers
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
