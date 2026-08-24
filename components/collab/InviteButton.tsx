"use client";

import { useState } from "react";
import { UserPlus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import styles from "./InviteButton.module.css";

export function InviteButton({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && !link) {
      setLoading(true);
      try {
        const res = await fetch("/api/course-invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId }),
        });
        const json = await res.json();
        if (res.ok) setLink(`${window.location.origin}/join/${json.id}`);
      } finally {
        setLoading(false);
      }
    }
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleOpen(true)}
      >
        <UserPlus size={14} />
        Invite
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to this course</DialogTitle>
          <DialogDescription>
            Anyone with this link can join and study alongside you — browse the material,
            chat, take quizzes, review flashcards.
          </DialogDescription>
        </DialogHeader>
        {loading && <p className={styles.hint}>Generating link…</p>}
        {link && (
          <div className={styles.linkRow}>
            <span className={styles.link}>{link}</span>
            <Button type="button" size="icon-sm" variant="outline" onClick={copyLink}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
