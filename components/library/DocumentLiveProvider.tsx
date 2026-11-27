"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Live processing state for the signed-in user's documents.
 *
 * Subscribes once per page to Supabase Realtime changes on `documents` rows
 * where user_id = the user (Realtime applies RLS too). Rows that change land
 * in a map that UploadDropzone and LiveDocumentStatus read, so stage and
 * progress update without a page reload. If Realtime can't connect, it falls
 * back to polling while something is still processing.
 */

export interface LiveDocument {
  id: string;
  status: string;
  stage: string | null;
  progress: number;
  error_message: string | null;
  processing_started_at: string | null;
}

interface LiveContextValue {
  docs: Record<string, LiveDocument>;
  /** Merge a known state (e.g. from an API response) before Realtime catches up. */
  seed: (doc: LiveDocument) => void;
}

const LiveContext = createContext<LiveContextValue | null>(null);

const LIVE_COLUMNS = "id, status, stage, progress, error_message, processing_started_at";
const POLL_MS = 5_000;

function pick(row: Record<string, unknown>): LiveDocument {
  return {
    id: String(row.id),
    status: String(row.status ?? "uploaded"),
    stage: (row.stage as string | null) ?? null,
    progress: Number(row.progress ?? 0),
    error_message: (row.error_message as string | null) ?? null,
    processing_started_at: (row.processing_started_at as string | null) ?? null,
  };
}

export function DocumentLiveProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<Record<string, LiveDocument>>({});
  const [connected, setConnected] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh server data (chunk counts, new rows) at most once per second.
  const scheduleRefresh = useRef(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, 1_000);
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`documents-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            scheduleRefresh.current();
            return;
          }
          const next = pick(payload.new as Record<string, unknown>);
          setDocs((prev) => {
            const before = prev[next.id];
            // Status changes (ready/error) change server-rendered bits too.
            if (!before || before.status !== next.status) scheduleRefresh.current();
            return { ...prev, [next.id]: next };
          });
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [userId]);

  // Fallback polling: only while Realtime is down and something is in flight.
  const processingIds = useMemo(
    () => Object.values(docs).filter((d) => d.status === "processing").map((d) => d.id),
    [docs],
  );
  useEffect(() => {
    if (connected || processingIds.length === 0) return;
    const supabase = createClient();
    const timer = setInterval(async () => {
      const { data } = await supabase.from("documents").select(LIVE_COLUMNS).in("id", processingIds);
      if (!data) return;
      setDocs((prev) => {
        const out = { ...prev };
        for (const row of data) {
          const next = pick(row);
          if (prev[next.id]?.status !== next.status) scheduleRefresh.current();
          out[next.id] = next;
        }
        return out;
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [connected, processingIds]);

  const value = useMemo<LiveContextValue>(
    () => ({
      docs,
      seed: (doc) => setDocs((prev) => (prev[doc.id] ? prev : { ...prev, [doc.id]: doc })),
    }),
    [docs],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/** Live state for one document, or `fallback` until anything has changed. */
export function useLiveDocument(id: string | undefined, fallback?: LiveDocument): LiveDocument | undefined {
  const ctx = useContext(LiveContext);
  if (!id) return undefined;
  return ctx?.docs[id] ?? fallback;
}

export function useLiveSeed(): LiveContextValue["seed"] | undefined {
  return useContext(LiveContext)?.seed;
}

/** Human label for a processing stage. */
export function stageLabel(doc: Pick<LiveDocument, "status" | "stage" | "progress">): string {
  if (doc.status === "error") return "failed";
  if (doc.status === "ready") return doc.stage === "enriching" ? "ready · tagging concepts" : "ready";
  switch (doc.stage) {
    case "queued":
      return "queued";
    case "extracting":
      return "reading file";
    case "embedding":
      return `indexing ${doc.progress}%`;
    default:
      return doc.status === "processing" ? "processing" : doc.status;
  }
}

/** A row stuck in processing this long is offered a retry. */
export const STUCK_AFTER_MS = 10 * 60 * 1000;

export function isStuck(doc: Pick<LiveDocument, "status" | "processing_started_at">, now: number | null): boolean {
  if (doc.status !== "processing" || now === null) return false;
  // Legacy rows from before the queue have no start time: always retryable.
  if (!doc.processing_started_at) return true;
  return now - new Date(doc.processing_started_at).getTime() > STUCK_AFTER_MS;
}
