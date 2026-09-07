"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  LayoutList,
  Presentation,
  FileText,
  RefreshCw,
} from "lucide-react";
import { SimpleMarkdown } from "@/components/study/SimpleMarkdown";
import styles from "./SlideViewer.module.css";

export interface SlideChunk {
  chunk_index: number;
  content: string;
  page_ref: number | null;
  timestamp_ref?: number | null;
}

interface SlideData {
  slideNumber: number;
  title: string;
  body: string;
  rawText: string;
}

export function parseSlidesFromChunks(chunks: SlideChunk[]): SlideData[] {
  if (!chunks || chunks.length === 0) return [];

  // Group chunks by page_ref (which represents Slide number in PPTX)
  const map = new Map<number, string[]>();
  let fallbackSlideIdx = 1;

  for (const c of chunks) {
    let pNum = c.page_ref;
    if (pNum === null || pNum === undefined || pNum === 0) {
      const match = c.content.match(/^\[Slide\s*(\d+)\]/i);
      if (match) {
        pNum = parseInt(match[1], 10);
      } else {
        pNum = fallbackSlideIdx;
      }
    }
    if (!map.has(pNum)) {
      map.set(pNum, []);
    }
    map.get(pNum)!.push(c.content);
    fallbackSlideIdx = pNum + 1;
  }

  const sortedPageNums = Array.from(map.keys()).sort((a, b) => a - b);
  return sortedPageNums.map((pNum) => {
    const fullContent = map.get(pNum)!.join("\n\n").trim();
    // Strip leading [Slide X] tags
    const cleaned = fullContent.replace(/^\[Slide\s*\d+\]\s*/i, "").trim();
    const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);

    let title = `Slide ${pNum}`;
    let body = cleaned;

    if (lines.length > 0 && lines[0].length < 120 && !lines[0].startsWith("-") && !lines[0].startsWith("*")) {
      title = lines[0].replace(/^#+\s*/, "");
      body = lines.slice(1).join("\n\n");
    }

    return {
      slideNumber: pNum,
      title,
      body,
      rawText: cleaned,
    };
  });
}

export function SlideViewer({
  chunks = [],
  initialSlide = 1,
  title,
  signedUrl,
}: {
  chunks: SlideChunk[];
  initialSlide?: number;
  title?: string;
  signedUrl?: string | null;
}) {
  const slides = useMemo(() => parseSlidesFromChunks(chunks), [chunks]);

  // View modes: "visual" (Office/Google rendered slides) vs "outline" (text deck)
  const [viewMode, setViewMode] = useState<"visual" | "outline">(() => (signedUrl ? "visual" : "outline"));
  const [engine, setEngine] = useState<"office" | "google">("office");
  const [iframeLoading, setIframeLoading] = useState(true);

  // Outline sub-mode: "single" vs "all"
  const [outlineMode, setOutlineMode] = useState<"single" | "all">("single");

  const [currentIndex, setCurrentIndex] = useState(() => {
    const foundIdx = slides.findIndex((s) => s.slideNumber === initialSlide);
    return foundIdx >= 0 ? foundIdx : 0;
  });

  // Keep index updated if initialSlide changes
  useEffect(() => {
    if (slides.length === 0) return;
    const targetIdx = slides.findIndex((s) => s.slideNumber === initialSlide);
    if (targetIdx >= 0) {
      setCurrentIndex(targetIdx);
    }
  }, [initialSlide, slides]);

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

  const currentSlide = slides[currentIndex] || slides[0];

  return (
    <div className={styles.container}>
      {/* Main Top Header Bar */}
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
                <Presentation size={13} />
                Visual Slides
              </button>
            )}
            <button
              type="button"
              className={styles.tabBtn}
              data-active={viewMode === "outline"}
              onClick={() => setViewMode("outline")}
            >
              <FileText size={13} />
              Outline & Text
            </button>
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
                title="Google Docs Slides Viewer"
              >
                Google
              </button>
            </div>
          )}

          {viewMode === "outline" && slides.length > 0 && (
            <div className={styles.outlineControls}>
              <div className={styles.navBtns}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex <= 0}
                  title="Previous slide"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className={styles.counterText}>
                  {currentSlide?.slideNumber ?? 1} / {slides.length}
                </span>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => setCurrentIndex((prev) => Math.min(slides.length - 1, prev + 1))}
                  disabled={currentIndex >= slides.length - 1}
                  title="Next slide"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={styles.toggleBtn}
                  data-active={outlineMode === "single"}
                  onClick={() => setOutlineMode("single")}
                  title="Single slide"
                >
                  <Layers size={13} />
                </button>
                <button
                  type="button"
                  className={styles.toggleBtn}
                  data-active={outlineMode === "all"}
                  onClick={() => setOutlineMode("all")}
                  title="All slides"
                >
                  <LayoutList size={13} />
                </button>
              </div>
            </div>
          )}

          {signedUrl && (
            <a
              href={signedUrl}
              download={title || "presentation.pptx"}
              className={styles.actionIconBtn}
              title="Download original PowerPoint file"
            >
              <Download size={13} />
            </a>
          )}
        </div>
      </div>

      {/* Viewer Content Area */}
      <div className={styles.mainViewport}>
        {viewMode === "visual" && activeEmbedUrl ? (
          <div className={styles.visualContainer}>
            {iframeLoading && (
              <div className={styles.visualLoadingOverlay}>
                <RefreshCw size={22} className={styles.spinIcon} />
                <span>Loading PowerPoint Presentation Viewer...</span>
              </div>
            )}
            <iframe
              key={activeEmbedUrl}
              src={activeEmbedUrl}
              className={styles.visualIframe}
              title={title || "PowerPoint Presentation"}
              allowFullScreen
              onLoad={() => setIframeLoading(false)}
            />
          </div>
        ) : slides.length === 0 ? (
          <div className={styles.emptyWrap}>
            <Presentation size={36} className={styles.emptyIcon} />
            <h4 className={styles.emptyTitle}>{title || "Presentation"}</h4>
            <p className={styles.emptyText}>
              No slide outline extracted. You can view the visual presentation or download the file.
            </p>
            {signedUrl && (
              <a href={signedUrl} download={title || "presentation.pptx"} className={styles.downloadBtn}>
                <Download size={14} />
                Download .pptx
              </a>
            )}
          </div>
        ) : outlineMode === "single" && currentSlide ? (
          <div className={styles.singleViewWrap}>
            <div className={styles.slideCard}>
              <div className={styles.slideHeaderRow}>
                <div className={styles.slideTag}>SLIDE {String(currentSlide.slideNumber).padStart(2, "0")}</div>
                <div className={styles.slideTitleDecor} />
              </div>

              <h3 className={styles.slideHeading}>{currentSlide.title}</h3>

              <div className={styles.slideBody}>
                {currentSlide.body ? (
                  <SimpleMarkdown text={currentSlide.body} />
                ) : (
                  <p className={styles.noBodyText}>[Slide title only]</p>
                )}
              </div>
            </div>

            {/* Quick Slide Navigation Ribbon */}
            <div className={styles.ribbonWrap}>
              <span className={styles.ribbonLabel}>Jump to:</span>
              <div className={styles.ribbonScroll}>
                {slides.map((s, idx) => (
                  <button
                    key={s.slideNumber}
                    type="button"
                    className={styles.ribbonChip}
                    data-active={idx === currentIndex}
                    onClick={() => setCurrentIndex(idx)}
                    title={`Slide ${s.slideNumber}: ${s.title}`}
                  >
                    {s.slideNumber}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.allSlidesStack}>
            {slides.map((slide, idx) => (
              <div
                key={slide.slideNumber}
                id={`slide-${slide.slideNumber}`}
                className={styles.slideCard}
                data-highlighted={idx === currentIndex}
              >
                <div className={styles.slideHeaderRow}>
                  <div className={styles.slideTag}>SLIDE {String(slide.slideNumber).padStart(2, "0")}</div>
                  <div className={styles.slideTitleDecor} />
                </div>

                <h3 className={styles.slideHeading}>{slide.title}</h3>

                <div className={styles.slideBody}>
                  {slide.body ? (
                    <SimpleMarkdown text={slide.body} />
                  ) : (
                    <p className={styles.noBodyText}>[Slide title only]</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

