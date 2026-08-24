"use client";

import { useEffect, useRef } from "react";
import styles from "./MediaPlayer.module.css";

export function MediaPlayer({
  src,
  kind,
  startAt,
}: {
  src: string;
  kind: "audio" | "video";
  startAt?: number;
}) {
  const ref = useRef<HTMLAudioElement & HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || startAt === undefined) return;
    const seek = () => {
      el.currentTime = startAt;
    };
    if (el.readyState >= 1) seek();
    else el.addEventListener("loadedmetadata", seek, { once: true });
    return () => el.removeEventListener("loadedmetadata", seek);
  }, [startAt]);

  if (kind === "video") {
    return <video ref={ref} src={src} controls className={styles.player} />;
  }

  return <audio ref={ref} src={src} controls className={styles.audioPlayer} />;
}
