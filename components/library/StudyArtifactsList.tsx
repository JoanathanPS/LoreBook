"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, HelpCircle, Sigma, Film } from "lucide-react";
import { DocumentStatusBadge } from "@/components/library/DocumentStatusBadge";
import { ArtifactRowActions } from "@/components/library/ArtifactRowActions";
import { artifactHref } from "@/lib/study/artifact-links";
import styles from "./StudyArtifactsList.module.css";

export interface ArtifactItem {
  id: string;
  kind: string;
  title: string;
  status: string;
  created_at: string;
  content?: Record<string, unknown> | null;
  error_message?: string | null;
}

const KIND_META: Record<
  string,
  { label: string; icon: typeof BookOpen; iconClass: string }
> = {
  flashcard_deck: {
    label: "Flashcards",
    icon: BookOpen,
    iconClass: styles.iconFlashcards,
  },
  summary: {
    label: "Summary",
    icon: FileText,
    iconClass: styles.iconSummary,
  },
  quiz: {
    label: "Quiz",
    icon: HelpCircle,
    iconClass: styles.iconQuiz,
  },
  formula_sheet: {
    label: "Formula sheet",
    icon: Sigma,
    iconClass: styles.iconFormula,
  },
  reel: {
    label: "Reel",
    icon: Film,
    iconClass: styles.iconReel,
  },
};

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getArtifactBadge(item: ArtifactItem): string | null {
  if (item.kind === "flashcard_deck" && item.content?.cardCount) {
    return `${item.content.cardCount} cards`;
  }
  if (item.kind === "quiz" && Array.isArray(item.content?.questions)) {
    return `${item.content.questions.length} questions`;
  }
  if (item.kind === "summary" && typeof item.content?.text === "string") {
    const words = item.content.text.split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.ceil(words / 200));
    return `${mins} min read`;
  }
  if (item.kind === "reel" && Array.isArray(item.content?.cards)) {
    return `${item.content.cards.length} slides`;
  }
  return null;
}

export function StudyArtifactsList({
  artifacts,
  isOwner,
}: {
  artifacts: ArtifactItem[];
  isOwner: boolean;
}) {
  const [filter, setFilter] = useState<string>("all");

  if (!artifacts || artifacts.length === 0) return null;

  // Compute counts per kind
  const counts: Record<string, number> = { all: artifacts.length };
  for (const a of artifacts) {
    counts[a.kind] = (counts[a.kind] ?? 0) + 1;
  }

  const distinctKinds = Object.keys(counts).filter((k) => k !== "all" && counts[k] > 0);

  const filtered = filter === "all"
    ? artifacts
    : artifacts.filter((a) => a.kind === filter);

  return (
    <div className={styles.wrap}>
      {distinctKinds.length > 1 && (
        <div className={styles.filterBar}>
          <button
            type="button"
            className={`${styles.filterChip} ${filter === "all" ? styles.filterChipActive : ""}`}
            onClick={() => setFilter("all")}
          >
            <span>All</span>
            <span className={styles.filterCount}>{artifacts.length}</span>
          </button>
          {distinctKinds.map((kind) => {
            const meta = KIND_META[kind] ?? { label: kind };
            return (
              <button
                key={kind}
                type="button"
                className={`${styles.filterChip} ${filter === kind ? styles.filterChipActive : ""}`}
                onClick={() => setFilter(kind)}
              >
                <span>{meta.label}</span>
                <span className={styles.filterCount}>{counts[kind]}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.list}>
        {filtered.map((artifact) => {
          const meta = KIND_META[artifact.kind] ?? {
            label: artifact.kind,
            icon: FileText,
            iconClass: styles.iconSummary,
          };
          const Icon = meta.icon;
          const badgeText = getArtifactBadge(artifact);
          const timeText = formatRelativeTime(artifact.created_at);

          return (
            <Link
              key={artifact.id}
              href={artifactHref(artifact.kind, artifact.id)}
              className={styles.row}
            >
              <div className={`${styles.iconWrap} ${meta.iconClass}`}>
                <Icon size={14} />
              </div>

              <div className={styles.content}>
                <span className={styles.title}>{artifact.title}</span>
                {badgeText && <span className={styles.metaPill}>{badgeText}</span>}
              </div>

              <div className={styles.rightGroup}>
                {timeText && <span className={styles.metaTime}>{timeText}</span>}
                <DocumentStatusBadge status={artifact.status} />
                {isOwner && (
                  <ArtifactRowActions
                    artifactId={artifact.id}
                    artifactTitle={artifact.title}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
