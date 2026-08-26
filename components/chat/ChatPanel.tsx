"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  FileText,
  Send,
  Mic,
  Play,
  Pause,
  GraduationCap,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatSource } from "@/app/api/chat/route";
import styles from "./ChatPanel.module.css";

interface SourceDoc {
  id: string;
  title: string;
  status: string;
  type: string;
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

const RATES = [0.75, 1, 1.25, 1.5] as const;

/** Play/pause + speed control for one assistant reply. Only one message can
 * be speaking at a time (the Web Speech API has a single global queue), so
 * playback state is owned by the parent and passed in. */
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

export function ChatPanel({
  courseId,
  courseName,
  documents,
}: {
  courseId: string;
  courseName: string;
  documents: SourceDoc[];
}) {
  const [input, setInput] = useState("");
  const [tutorMode, setTutorMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ courseId }),
      }),
  );
  const { messages, sendMessage, status, error } = useChat({ transport });

  const pending = status === "submitted" || status === "streaming";

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
    setTutorMode((v) => !v);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || pending) return;
    sendMessage({ text: input }, { body: { courseId, tutorMode } });
    setInput("");
  }

  return (
    <div className={styles.wrap}>
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
        </div>
        {tutorMode && (
          <p className={styles.modeHint} data-active="true">
            Tutor mode is on — I&apos;ll ask you questions instead of just
            answering, starting with your next message.
          </p>
        )}

        <div className={styles.sourceList}>
          {documents.map((doc) => {
            const isMedia = doc.type === "audio" || doc.type === "video";
            const content = (
              <>
                <FileText size={14} />
                <span className={styles.sourceTitle}>{doc.title}</span>
              </>
            );
            return isMedia ? (
              <Link
                key={doc.id}
                href={`/document/${doc.id}`}
                className={`${styles.sourceItem} hover-lift`}
                data-status={doc.status}
              >
                {content}
              </Link>
            ) : (
              <div key={doc.id} className={styles.sourceItem} data-status={doc.status}>
                {content}
              </div>
            );
          })}
          {documents.length === 0 && (
            <p className={styles.empty}>No documents in this course yet.</p>
          )}
        </div>
      </aside>

      <div className={styles.chatArea}>
        <div className={styles.messages}>
          {messages.length === 0 && (
            <p className={styles.empty}>
              Ask anything about the material in {courseName}. Answers cite the
              source document by name (and page or timestamp, where available).
            </p>
          )}
          {messages.map((message) => {
            const sources = (message.metadata as { sources?: ChatSource[] } | undefined)
              ?.sources;
            const text = message.parts
              .filter((part) => part.type === "text")
              .map((part) => (part as { text: string }).text)
              .join("");

            return (
              <div key={message.id} className={styles.messageRow} data-role={message.role}>
                <div className={styles.bubble} data-role={message.role}>
                  <div className={styles.bubbleText}>{text}</div>

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

                  {sources && sources.length > 0 && (
                    <div className={styles.citations}>
                      {sources.map((s) =>
                        s.timestampRef !== null ? (
                          <Link
                            key={s.index}
                            href={`/document/${s.documentId}?t=${Math.floor(s.timestampRef)}`}
                            className={styles.citationChip}
                            target="_blank"
                          >
                            [{s.index}] {s.documentTitle} · {formatTimestamp(s.timestampRef)}
                          </Link>
                        ) : s.pageRef !== null ? (
                          <Link
                            key={s.index}
                            href={`/document/${s.documentId}?page=${s.pageRef}`}
                            className={styles.citationChip}
                            target="_blank"
                          >
                            [{s.index}] {s.documentTitle}, p. {s.pageRef}
                          </Link>
                        ) : (
                          <Link
                            key={s.index}
                            href={`/document/${s.documentId}`}
                            className={styles.citationChip}
                            target="_blank"
                          >
                            [{s.index}] {s.documentTitle}
                          </Link>
                        ),
                      )}
                    </div>
                  )}
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
    </div>
  );
}
