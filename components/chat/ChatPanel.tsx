"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  FileText,
  Send,
  Mic,
  Play,
  Pause,
  GraduationCap,
  AlertCircle,
  Sparkles,
  BookOpen,
  Lightbulb,
  Compass,
  HelpCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  Calculator,
  RotateCcw,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleMarkdown } from "@/components/study/SimpleMarkdown";
import { MediaPlayer } from "@/components/document/MediaPlayer";
import { SlideViewer, type SlideChunk } from "@/components/document/SlideViewer";
import { DocumentReader } from "@/components/document/DocumentReader";
import type { ChatSource } from "@/app/api/chat/route";
import styles from "./ChatPanel.module.css";

interface SourceDoc {
  id: string;
  title: string;
  status: string;
  type: string;
}

interface ConceptItem {
  id: string;
  name: string;
}

interface PromptSuggestion {
  id: string;
  category: string;
  title: string;
  prompt: string;
  iconType: "summary" | "concept" | "compare" | "quiz" | "formula";
}

interface ActiveDocPreview {
  documentId: string;
  documentTitle: string;
  type?: string;
  pageRef?: number | null;
  timestampRef?: number | null;
}

function generatePromptSuggestions(
  courseName: string,
  documents: SourceDoc[],
  concepts: ConceptItem[],
  tutorMode: boolean,
  seed: number,
): PromptSuggestion[] {
  const readyDocs = documents.filter((d) => d.status === "ready" || !d.status);
  const pool: PromptSuggestion[] = [];

  if (tutorMode) {
    if (concepts.length > 0) {
      concepts.forEach((c, idx) => {
        pool.push({
          id: `tutor-c-${idx}`,
          category: "Socratic Inquiry",
          title: `Quiz me: ${c.name}`,
          prompt: `Quiz me step-by-step on ${c.name} without revealing the answer immediately.`,
          iconType: "concept",
        });
      });
    }
    if (readyDocs.length > 0) {
      readyDocs.forEach((d, idx) => {
        pool.push({
          id: `tutor-d-${idx}`,
          category: "Active Recall",
          title: `Challenge me: ${d.title}`,
          prompt: `Guide me through the hardest concept in ${d.title} by asking me diagnostic questions.`,
          iconType: "quiz",
        });
      });
    }
    pool.push({
      id: "tutor-diagnostic",
      category: "Oral Exam",
      title: "Evaluate my mastery",
      prompt: `Act as a strict but encouraging professor. Ask me 3 probing questions to evaluate my mastery of ${courseName}.`,
      iconType: "quiz",
    });
  } else {
    // 1. Document Deep Dives
    if (readyDocs.length > 0) {
      readyDocs.forEach((d, idx) => {
        pool.push({
          id: `doc-sum-${idx}`,
          category: "Document Overview",
          title: `Summarize "${d.title}"`,
          prompt: `Summarize the core arguments and key takeaways from ${d.title}.`,
          iconType: "summary",
        });
        pool.push({
          id: `doc-form-${idx}`,
          category: "Formulas & Definitions",
          title: `Key formulas in "${d.title}"`,
          prompt: `Extract and explain the most crucial formulas, definitions, and theorems in ${d.title}.`,
          iconType: "formula",
        });
      });
    }

    // 2. Concept Deep Dives
    if (concepts.length > 0) {
      concepts.forEach((c, idx) => {
        pool.push({
          id: `conc-exp-${idx}`,
          category: "Core Concept",
          title: `Explain ${c.name}`,
          prompt: `Explain ${c.name} intuitively with a real-world analogy and step-by-step intuition.`,
          iconType: "concept",
        });
      });

      if (concepts.length >= 2) {
        for (let i = 0; i < concepts.length - 1; i += 2) {
          const c1 = concepts[i];
          const c2 = concepts[i + 1];
          pool.push({
            id: `conc-comp-${i}`,
            category: "Synthesis",
            title: `${c1.name} vs. ${c2.name}`,
            prompt: `Compare and contrast ${c1.name} and ${c2.name}. How do they relate and differ?`,
            iconType: "compare",
          });
        }
      }
    }

    // 3. Exam & Practice Questions
    if (readyDocs.length > 0 || concepts.length > 0) {
      pool.push({
        id: "practice-quiz",
        category: "Exam Prep",
        title: "Practice questions with answers",
        prompt: `Generate 3 challenging conceptual exam questions from the material with detailed step-by-step explanations.`,
        iconType: "quiz",
      });
    }

    // Fallbacks if empty
    if (pool.length === 0) {
      pool.push(
        {
          id: "fb-overview",
          category: "Orientation",
          title: `Overview of ${courseName}`,
          prompt: `Give me a structured overview of what topics are covered in ${courseName}.`,
          iconType: "summary",
        },
        {
          id: "fb-foundations",
          category: "Foundations",
          title: "Foundational concepts",
          prompt: `What are the most essential foundational principles I need to understand for ${courseName}?`,
          iconType: "concept",
        },
        {
          id: "fb-study-guide",
          category: "Study Guide",
          title: "Create a revision plan",
          prompt: `Create a prioritized study roadmap for mastering ${courseName}.`,
          iconType: "quiz",
        },
      );
    }
  }

  // Pick up to 4 items cyclically based on seed
  const count = Math.min(4, pool.length);
  const result: PromptSuggestion[] = [];
  for (let i = 0; i < count; i++) {
    const pickIdx = (seed + i) % pool.length;
    result.push(pool[pickIdx]);
  }
  return result;
}

interface SpeechRecognitionLike {
  start(): void;
  stop(): void;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function formatTimestamp(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function citationLabel(s: ChatSource): string {
  if (s.timestampRef !== null) return `${s.documentTitle} · ${formatTimestamp(s.timestampRef)}`;
  if (s.pageRef !== null) return `${s.documentTitle}, p. ${s.pageRef}`;
  return s.documentTitle;
}

const RATES = [0.75, 1, 1.25, 1.5] as const;

function SpeechControls({
  messageId,
  text,
  speakingId,
  paused,
  rate,
  onToggle,
  onRateChange,
}: {
  messageId: string;
  text: string;
  speakingId: string | null;
  paused: boolean;
  rate: number;
  onToggle: (id: string, text: string) => void;
  onRateChange: (id: string, text: string, rate: number) => void;
}) {
  const isThis = speakingId === messageId;
  const isPlaying = isThis && !paused;

  return (
    <div className={styles.speechControls}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => onToggle(messageId, text)}
        aria-label={isPlaying ? "Pause reading this reply" : "Read this reply aloud"}
      >
        {isPlaying ? <Pause size={13} /> : <Play size={13} />}
      </Button>
      <div className={styles.rateGroup}>
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            className={styles.rateButton}
            data-active={isThis && rate === r}
            onClick={() => onRateChange(messageId, text, r)}
          >
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}

function getSuggestionIcon(type: PromptSuggestion["iconType"]) {
  switch (type) {
    case "summary":
      return <BookOpen size={14} />;
    case "concept":
      return <Lightbulb size={14} />;
    case "compare":
      return <Layers size={14} />;
    case "quiz":
      return <HelpCircle size={14} />;
    case "formula":
      return <Calculator size={14} />;
    default:
      return <Sparkles size={14} />;
  }
}

export function ChatPanel({
  courseId,
  courseName,
  documents,
  concepts = [],
  initialMessages = [],
}: {
  courseId: string;
  courseName: string;
  documents: SourceDoc[];
  concepts?: ConceptItem[];
  initialMessages?: UIMessage[];
}) {
  const [input, setInput] = useState("");
  const [tutorMode, setTutorMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [promptSeed, setPromptSeed] = useState(0);
  const [clearing, setClearing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ courseId }),
      }),
  );
  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    messages: initialMessages,
  });

  const pending = status === "submitted" || status === "streaming";

  // 1. Sync from localStorage if server has no messages yet (offline fallback)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(`lorebook_chat_${courseId}`);
      if (saved && initialMessages.length === 0 && messages.length === 0) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [courseId, initialMessages.length, messages.length, setMessages]);

  // 2. Persist to localStorage on every update
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (messages.length > 0) {
        localStorage.setItem(`lorebook_chat_${courseId}`, JSON.stringify(messages));
      }
    } catch {
      // ignore
    }
  }, [messages, courseId]);

  async function handleClearChat() {
    if (typeof window !== "undefined" && !window.confirm("Start a new conversation? This will clear current chat history.")) {
      return;
    }
    setClearing(true);
    try {
      setMessages([]);
      if (typeof window !== "undefined") {
        localStorage.removeItem(`lorebook_chat_${courseId}`);
      }
      await fetch("/api/chat/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  }

  // Dynamic suggested prompts
  const suggestions = generatePromptSuggestions(
    courseName,
    documents,
    concepts,
    tutorMode,
    promptSeed,
  );

  function handlePromptClick(promptText: string) {
    if (pending) return;
    sendMessage({ text: promptText }, { body: { courseId, tutorMode } });
  }

  function handleShufflePrompts() {
    setPromptSeed((prev) => prev + 3);
  }

  // Speech-recognition support depends on `window`, so it must start out
  // false on both server and first client render (they need to match for
  // hydration) and only flip on after mount — otherwise the mic button
  // exists in the client tree but not the server tree, which shifts every
  // node after it (including the submit button) and breaks hydration.
  const [voiceSupported, setVoiceSupported] = useState(false);
  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  function toggleTutorMode() {
    const turningOn = !tutorMode;
    setTutorMode(turningOn);
    if (turningOn) {
      sendMessage(
        { text: "Start tutoring me on this material." },
        { body: { courseId, tutorMode: true } },
      );
    }
  }

  function toggleListening() {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) return;
    setVoiceError(null);
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const result = event as { results: { transcript: string }[][] };
      const transcript = result.results?.[0]?.[0]?.transcript ?? "";
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = (event) => {
      const err = (event as { error?: string }).error ?? "unknown";
      const message =
        err === "not-allowed" || err === "service-not-allowed"
          ? "Microphone access was blocked — allow it in your browser's site settings."
          : err === "network"
            ? "Voice input needs a network connection some browsers (e.g. Brave, with Shields on) block by default."
            : err === "no-speech"
              ? "Didn't catch that — try again."
              : `Voice input failed (${err}).`;
      setVoiceError(message);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setVoiceError("Couldn't start voice input.");
    }
  }

  function speakFrom(id: string, text: string, atRate: number) {
    if (typeof window === "undefined" || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = atRate;
    utterance.onend = () => {
      setSpeakingId((current) => (current === id ? null : current));
      setPaused(false);
    };
    setSpeakingId(id);
    setPaused(false);
    window.speechSynthesis.speak(utterance);
  }

  function handleTogglePlay(id: string, text: string) {
    if (speakingId !== id) {
      speakFrom(id, text, rate);
      return;
    }
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }

  function handleRateChange(id: string, text: string, newRate: number) {
    setRate(newRate);
    if (speakingId === id) speakFrom(id, text, newRate);
  }

  const [activePreview, setActivePreview] = useState<ActiveDocPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSignedUrl, setPreviewSignedUrl] = useState<string | null>(null);
  const [previewDocType, setPreviewDocType] = useState<string>("pdf");
  const [previewChunks, setPreviewChunks] = useState<SlideChunk[]>([]);

  async function handleOpenPreview(target: ActiveDocPreview) {
    setActivePreview(target);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/documents/${target.documentId}/preview`);
      if (res.ok) {
        const data = await res.json();
        setPreviewSignedUrl(data.signedUrl ?? null);
        setPreviewDocType(data.type ?? target.type ?? "pdf");
        setPreviewChunks(data.chunks ?? []);
      }
    } catch (err) {
      console.error("Failed to load document preview", err);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || pending) return;
    sendMessage({ text: input }, { body: { courseId, tutorMode } });
    setInput("");
  }

  return (
    <div className={styles.wrap} data-tutor={tutorMode} data-preview={!!activePreview}>
      <aside className={styles.sidebar}>
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <div className={styles.courseName}>{courseName}</div>

        <div className={styles.modeRow}>
          <Button
            type="button"
            variant={tutorMode ? "default" : "outline"}
            size="sm"
            onClick={toggleTutorMode}
          >
            <GraduationCap size={14} />
            Tutor mode
          </Button>

          {messages.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              disabled={clearing || pending}
              className={styles.resetBtn}
              title="Start a new conversation and clear chat history"
            >
              <RotateCcw size={13} />
              Reset
            </Button>
          )}
        </div>
        {tutorMode && (
          <p className={styles.modeHint} data-active="true">
            Tutor mode is on — I&apos;ll ask you questions instead of just
            answering, starting with your next message.
          </p>
        )}

        <div className={styles.sourceList}>
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() =>
                handleOpenPreview({
                  documentId: doc.id,
                  documentTitle: doc.title,
                  type: doc.type,
                  pageRef: 1,
                })
              }
              className={styles.sourceItem}
              data-status={doc.status}
              data-active={activePreview?.documentId === doc.id}
              title={doc.title}
            >
              <FileText size={14} className={styles.sourceIcon} />
              <span className={styles.sourceTitle}>{doc.title}</span>
            </button>
          ))}
          {documents.length === 0 && (
            <p className={styles.empty}>No documents in this course yet.</p>
          )}
        </div>
      </aside>

      <div className={styles.chatArea}>
        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.emptyStateContainer}>
              <div className={styles.emptyStateBanner}>
                <div className={styles.emptyStateBadge}>
                  <Sparkles size={13} />
                  <span>LoreBook Knowledge Scribe</span>
                </div>
                <h2 className={styles.emptyStateHeading}>Inquire into {courseName}</h2>
                <p className={styles.emptyStateSub}>
                  Interrogate your course manuscripts, test concepts, or explore the curated lines of inquiry below.
                </p>
              </div>

              <div className={styles.suggestionsSection}>
                <div className={styles.suggestionsHeader}>
                  <div className={styles.suggestionsTitle}>
                    <Compass size={15} />
                    <span>Suggested Lines of Inquiry</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleShufflePrompts}
                    className={styles.shuffleButton}
                    title="Explore more questions"
                  >
                    <RefreshCw size={12} />
                    <span>Shuffle prompts</span>
                  </button>
                </div>

                <div className={styles.suggestionsGrid}>
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.suggestionCard}
                      onClick={() => handlePromptClick(s.prompt)}
                      disabled={pending}
                    >
                      <div className={styles.suggestionCardTop}>
                        <span className={styles.suggestionCategory}>
                          {getSuggestionIcon(s.iconType)}
                          {s.category}
                        </span>
                        <span className={styles.suggestionArrow}>
                          <ArrowRight size={13} />
                        </span>
                      </div>
                      <h3 className={styles.suggestionCardTitle}>{s.title}</h3>
                      <p className={styles.suggestionCardPrompt}>&ldquo;{s.prompt}&rdquo;</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {messages.map((message) => {
            const sources = (message.metadata as { sources?: ChatSource[] } | undefined)
              ?.sources;
            const text = message.parts
              .filter((part) => part.type === "text")
              .map((part) => (part as { text: string }).text)
              .join("");

            const sourceByIndex = new Map((sources ?? []).map((s) => [s.index, s]));

            return (
              <div key={message.id} className={styles.messageRow} data-role={message.role}>
                <div className={styles.bubble} data-role={message.role}>
                  {message.role === "assistant" ? (
                    <SimpleMarkdown
                      text={text}
                      renderCitation={(n) => {
                        const s = sourceByIndex.get(n);
                        if (!s) return `[${n}]`;
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenPreview({
                                documentId: s.documentId,
                                documentTitle: s.documentTitle,
                                pageRef: s.pageRef,
                                timestampRef: s.timestampRef,
                              })
                            }
                            className={styles.inlineCitationBtn}
                            title={citationLabel(s)}
                          >
                            [{n}]
                          </button>
                        );
                      }}
                    />
                  ) : (
                    <div className={styles.bubbleText}>{text}</div>
                  )}

                  {message.role === "assistant" && text.trim() && (
                    <SpeechControls
                      messageId={message.id}
                      text={text}
                      speakingId={speakingId}
                      paused={paused}
                      rate={rate}
                      onToggle={handleTogglePlay}
                      onRateChange={handleRateChange}
                    />
                  )}

                  {(() => {
                    const citedNumbers = new Set(
                      [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])),
                    );
                    const usedSources = (sources ?? []).filter((s) => citedNumbers.has(s.index));

                    if (usedSources.length === 0) return null;

                    return (
                      <div className={styles.citations}>
                        {usedSources.map((s) => (
                          <button
                            key={s.index}
                            type="button"
                            onClick={() =>
                              handleOpenPreview({
                                documentId: s.documentId,
                                documentTitle: s.documentTitle,
                                pageRef: s.pageRef,
                                timestampRef: s.timestampRef,
                              })
                            }
                            className={styles.citationChipBtn}
                            title={citationLabel(s)}
                          >
                            [{s.index}] {citationLabel(s)}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {voiceError && (
          <p className={styles.error}>
            <AlertCircle size={13} />
            {voiceError}
          </p>
        )}
        {error && <p className={styles.error}>{error.message}</p>}

        <form onSubmit={handleSubmit} className={styles.inputBar}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              tutorMode ? "Answer, or ask for a hint…" : "Ask about this course's material…"
            }
            disabled={pending}
          />
          {voiceSupported && (
            <Button
              type="button"
              variant={listening ? "default" : "outline"}
              size="icon"
              onClick={toggleListening}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
            >
              <Mic size={16} />
            </Button>
          )}
          <Button type="submit" disabled={pending || !input.trim()} size="icon">
            <Send size={16} />
          </Button>
        </form>
      </div>

      {activePreview && (
        <aside className={styles.inspectorPanel}>
          <div className={styles.inspectorHeader}>
            <div className={styles.inspectorTitleWrap}>
              <FileText size={15} className={styles.inspectorIcon} />
              <span className={styles.inspectorTitle} title={activePreview.documentTitle}>
                {activePreview.documentTitle}
              </span>
            </div>
            <div className={styles.inspectorActions}>
              {activePreview.pageRef && (
                <span className={styles.inspectorPageBadge}>Page {activePreview.pageRef}</span>
              )}
              {activePreview.timestampRef !== null && activePreview.timestampRef !== undefined && (
                <span className={styles.inspectorPageBadge}>{formatTimestamp(activePreview.timestampRef)}</span>
              )}
              {previewSignedUrl && (
                <a
                  href={previewSignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.inspectorOpenBtn}
                  title="Open full document"
                >
                  <ExternalLink size={13} />
                </a>
              )}
              <button
                type="button"
                onClick={() => setActivePreview(null)}
                className={styles.inspectorCloseBtn}
                title="Close document viewer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className={styles.inspectorBody}>
            {previewLoading ? (
              <div className={styles.inspectorLoading}>
                <div className={styles.spinner} />
                <span>Opening document at citation...</span>
              </div>
            ) : previewDocType === "pdf" && previewSignedUrl ? (
              <iframe
                key={`${previewSignedUrl}#page=${activePreview.pageRef ?? 1}`}
                src={`${previewSignedUrl}#page=${activePreview.pageRef ?? 1}`}
                className={styles.inspectorIframe}
                title={activePreview.documentTitle}
              />
            ) : previewDocType === "image" && previewSignedUrl ? (
              <div className={styles.inspectorImageWrap}>
                <img src={previewSignedUrl} alt={activePreview.documentTitle} className={styles.inspectorImage} />
              </div>
            ) : (previewDocType === "audio" || previewDocType === "video") && previewSignedUrl ? (
              <div className={styles.inspectorMediaWrap}>
                <MediaPlayer
                  src={previewSignedUrl}
                  kind={previewDocType as "audio" | "video"}
                  startAt={activePreview.timestampRef ?? undefined}
                />
              </div>
            ) : previewDocType === "pptx" || previewDocType === "ppt" ? (
              <SlideViewer
                chunks={previewChunks}
                initialSlide={activePreview.pageRef ?? 1}
                title={activePreview.documentTitle}
                signedUrl={previewSignedUrl}
              />
            ) : previewChunks.length > 0 || previewSignedUrl ? (
              <DocumentReader
                chunks={previewChunks}
                initialPage={activePreview.pageRef ?? 1}
                title={activePreview.documentTitle}
                signedUrl={previewSignedUrl}
              />
            ) : (
              <div className={styles.inspectorError}>
                <p>Unable to load preview for this file.</p>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
