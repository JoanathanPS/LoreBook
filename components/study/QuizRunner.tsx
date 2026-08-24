"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { playCorrect, playIncorrect } from "@/lib/audio/sounds";
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

  const allAnswered = answers.every((a) => a !== null);

  async function startBattle() {
    setStartingBattle(true);
    try {
      const res = await fetch("/api/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, courseId }),
      });
      const json = await res.json();
      if (res.ok) router.push(`/battle/${json.id}`);
    } finally {
      setStartingBattle(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/artifacts/${quizId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json: AttemptResult = await res.json();
      setResult(json);
      if (json.score >= 0.5) playCorrect();
      else playIncorrect();
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

      {status === "ready" && (
        <div className={styles.questions}>
          {questions.map((q, qi) => (
            <div key={qi} className={styles.question}>
              <div className={styles.prompt}>{q.prompt}</div>
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
                      {choice}
                    </button>
                  );
                })}
              </div>
              {result && <p className={styles.explanation}>{q.explanation}</p>}
            </div>
          ))}

          {!result && (
            <Button disabled={!allAnswered || submitting} onClick={submit}>
              {submitting ? "Grading…" : "Submit"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
