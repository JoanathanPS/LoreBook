import React from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { BookOpen, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { masteryColor } from "@/lib/study/mastery-color";
import styles from "./ConceptNode.module.css";

export interface ConceptNodeData {
  id: string;
  name: string;
  mastery: number;
  importance: number;
  isInspected: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  childCount?: number;
  level?: number;
  isRoot?: boolean;
  onToggleExpand?: (id: string, e: React.MouseEvent) => void;
  [key: string]: unknown;
}

export type ConceptFlowNode = Node<ConceptNodeData, "concept">;

export function ConceptNode({ data }: NodeProps<ConceptFlowNode>) {
  const isRoot = data.isRoot || data.level === 0;
  const isSub = (data.level ?? 1) >= 2;
  const color = isRoot ? "#7b3232" : masteryColor(data.mastery ?? 0.5);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (data.onToggleExpand) {
      data.onToggleExpand(data.id, e);
    }
  }

  return (
    <div
      className={styles.node}
      data-inspected={data.isInspected}
      data-root={isRoot}
      data-sub={isSub}
      style={{
        borderColor: isRoot ? "#7b3232" : color,
      }}
    >
      {/* Handles for tree / radial / horizontal connectors */}
      <Handle type="target" position={Position.Left} className={styles.handle} id="left" />
      <Handle type="target" position={Position.Top} className={styles.handle} id="top" />
      
      {isRoot ? (
        <span className={styles.rootIcon}>
          <BookOpen size={14} />
        </span>
      ) : (
        <span className={styles.dot} style={{ background: color }} />
      )}

      <span className={styles.label}>{data.name}</span>

      {/* Expand/Collapse badge if it has children or can be expanded */}
      {data.hasChildren && (
        <button
          type="button"
          className={styles.expandBadge}
          onClick={handleToggle}
          title={data.isExpanded ? "Collapse sub-concepts" : `Expand ${data.childCount ?? ""} sub-concepts`}
        >
          {data.isExpanded ? (
            <ChevronDown size={12} />
          ) : (
            <>
              <ChevronRight size={12} />
              {data.childCount && data.childCount > 0 ? (
                <span className={styles.childCount}>{data.childCount}</span>
              ) : null}
            </>
          )}
        </button>
      )}

      {!data.hasChildren && !isRoot && data.importance > 0 && (
        <span className={styles.sparkleHint} title="Click to view underlying concepts">
          <Sparkles size={10} />
        </span>
      )}

      <Handle type="source" position={Position.Right} className={styles.handle} id="right" />
      <Handle type="source" position={Position.Bottom} className={styles.handle} id="bottom" />
    </div>
  );
}

