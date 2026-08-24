"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import type { RecallQuestion } from "@/lib/ai/generate";
import styles from "./RecallDeck.module.css";

export function RecallDeck({
  reelId,
  questions,
}: {
  reelId: string;
  questions: RecallQuestion[];
}) {
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const reducedMotion = useReducedMotion();

  const current = questions[index];

  async function answer(saidTrue: boolean) {
    const wasCorrect = saidTrue === current.isTrue;
    const nextCorrect = correct + (wasCorrect ? 1 : 0);
    setCorrect(nextCorrect);

    if (index + 1 >= questions.length) {
      setFinished(true);
      await fetch(`/api/reels/${reelId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctCount: nextCorrect, total: questions.length }),
      });
    } else {
      setIndex((i) => i + 1);
    }
  }

  function handleDragEnd(_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.x > 100 || info.velocity.x > 600) answer(true);
    else if (info.offset.x < -100 || info.velocity.x < -600) answer(false);
  }

  if (questions.length === 0 || finished) {
    return (
      <div className={styles.stage}>
        <div className={styles.done}>
          <span className={styles.score}>
            {correct} / {questions.length}
          </span>
          <span className={styles.doneSub}>recalled correctly</span>
          <Link href="/library" className={styles.backLink}>
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stage}>
      <span className={styles.progress}>
        {index + 1} / {questions.length}
      </span>

      <div className={styles.cardLayer}>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={index}
            className={styles.card}
            initial={reducedMotion ? { opacity: 0 } : { scale: 0.92, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            transition={
              reducedMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 300, damping: 30 }
            }
            drag={reducedMotion ? false : "x"}
            dragElastic={0.3}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
          >
            <p className={styles.statement}>{current.statement}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.legend}>
        <button type="button" className={styles.legendFalse} onClick={() => answer(false)}>
          ← false
        </button>
        <button type="button" className={styles.legendTrue} onClick={() => answer(true)}>
          true →
        </button>
      </div>
    </div>
  );
}
