"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteDocument, retryDocumentProcessing } from "@/lib/actions/documents";
import styles from "./DocumentRowActions.module.css";

export function DocumentRowActions({
  documentId,
  documentTitle,
  status,
}: {
  documentId: string;
  documentTitle: string;
  status: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retryPending, startRetry] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const canRetry = status === "uploaded" || status === "error";

  function handleDelete() {
    const form = new FormData();
    form.append("documentId", documentId);
    startDelete(() => {
      deleteDocument(form);
    });
    setConfirmOpen(false);
  }

  function handleRetry() {
    const form = new FormData();
    form.append("documentId", documentId);
    startRetry(() => {
      retryDocumentProcessing(form);
    });
  }

  return (
    <>
      <div className={styles.actions}>
        {canRetry && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Retry processing"
            disabled={retryPending || deletePending}
            onClick={handleRetry}
          >
            <RefreshCw size={13} className={retryPending ? styles.spinning : undefined} />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Delete document"
          disabled={retryPending || deletePending}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 size={13} className={styles.deleteIcon} />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Delete &quot;{documentTitle}&quot;?</DialogTitle>
            <DialogDescription>
              This removes the file and every chunk generated from it. Study tools
              already generated from this material won&rsquo;t be affected. This
              can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deletePending} onClick={handleDelete}>
              Delete document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
