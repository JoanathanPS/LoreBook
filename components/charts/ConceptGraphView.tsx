"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ConceptGraph } from "./ConceptGraph";
import type { ArtifactRef, GraphEdge, GraphNode } from "./types";
import { artifactHref } from "@/lib/study/artifact-links";
import { masteryColor, MASTERY_STOPS } from "@/lib/study/mastery-color";
import styles from "./ConceptGraphView.module.css";

export function ConceptGraphView({
  courseName,
  nodes,
  edges,
  artifactsByConcept,
}: {
  courseId: string;
  courseName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  artifactsByConcept: Record<string, ArtifactRef[]>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const onSelect = useCallback((id: string) => setSelectedId(id), []);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const selectedArtifacts = selectedId ? (artifactsByConcept[selectedId] ?? []) : [];

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <h1 className={styles.title}>{courseName} — concept graph</h1>
        <div className={styles.legend}>
          <span>
            <span className={styles.legendDot} style={{ background: MASTERY_STOPS.low }} />
            Needs work
          </span>
          <span>
            <span className={styles.legendDot} style={{ background: MASTERY_STOPS.mid }} />
            Developing
          </span>
          <span>
            <span className={styles.legendDot} style={{ background: MASTERY_STOPS.high }} />
            Mastered
          </span>
        </div>
      </div>

      <div className={styles.body}>
        {nodes.length === 0 ? (
          <div className={styles.empty}>
            No concepts yet — generate a summary, flashcard deck, quiz, or reel for this
            course and they&apos;ll start showing up here.
          </div>
        ) : (
          <ConceptGraph nodes={nodes} edges={edges} selectedId={selectedId} onSelect={onSelect} />
        )}

        <div className={styles.panel}>
          {!selected && <p className={styles.empty}>Click a concept to see its sources.</p>}
          {selected && (
            <>
              <div className={styles.panelTitle}>{selected.name}</div>
              <div className={styles.masteryBar}>
                <div
                  className={styles.masteryFill}
                  style={{
                    width: `${Math.round(selected.mastery * 100)}%`,
                    background: masteryColor(selected.mastery),
                  }}
                />
              </div>
              <div className={styles.artifactList}>
                {selectedArtifacts.length === 0 && (
                  <p className={styles.empty}>No linked material yet.</p>
                )}
                {selectedArtifacts.map((a) => (
                  <Link
                    key={a.id}
                    href={artifactHref(a.kind, a.id)}
                    className={`${styles.artifactLink} hover-lift`}
                  >
                    <span>{a.title}</span>
                    <span className={styles.artifactKind}>{a.kind}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
