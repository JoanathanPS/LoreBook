"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import type { Grade } from "@/lib/srs/sm2";
import styles from "./FlashcardReview.module.css";

interface Card {
  id: string;
  front: string;
  back: string;
}

const GRADE_BUTTONS: { grade: Grade; label: string }[] = [
  { grade: "again", label: "Again" },
  { grade: "hard", label: "Hard" },
  { grade: "good", label: "Good" },
  { grade: "easy", label: "Easy" },
];

export function FlashcardReview({
  title,
  status,
  errorMessage,
  cards,
}: {
  title: string;
  status: string;
  errorMessage: string | null;
  cards: Card[];
}) {
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const reducedMotion = useReducedMotion();

  const current = cards[index];

  async function grade(g: Grade) {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/flashcards/${current.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: g }),
      });
    } finally {
      setSubmitting(false);
      setShowBack(false);
      setIndex((i) => i + 1);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <h1 className={styles.title}>{title}</h1>
        {cards.length > 0 && (
          <span className={styles.progress}>
            {Math.min(index + 1, cards.length)} / {cards.length}
          </span>
        )}
      </div>

      {status === "generating" && <Skeleton style={{ width: "100%", maxWidth: "32rem", height: "14rem", borderRadius: "1.5rem" }} />}
      {status === "error" && <p className={styles.error}>{errorMessage}</p>}

      {status === "ready" && current && (
        <>
          <button
            type="button"
            className={styles.flipScene}
            onClick={() => setShowBack((s) => !s)}
            aria-label={showBack ? "Showing answer — tap to show question" : "Showing question — tap to show answer"}
          >
            <motion.div
              key={current.id}
              className={styles.flipCard}
              animate={{ rotateY: showBack ? 180 : 0 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 300, damping: 30 }
              }
            >
              <div className={`${styles.card} ${styles.cardFace}`}>
                <div>
                  <span className={styles.side}>Question</span>
                  {current.front}
                </div>
              </div>
              <div className={`${styles.card} ${styles.cardFace} ${styles.cardBack}`}>
                <div>
                  <span className={styles.side}>Answer</span>
                  {current.back}
                </div>
              </div>
            </motion.div>
          </button>

          {showBack ? (
            <div className={styles.grades}>
              {GRADE_BUTTONS.map(({ grade: g, label }) => (
                <Button key={g} variant="outline" disabled={submitting} onClick={() => grade(g)}>
                  {label}
                </Button>
              ))}
            </div>
          ) : (
            <Button onClick={() => setShowBack(true)}>Show answer</Button>
          )}
        </>
      )}

      {status === "ready" && !current && cards.length > 0 && (
        <p className={styles.done}>You&apos;ve reviewed every card in this deck. Nice.</p>
      )}
      {status === "ready" && cards.length === 0 && (
        <p className={styles.done}>This deck has no cards.</p>
      )}
    </div>
  );
}
