"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";
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
      const form = new FormData();
      form.append("file", file);
      form.append("course_id", courseId);
      if (isExamPaper) form.append("is_exam_paper", "true");

      const uploadRes = await fetch("/api/documents", { method: "POST", body: form });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error ?? "Upload failed");

      update({ status: "processing" });
      router.refresh();

      const processRes = await fetch(`/api/documents/${uploadJson.document.id}/process`, {
        method: "POST",
      });
      const processJson = await processRes.json();
      if (!processRes.ok) throw new Error(processJson.error ?? "Processing failed");

      update({ status: "done" });
    } catch (err) {
      update({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      router.refresh();
    }
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
        <span className={styles.hint}>PDF, DOCX, images, audio, video, or .txt/.md notes</span>
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
              {item.status !== "done" && item.status !== "error" && (
                <Loader2 size={14} className={styles.spinner} />
              )}
              <span className={styles.uploadName}>{item.name}</span>
              <span className={styles.uploadStatus} data-status={item.status}>
                {item.status === "error" ? item.message : item.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
