"use client";

import React, { useMemo, useEffect, useRef, useState } from "react";
import { Download, FileText, RefreshCw, LayoutList, BookOpen } from "lucide-react";
import { SimpleMarkdown } from "@/components/study/SimpleMarkdown";
import styles from "./DocumentReader.module.css";

export interface DocChunk {
  chunk_index: number;
  content: string;
  page_ref: number | null;
  timestamp_ref?: number | null;
}

export function DocumentReader({
  chunks = [],
  initialPage = 1,
  title,
  signedUrl,
}: {
  chunks: DocChunk[];
  initialPage?: number;
  title?: string;
  signedUrl?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Modes: "visual" (Office/Google rendered document) vs "outline" (text sections)
  const [viewMode, setViewMode] = useState<"visual" | "outline">(() => (signedUrl ? "visual" : "outline"));
  const [engine, setEngine] = useState<"office" | "google">("office");
  const [iframeLoading, setIframeLoading] = useState(true);

  // Group chunks into sections / pages
  const sections = useMemo(() => {
    if (!chunks || chunks.length === 0) return [];

    return chunks.map((c, idx) => ({
      index: idx + 1,
      pageRef: c.page_ref ?? idx + 1,
      content: c.content,
    }));
  }, [chunks]);

  // Office & Google Docs URLs
  const officeUrl = useMemo(() => {
    if (!signedUrl) return null;
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`;
  }, [signedUrl]);

  const googleUrl = useMemo(() => {
    if (!signedUrl) return null;
    return `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=true`;
  }, [signedUrl]);

  const activeEmbedUrl = engine === "office" ? officeUrl : googleUrl;

  // Scroll to targeted initialPage if in outline mode
  useEffect(() => {
    if (viewMode === "outline" && initialPage && containerRef.current) {
      const targetEl = containerRef.current.querySelector(`[data-page="${initialPage}"]`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [initialPage, sections, viewMode]);

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Top Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.leftMeta}>
          <div className={styles.modeTabs}>
            {signedUrl && (
              <button
                type="button"
                className={styles.tabBtn}
                data-active={viewMode === "visual"}
                onClick={() => setViewMode("visual")}
              >
                <BookOpen size={13} />
                Visual Document
              </button>
            )}
            {sections.length > 0 && (
              <button
                type="button"
                className={styles.tabBtn}
                data-active={viewMode === "outline"}
                onClick={() => setViewMode("outline")}
              >
                <LayoutList size={13} />
                Text Outline
              </button>
            )}
          </div>
        </div>

        <div className={styles.rightActions}>
          {viewMode === "visual" && signedUrl && (
            <div className={styles.engineSelectWrap}>
              <span className={styles.engineLabel}>Viewer:</span>
              <button
                type="button"
                className={styles.engineBtn}
                data-active={engine === "office"}
                onClick={() => {
                  setEngine("office");
                  setIframeLoading(true);
                }}
                title="Microsoft Office Online Viewer"
              >
                Office
              </button>
              <button
                type="button"
                className={styles.engineBtn}
                data-active={engine === "google"}
                onClick={() => {
                  setEngine("google");
                  setIframeLoading(true);
                }}
                title="Google Docs Viewer"
              >
                Google
              </button>
            </div>
          )}

          {signedUrl && (
            <a
              href={signedUrl}
              download={title || "document.docx"}
              className={styles.actionIconBtn}
              title="Download original Word document"
            >
              <Download size={13} />
            </a>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className={styles.mainViewport}>
        {viewMode === "visual" && activeEmbedUrl ? (
          <div className={styles.visualContainer}>
            {iframeLoading && (
              <div className={styles.visualLoadingOverlay}>
                <RefreshCw size={22} className={styles.spinIcon} />
                <span>Loading Word Document Viewer...</span>
              </div>
            )}
            <iframe
              key={activeEmbedUrl}
              src={activeEmbedUrl}
              className={styles.visualIframe}
              title={title || "Word Document"}
              allowFullScreen
              onLoad={() => setIframeLoading(false)}
            />
          </div>
        ) : sections.length === 0 ? (
          <div className={styles.emptyWrap}>
            <FileText size={36} className={styles.emptyIcon} />
            <h4 className={styles.emptyTitle}>{title || "Document Reader"}</h4>
            <p className={styles.emptyText}>
              No extracted outline text available. You can view the full document using the Visual viewer or download the original file.
            </p>
            {signedUrl && (
              <a href={signedUrl} download={title || "document.docx"} className={styles.downloadBtn}>
                <Download size={14} />
                Download Original File
              </a>
            )}
          </div>
        ) : (
          <div className={styles.contentWrap}>
            {sections.map((sec) => (
              <article
                key={sec.index}
                data-page={sec.pageRef}
                className={styles.sectionCard}
                data-highlighted={sec.pageRef === initialPage}
              >
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionBadge}>Section {sec.pageRef}</span>
                  <div className={styles.sectionDecor} />
                </div>
                <div className={styles.sectionBody}>
                  <SimpleMarkdown text={sec.content} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

