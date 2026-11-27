"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProgressBar } from "./ProgressBar";
import { stageLabel, useLiveDocument, useLiveSeed } from "./DocumentLiveProvider";
import styles from "./UploadDropzone.module.css";

interface UploadItem {
  key: string;
  name: string;
  /** Local phase. Once "queued", live state from the worker takes over. */
  status: "uploading" | "queued" | "error";
  documentId?: string;
  message?: string;
}

/**
 * Upload = store the file, register the row, and return. The server queues
 * the document and the ingest worker processes it in bounded steps; this
 * component just follows stage and progress over Supabase Realtime.
 */
export function UploadDropzone({ courseId }: { courseId: string }) {
  const router = useRouter();
  const seed = useLiveSeed();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isExamPaper, setIsExamPaper] = useState(false);

  async function uploadOne(file: File) {
    const key = crypto.randomUUID();
    setItems((prev) => [...prev, { key, name: file.name, status: "uploading" }]);
    const update = (patch: Partial<UploadItem>) =>
      setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated. Please log in.");

      const documentId = crypto.randomUUID();
      const storagePath = `${user.id}/${documentId}/${file.name}`;

      // 1. Direct browser-to-Supabase Storage upload (bypasses Next.js route body size limits)
      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: true,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // 2. Register the document; the server queues it and returns right away.
      const uploadRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          courseId,
          title: file.name,
          storagePath,
          isExamPaper,
        }),
      });

      const uploadText = await uploadRes.text();
      let uploadJson: { error?: string } = {};
      try {
        uploadJson = JSON.parse(uploadText);
      } catch {
        throw new Error(
          `Upload server error (${uploadRes.status}): ${uploadText.slice(0, 100)}`,
        );
      }
      if (!uploadRes.ok) throw new Error(uploadJson.error ?? "Upload failed");

      // 3. Follow progress live (the row also appears in the list below).
      seed?.({
        id: documentId,
        status: "processing",
        stage: "queued",
        progress: 0,
        error_message: null,
        processing_started_at: new Date().toISOString(),
      });
      update({ status: "queued", documentId });
      router.refresh();
    } catch (err) {
      update({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    Array.from(fileList).forEach((file) => void uploadOne(file));
  }

  return (
    <div>
      <label className={styles.examCheckbox}>
        <input
          type="checkbox"
          checked={isExamPaper}
          onChange={(e) => setIsExamPaper(e.target.checked)}
        />
        Mark as past exam paper (feeds the Exam Predictor)
      </label>
      <div
        className={styles.dropzone}
        data-active={dragOver}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <UploadCloud size={20} />
        <span>Drop a file, or click to browse</span>
        <span className={styles.hint}>PDF, PPTX, DOCX, images, audio, video, or .txt/.md notes</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className={styles.hiddenInput}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <ul className={styles.uploadList}>
          {items.map((item) => (
            <UploadRow key={item.key} item={item} onDismiss={() => removeItem(item.key)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadRow({ item, onDismiss }: { item: UploadItem; onDismiss: () => void }) {
  const live = useLiveDocument(item.documentId);

  const failed = item.status === "error" || live?.status === "error";
  const ready = live?.status === "ready";
  const message = item.status === "error" ? item.message : live?.error_message;

  // Ready rows live on in the document list; drop them from here shortly after.
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => dismissRef.current(), 1500);
    return () => clearTimeout(timer);
  }, [ready]);

  let label: string;
  if (item.status === "uploading") label = "uploading";
  else if (failed) label = message ?? "processing failed";
  else if (live) label = stageLabel(live);
  else label = "queued";

  const showBar = !failed && !ready && item.status !== "uploading";

  return (
    <li className={styles.uploadItem}>
      {!failed && !ready ? <Loader2 size={13} className={styles.spinner} /> : null}
      <span className={styles.uploadName}>{item.name}</span>
      {showBar && (
        <ProgressBar
          value={live?.stage === "embedding" ? live.progress : null}
          label={`Processing ${item.name}`}
        />
      )}
      <span
        className={styles.uploadStatus}
        data-status={failed ? "error" : ready ? "done" : item.status}
        title={failed ? label : undefined}
      >
        {label}
      </span>
      {failed && (
        <button type="button" onClick={onDismiss} className={styles.dismissBtn} title="Dismiss">
          ✕
        </button>
      )}
    </li>
  );
}
