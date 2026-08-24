"use client";

import { useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./ChatPanel.module.css";

interface SourceDoc {
  id: string;
  title: string;
  status: string;
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
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { courseId },
    }),
  });

  const pending = status === "submitted" || status === "streaming";

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

        <div className={styles.sourceList}>
          {documents.map((doc) => (
            <div key={doc.id} className={styles.sourceItem} data-status={doc.status}>
              <FileText size={14} />
              <span className={styles.sourceTitle}>{doc.title}</span>
            </div>
          ))}
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
          {messages.map((message) => (
            <div key={message.id} className={styles.messageRow} data-role={message.role}>
              <div className={styles.bubble} data-role={message.role}>
                {message.parts
                  .filter((part) => part.type === "text")
                  .map((part, i) => (
                    <span key={i}>{(part as { text: string }).text}</span>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {error && <p className={styles.error}>{error.message}</p>}

        <form onSubmit={handleSubmit} className={styles.inputBar}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this course's material…"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !input.trim()} size="icon">
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}
