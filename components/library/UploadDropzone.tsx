"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./UploadDropzone.module.css";

interface UploadItem {
  name: string;
  status: "uploading" | "processing" | "done" | "error";
  message?: string;
}

export function UploadDropzone({ courseId }: { courseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isExamPaper, setIsExamPaper] = useState(false);

  async function uploadOne(file: File) {
    setItems((prev) => [...prev, { name: file.name, status: "uploading" }]);
    const update = (patch: Partial<UploadItem>) =>
      setItems((prev) =>
        prev.map((it) => (it.name === file.name ? { ...it, ...patch } : it)),
      );

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

      // 2. Register document record in PostgreSQL
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

      // 3. Trigger processing pipeline
      update({ status: "processing" });
      router.refresh();

      const processRes = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
      });
      const processText = await processRes.text();
      let processJson: { error?: string } = {};
      try {
        processJson = JSON.parse(processText);
      } catch {
        throw new Error(
          `Processing server error (${processRes.status}): ${processText.slice(0, 100)}`,
        );
      }
      if (!processRes.ok) throw new Error(processJson.error ?? "Processing failed");

      update({ status: "done" });
      setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.name !== file.name));
      }, 1000);
    } catch (err) {
      update({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      router.refresh();
    }
  }

  function removeItem(name: string) {
    setItems((prev) => prev.filter((it) => it.name !== name));
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
            <li key={item.name} className={styles.uploadItem}>
              {item.status !== "done" && item.status !== "error" ? (
                <Loader2 size={13} className={styles.spinner} />
              ) : null}
              <span className={styles.uploadName}>{item.name}</span>
              <span className={styles.uploadStatus} data-status={item.status}>
                {item.status === "error" ? item.message : item.status}
              </span>
              {item.status === "error" && (
                <button
                  type="button"
                  onClick={() => removeItem(item.name)}
                  className={styles.dismissBtn}
                  title="Dismiss"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
