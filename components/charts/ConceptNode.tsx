import React from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { BookOpen, ChevronDown, ChevronRight, Zap } from "lucide-react";
import { riskColor } from "@/lib/study/mastery-color";
import styles from "./ConceptNode.module.css";

export interface ConceptNodeData {
  id: string;
  name: string;
  mastery: number;
  importance: number;
  examWeight?: number;
  riskScore?: number;
  riskLevel?: "high" | "moderate" | "low";
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
  const examWeight = data.examWeight ?? (isSub ? 2 : 4);
  const riskScore = data.riskScore ?? Number((examWeight * (1 - (data.mastery ?? 0.5))).toFixed(2));
  const nodeRiskLevel = data.riskLevel ?? (riskScore >= 2.5 ? "high" : riskScore >= 1.0 ? "moderate" : "low");
  const color = isRoot ? "#26313f" : riskColor(riskScore);

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
      data-risk={nodeRiskLevel}
      style={{
        borderColor: isRoot ? "#26313f" : color,
      }}
    >
      {/* Handles for tree connectors */}
      <Handle type="target" position={Position.Left} className={styles.handle} id="left" />
      <Handle type="target" position={Position.Top} className={styles.handle} id="top" />

      {isRoot ? (
        <span className={styles.rootIcon}>
          <BookOpen size={14} />
        </span>
      ) : (
        <span
          className={styles.dot}
          style={{ background: color }}
          data-pulse={nodeRiskLevel === "high"}
        />
      )}

      <span className={styles.label}>{data.name}</span>

      {/* High Risk Alert Badge */}
      {!isRoot && nodeRiskLevel === "high" && (
        <span className={styles.riskBadge} title={`High Exam Risk (Score: ${riskScore}) — Drill Recommended`}>
          <Zap size={10} />
          <span>Drill</span>
        </span>
      )}

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

      <Handle type="source" position={Position.Right} className={styles.handle} id="right" />
      <Handle type="source" position={Position.Bottom} className={styles.handle} id="bottom" />
    </div>
  );
}
