"use client";

import { useEffect, useState } from "react";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { DocumentRowActions } from "./DocumentRowActions";
import { ProgressBar } from "./ProgressBar";
import { isStuck, stageLabel, useLiveDocument, type LiveDocument } from "./DocumentLiveProvider";
import styles from "./LiveDocumentStatus.module.css";

/**
 * The status part of a library row (error / chunk count / progress, badge,
 * actions), kept live by DocumentLiveProvider.
 */
export function LiveDocumentStatus({
  initial,
  title,
  chunkCount,
  canManage,
}: {
  initial: LiveDocument;
  title: string;
  chunkCount: number;
  canManage: boolean;
}) {
  const doc = useLiveDocument(initial.id, initial) ?? initial;
  const now = useNow(30_000);
  const stuck = isStuck(doc, now);
  const canRetry = doc.status === "uploaded" || doc.status === "error" || stuck;

  return (
    <>
      {doc.status === "error" && doc.error_message ? (
        <span className={styles.error} title={doc.error_message}>
          {doc.error_message}
        </span>
      ) : doc.status === "ready" ? (
        <span className={styles.meta}>
          {chunkCount} chunks{doc.stage === "enriching" ? " · tagging concepts" : ""}
        </span>
      ) : doc.status === "processing" ? (
        <span className={styles.progress}>
          <ProgressBar
            value={doc.stage === "embedding" ? doc.progress : null}
            label={`Processing ${title}`}
          />
          <span className={styles.meta}>{stuck ? "stalled — retry?" : stageLabel(doc)}</span>
        </span>
      ) : null}
      <DocumentStatusBadge status={doc.status} />
      {canManage && (
        <DocumentRowActions
          documentId={doc.id}
          documentTitle={title}
          status={doc.status}
          canRetry={canRetry}
        />
      )}
    </>
  );
}

/** Current time, refreshed every `intervalMs`; null during SSR/hydration. */
function useNow(intervalMs: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
