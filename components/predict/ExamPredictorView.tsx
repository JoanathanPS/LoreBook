"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Priority {
  conceptId: string;
  name: string;
  frequency: number;
  mastery: number;
  priority: number;
}

import styles from "./ExamPredictorView.module.css";

export function ExamPredictorView({
  courseId,
  courseName,
  examPaperCount,
  priorities,
}: {
  courseId: string;
  courseName: string;
  examPaperCount: number;
  priorities: Priority[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(priorities.slice(0, 8).map((p) => p.conceptId)),
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generate() {
    const focusConcepts = priorities
      .filter((p) => selected.has(p.conceptId))
      .map((p) => p.name);
    if (focusConcepts.length === 0) return;

    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/predict/drill-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, courseName, focusConcepts }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      router.push(`/study/flashcards/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <h1 className={styles.title}>Exam Predictor — {courseName}</h1>
        <p className={styles.sub}>
          Ranked by how often a concept shows up across your {examPaperCount} uploaded past
          paper{examPaperCount === 1 ? "" : "s"}, weighted by how weak your mastery of it
          currently is. Upload past papers from the library (checked as &quot;exam
          paper&quot;) to feed this.
        </p>

        {priorities.length === 0 ? (
          <div className={styles.empty}>
            No recurring concepts found yet — upload at least one document marked as a past
            exam paper, and make sure it&apos;s finished processing.
          </div>
        ) : (
          <>
            <div className={styles.list}>
              {priorities.map((p) => (
                <label key={p.conceptId} className={styles.row}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.conceptId)}
                    onChange={() => toggle(p.conceptId)}
                  />
                  <span className={styles.name}>{p.name}</span>
                  <span className={styles.freq}>
                    {p.frequency}× in past papers
                  </span>
                  <span className={styles.mastery}>{Math.round(p.mastery * 100)}%</span>
                </label>
              ))}
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <Button disabled={generating || selected.size === 0} onClick={generate}>
              {generating ? "Building deck…" : `Generate drill deck (${selected.size})`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
