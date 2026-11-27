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
  const [error, setError] = useState<string | null>(null);

  async function createLink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/course-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const json = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !json?.id) {
        throw new Error(json?.error ?? `Couldn't create an invite link (HTTP ${res.status}).`);
      }
      setLink(`${window.location.origin}/join/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create an invite link.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && !link && !loading) void createLink();
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy automatically — select the link and copy it.");
    }
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
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to this course</DialogTitle>
          <DialogDescription>
            Anyone with this link can join for the next 7 days and study alongside you —
            browse the material, chat, take quizzes, review flashcards.
          </DialogDescription>
        </DialogHeader>
        {loading && <p className={styles.hint}>Generating link…</p>}
        {error && (
          <div className={styles.errorRow} role="alert">
            <p className={styles.error}>{error}</p>
            {!link && (
              <Button type="button" size="sm" variant="outline" onClick={createLink} disabled={loading}>
                Try again
              </Button>
            )}
          </div>
        )}
        {link && (
          <div className={`${styles.linkRow} min-w-0`}>
            <span className={`${styles.link} break-all`}>{link}</span>
            <Button type="button" size="icon-sm" variant="outline" onClick={copyLink}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
