"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { playCorrect, playIncorrect } from "@/lib/audio/sounds";
import { InlineMath } from "@/components/study/SimpleMarkdown";
import type { QuizQuestion } from "@/lib/ai/generate";
import styles from "./QuizRunner.module.css";

interface AttemptResult {
  score: number;
  correctCount: number;
  total: number;
  correctIndices: number[];
}

export function QuizRunner({
  quizId,
  courseId,
  title,
  status,
  errorMessage,
  questions,
}: {
  quizId: string;
  courseId: string;
  title: string;
  status: string;
  errorMessage: string | null;
  questions: QuizQuestion[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => new Array(questions.length).fill(null),
  );
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startingBattle, setStartingBattle] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [battleError, setBattleError] = useState<string | null>(null);

  const allAnswered = questions.length > 0 && answers.every((a) => a !== null);

  async function startBattle() {
    setStartingBattle(true);
    setBattleError(null);
    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, courseId }),
      });
      const json = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !json?.id) {
        throw new Error(json?.error ?? `Couldn't start a battle (HTTP ${res.status}).`);
      }
      router.push(`/battle/${json.id}`);
    } catch (err) {
      setBattleError(err instanceof Error ? err.message : "Couldn't start a battle.");
    } finally {
      setStartingBattle(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/artifacts/${quizId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = (await res.json().catch(() => null)) as
        | (Partial<AttemptResult> & { error?: string })
        | null;
      if (!res.ok || typeof json?.score !== "number") {
        throw new Error(
          json?.error ??
            (res.status === 504
              ? "Grading timed out. Please try again."
              : `Grading failed (HTTP ${res.status}). Please try again.`),
        );
      }
      const attempt = json as AttemptResult;
      setResult(attempt);
      if (attempt.score >= 0.5) playCorrect();
      else playIncorrect();
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <h1 className={styles.title}>{title}</h1>
        {status === "ready" && !result && (
          <Button variant="outline" size="sm" disabled={startingBattle} onClick={startBattle}>
            <Swords size={14} />
            {startingBattle ? "Starting…" : "Battle a friend"}
          </Button>
        )}
        {result && (
          <span className={styles.score}>
            {result.correctCount} / {result.total} correct (
            {Math.round(result.score * 100)}%)
          </span>
        )}
      </div>

      {status === "generating" && (
        <div className={styles.questions}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: "8rem", borderRadius: "1.25rem" }} />
          ))}
        </div>
      )}
      {status === "error" && <p className={styles.error}>{errorMessage}</p>}
      {battleError && (
        <p className={styles.error} role="alert">
          {battleError}
        </p>
      )}

      {status === "ready" && (
        <div className={styles.questions}>
          {questions.map((q, qi) => (
            <div key={qi} className={styles.question}>
              <div className={styles.prompt}>
                <InlineMath text={q.prompt} />
              </div>
              <div className={styles.choices}>
                {q.choices.map((choice, ci) => {
                  const selected = answers[qi] === ci;
                  const isCorrect = result && ci === result.correctIndices[qi];
                  const isWrongSelection = result && selected && !isCorrect;
                  return (
                    <button
                      key={ci}
                      type="button"
                      className={styles.choice}
                      data-selected={selected}
                      data-correct={result ? isCorrect : undefined}
                      data-incorrect={result ? isWrongSelection : undefined}
                      disabled={!!result}
                      onClick={() =>
                        setAnswers((prev) => prev.map((a, i) => (i === qi ? ci : a)))
                      }
                    >
                      <InlineMath text={choice} />
                    </button>
                  );
                })}
              </div>
              {result && (
                <p className={styles.explanation}>
                  <InlineMath text={q.explanation} />
                </p>
              )}
            </div>
          ))}

          {submitError && (
            <p className={styles.error} role="alert">
              {submitError}
            </p>
          )}
          {!result && (
            <Button disabled={!allAnswered || submitting} onClick={submit}>
              {submitting ? "Grading…" : submitError ? "Try again" : "Submit"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
