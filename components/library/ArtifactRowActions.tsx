"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteArtifact } from "@/lib/actions/artifacts";
import styles from "./ArtifactRowActions.module.css";

export function ArtifactRowActions({
  artifactId,
  artifactTitle,
}: {
  artifactId: string;
  artifactTitle: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${artifactTitle}"? This cannot be undone.`)) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("artifactId", artifactId);
      await deleteArtifact(formData);
    });
  }

  return (
    <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={styles.deleteButton}
        title={`Delete "${artifactTitle}"`}
        disabled={isPending}
        onClick={handleDelete}
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Trash2 size={13} />
        )}
      </Button>
    </div>
  );
}
