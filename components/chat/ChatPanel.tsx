"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FileText, Send, Mic, Volume2, VolumeX, GraduationCap } from "lucide-react";
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
  const [speakReplies, setSpeakReplies] = useState(false);
  const [listening, setListening] = useState(false);
  const tutorModeRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const spokenIdsRef = useRef(new Set<string>());

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ courseId, tutorMode: tutorModeRef.current }),
      }),
  );
  const { messages, sendMessage, status, error } = useChat({ transport });

  const pending = status === "submitted" || status === "streaming";
  const SpeechRecognitionCtor = getSpeechRecognition();

  function toggleTutorMode() {
    const next = !tutorMode;
    tutorModeRef.current = next;
    setTutorMode(next);
  }

  function toggleListening() {
    if (!SpeechRecognitionCtor) return;
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
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  // Read the latest assistant reply aloud once it finishes, if enabled.
  useEffect(() => {
    if (!speakReplies || pending || typeof window === "undefined") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || spokenIdsRef.current.has(last.id)) return;

    const text = last.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { text: string }).text)
      .join(" ");
    if (!text.trim()) return;

    spokenIdsRef.current.add(last.id);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }, [messages, pending, speakReplies]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || pending) return;
    sendMessage({ text: input });
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
          <Button
            type="button"
            variant={speakReplies ? "default" : "outline"}
            size="icon-sm"
            onClick={() => setSpeakReplies((v) => !v)}
            aria-label={speakReplies ? "Mute spoken replies" : "Read replies aloud"}
          >
            {speakReplies ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </Button>
        </div>
        {tutorMode && (
          <p className={styles.modeHint}>
            Tutor mode: I&apos;ll ask you questions instead of just answering.
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
            return (
              <div key={message.id} className={styles.messageRow} data-role={message.role}>
                <div className={styles.bubble} data-role={message.role}>
                  {message.parts
                    .filter((part) => part.type === "text")
                    .map((part, i) => (
                      <span key={i}>{(part as { text: string }).text}</span>
                    ))}

                  {sources && sources.length > 0 && (
                    <div className={styles.citations}>
                      {sources.map((s) =>
                        s.timestampRef !== null ? (
                          <Link
                            key={s.index}
                            href={`/document/${s.documentId}?t=${Math.floor(s.timestampRef)}`}
                            className={styles.citationChip}
                          >
                            [{s.index}] {s.documentTitle} · {formatTimestamp(s.timestampRef)}
                          </Link>
                        ) : (
                          <span key={s.index} className={styles.citationChip}>
                            [{s.index}] {s.documentTitle}
                            {s.pageRef ? `, p. ${s.pageRef}` : ""}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

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
          {SpeechRecognitionCtor && (
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
