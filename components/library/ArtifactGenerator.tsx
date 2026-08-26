"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { artifactHref } from "@/lib/study/artifact-links";
import styles from "./ArtifactGenerator.module.css";

const KINDS = [
  { kind: "summary", label: "Summary" },
  { kind: "flashcard_deck", label: "Flashcards" },
  { kind: "quiz", label: "Quiz" },
  { kind: "formula_sheet", label: "Formula sheet" },
  { kind: "reel", label: "Reel" },
] as const;

export function ArtifactGenerator({
  courseId,
  courseName,
}: {
  courseId: string;
  courseName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(kind: string) {
    setPending(kind);
    setError(null);
    try {
      const endpoint = kind === "reel" ? "/api/reels" : "/api/artifacts";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, courseName, kind }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      router.push(artifactHref(kind, json.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.buttons}>
        {KINDS.map(({ kind, label }) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() => generate(kind)}
          >
            {pending === kind && <Loader2 size={13} className={styles.spinner} />}
            {label}
          </Button>
        ))}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
