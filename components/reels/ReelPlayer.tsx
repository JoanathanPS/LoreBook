"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { RecallDeck } from "./RecallDeck";
import { Skeleton } from "@/components/ui/skeleton";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { playSwipe } from "@/lib/audio/sounds";
import type { RecallQuestion } from "@/lib/ai/generate";
import styles from "./ReelPlayer.module.css";

const CARD_DURATION_MS = 6500;

interface Card {
  hook: string;
  body: string;
  visual_hint: string | null;
}

export function ReelPlayer({
  reelId,
  status,
  errorMessage,
  cards,
  recallQuestions,
}: {
  reelId: string;
  status: string;
  errorMessage: string | null;
  cards: Card[];
  recallQuestions: RecallQuestion[];
}) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<"cards" | "recall">("cards");
  const reducedMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = cards[index];

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= cards.length) {
        setPhase("recall");
        return;
      }
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [cards.length, index],
  );

  // Auto-advance timer, paused while holding.
  useEffect(() => {
    if (phase !== "cards" || paused) return;
    timerRef.current = setTimeout(() => goTo(index + 1), CARD_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, paused, phase, goTo]);

  // Narration via the browser's built-in speech synthesis (free, no API).
  useEffect(() => {
    if (phase !== "cards" || !current || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    if (!muted) {
      const utterance = new SpeechSynthesisUtterance(`${current.hook}. ${current.body}`);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
    return () => window.speechSynthesis.cancel();
  }, [index, muted, phase, current]);

  function handleDragEnd(_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const swipedUp = info.offset.y < -80 || info.velocity.y < -600;
    const swipedDown = info.offset.y > 80 || info.velocity.y > 600;
    if (swipedUp) {
      playSwipe();
      goTo(index + 1);
    } else if (swipedDown) {
      playSwipe();
      goTo(index - 1);
    }
  }

  function handleTap(clientX: number) {
    playSwipe();
    const isLeft = clientX < window.innerWidth / 2;
    goTo(isLeft ? index - 1 : index + 1);
  }

  const variants = useMemo(
    () =>
      reducedMotion
        ? {
            enter: { opacity: 0 },
            center: { opacity: 1 },
            exit: { opacity: 0 },
          }
        : {
            enter: (dir: number) => ({ y: dir > 0 ? 60 : -60, opacity: 0, scale: 0.96 }),
            center: { y: 0, opacity: 1, scale: 1, filter: "blur(0px)" },
            exit: (dir: number) => ({
              y: dir > 0 ? -60 : 60,
              opacity: 0,
              scale: 0.94,
              filter: "blur(4px)",
            }),
          },
    [reducedMotion],
  );

  if (status === "generating") {
    return (
      <div className={styles.stage}>
        <div className={styles.cardLayer}>
          <Skeleton style={{ width: "100%", maxWidth: "26rem", height: "18rem", borderRadius: "1.5rem" }} />
        </div>
        <p className={styles.hint}>Generating your reel…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.stage}>
        <p className={styles.hint}>{errorMessage ?? "Something went wrong."}</p>
        <Link href="/library" className={styles.backLink} style={{ position: "absolute", top: 16, left: 16 }}>
          ← Back to library
        </Link>
      </div>
    );
  }

  if (phase === "recall") {
    return <RecallDeck reelId={reelId} questions={recallQuestions} />;
  }

  return (
    <div className={styles.stage}>
      <div className={styles.tapZone + " " + styles.tapZoneLeft} onClick={() => handleTap(0)} />
      <div
        className={styles.tapZone + " " + styles.tapZoneRight}
        onClick={() => handleTap(window.innerWidth)}
      />

      <div className={styles.topBar}>
        <div className={styles.progressRow}>
          {cards.map((_, i) => (
            <div key={i} className={styles.segment}>
              <div
                className={styles.segmentFill}
                data-state={i < index ? "done" : i === index ? "active" : "pending"}
                data-paused={i === index ? paused : undefined}
                style={i === index ? ({ "--duration": `${CARD_DURATION_MS}ms` } as React.CSSProperties) : undefined}
              />
            </div>
          ))}
        </div>
        <div className={styles.topRow}>
          <Link href="/library" className={styles.backLink}>
            ← Library
          </Link>
          <button
            type="button"
            className={styles.muteButton}
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute narration" : "Mute narration"}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      </div>

      <div className={styles.cardLayer}>
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={index}
            className={styles.card}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              reducedMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 300, damping: 30 }
            }
            drag="y"
            dragElastic={0.2}
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={handleDragEnd}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerCancel={() => setPaused(false)}
          >
            {current?.visual_hint && <span className={styles.visualHint}>{current.visual_hint}</span>}
            <p className={styles.hook}>{current?.hook}</p>
            <p className={styles.body}>{current?.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <p className={styles.hint}>swipe up for next · tap to skip</p>
    </div>
  );
}
