"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { playFlip } from "@/lib/audio/sounds";
import { InlineMath } from "@/components/study/SimpleMarkdown";
import type { Grade } from "@/lib/srs/sm2";
import styles from "./FlashcardReview.module.css";

interface Card {
  id: string;
  topic: string;
  front: string;
  back: string;
}

const GRADE_BUTTONS: { grade: Grade; label: string }[] = [
  { grade: "again", label: "Again" },
  { grade: "hard", label: "Hard" },
  { grade: "good", label: "Good" },
  { grade: "easy", label: "Easy" },
];

/** Deterministic small tilt per card (not Math.random — must match between
 * server and client render) so the board reads as pinned cards, not a grid. */
function cardTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 7) - 3;
}

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
  const reducedMotion = useReducedMotion();
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [graded, setGraded] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState<string | null>(null);

  const topics = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of cards) {
      const list = map.get(c.topic) ?? [];
      list.push(c);
      map.set(c.topic, list);
    }
    return Array.from(map.entries());
  }, [cards]);

  function toggleFlip(id: string) {
    playFlip();
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function grade(id: string, g: Grade) {
    if (submitting) return;
    setSubmitting(id);
    try {
      await fetch(`/api/flashcards/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: g }),
      });
      setGraded((prev) => new Set(prev).add(id));
    } finally {
      setSubmitting(null);
    }
  }

  const allGraded = cards.length > 0 && graded.size === cards.length;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <h1 className={styles.title}>{title}</h1>
        {status === "ready" && cards.length > 0 && (
          <>
            <p className={styles.hint}>
              Click a card to see the answer, then grade how well you knew it — that&rsquo;s
              what decides when it comes back around.
            </p>
            <span className={styles.progress}>
              {graded.size} / {cards.length} reviewed
            </span>
          </>
        )}
      </div>

      {status === "generating" && (
        <div className={styles.board} style={{ maxWidth: "64rem" }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ width: "16rem", height: "11rem", borderRadius: "var(--radius-lg)" }} />
          ))}
        </div>
      )}
      {status === "error" && <p className={styles.error}>{errorMessage}</p>}
      {status === "ready" && cards.length === 0 && (
        <p className={styles.done}>This deck has no cards.</p>
      )}

      {status === "ready" && cards.length > 0 && !allGraded && (
        <div className={styles.topics}>
          {topics.map(([topic, topicCards]) => {
            const remaining = topicCards.filter((c) => !graded.has(c.id));
            if (remaining.length === 0) return null;
            return (
              <section key={topic} className={styles.topicSection}>
                <h2 className={styles.topicTitle}>{topic}</h2>
                <div className={styles.board}>
                  {remaining.map((card) => {
                    const isFlipped = flipped.has(card.id);
                    return (
                      <div
                        key={card.id}
                        className={styles.cardSlot}
                        style={{ "--tilt": `${cardTilt(card.id)}deg` } as React.CSSProperties}
                      >
                        <button
                          type="button"
                          className={styles.flipScene}
                          onClick={() => toggleFlip(card.id)}
                          aria-label={
                            isFlipped
                              ? "Showing answer — tap to show question"
                              : "Showing question — tap to show answer"
                          }
                        >
                          <motion.div
                            className={styles.flipCard}
                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                            transition={
                              reducedMotion
                                ? { duration: 0 }
                                : { type: "spring", stiffness: 300, damping: 28 }
                            }
                          >
                            <div className={styles.face}>
                              <span className={styles.side}>Question</span>
                              <p>
                                <InlineMath text={card.front} />
                              </p>
                            </div>
                            <div className={`${styles.face} ${styles.faceBack}`}>
                              <span className={styles.side}>Answer</span>
                              <p>
                                <InlineMath text={card.back} />
                              </p>
                            </div>
                          </motion.div>
                        </button>
                        {isFlipped && (
                          <div className={styles.grades}>
                            {GRADE_BUTTONS.map(({ grade: g, label }) => (
                              <Button
                                key={g}
                                variant="outline"
                                size="sm"
                                disabled={submitting === card.id}
                                onClick={() => grade(card.id, g)}
                              >
                                {label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {status === "ready" && allGraded && (
        <div className={styles.doneWrap}>
          <p className={styles.done}>
            Every card in this deck is graded. The ones you marked &ldquo;Again&rdquo; or
            &ldquo;Hard&rdquo; will come back sooner — check your dashboard&rsquo;s due count
            to see them when they&rsquo;re due.
          </p>
          <Button render={<Link href="/dashboard" />} nativeButton={false}>
            Back to dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
