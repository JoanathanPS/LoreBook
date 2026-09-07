"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteAccount } from "@/lib/actions/auth";
import styles from "./DeleteAccountModal.module.css";

export function DeleteAccountModal({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmText.trim().toUpperCase() === "DELETE";

  async function handleDelete() {
    if (!isConfirmed || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await deleteAccount();
        if (res?.error) {
          setError(res.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete account");
      }
    });
  }

  return (
    <div className={styles.dangerBox}>
      <div className={styles.dangerHeader}>
        <AlertTriangle size={20} />
        <span>Danger Zone</span>
      </div>

      <p className={styles.dangerDesc}>
        Permanently delete your LoreBook account (<strong>{userEmail}</strong>) and all associated
        data including courses, uploaded documents, generated flashcards, reels, quizzes, and mastery history.
        This action is irreversible.
      </p>

      <div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="destructive" size="sm">
                <Trash2 size={14} className="mr-1.5" />
                Delete Account
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle size={18} />
                Delete Account
              </DialogTitle>
              <DialogDescription>
                Are you absolutely sure you want to delete your account?
              </DialogDescription>
            </DialogHeader>

            <div className={styles.confirmBody}>
              <ul className={styles.warningList}>
                <li>All your courses and uploaded study documents will be erased.</li>
                <li>All generated flashcard decks, reels, summaries, and quiz scores will be removed.</li>
                <li>Your study streak and XP progress will be lost.</li>
              </ul>

              <div className={styles.inputGroup}>
                <label htmlFor="confirm-delete" className={styles.inputLabel}>
                  Type <strong>DELETE</strong> to confirm:
                </label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>

              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!isConfirmed || isPending}
                onClick={handleDelete}
              >
                {isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                    Deleting...
                  </>
                ) : (
                  "Permanently Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
