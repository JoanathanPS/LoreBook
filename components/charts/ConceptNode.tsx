import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { masteryColor } from "@/lib/study/mastery-color";
import styles from "./ConceptNode.module.css";

export interface ConceptNodeData {
  name: string;
  mastery: number;
  importance: number;
  isInspected: boolean;
  [key: string]: unknown;
}

export type ConceptFlowNode = Node<ConceptNodeData, "concept">;

export function ConceptNode({ data }: NodeProps<ConceptFlowNode>) {
  return (
    <div
      className={styles.node}
      data-inspected={data.isInspected}
      style={{
        borderColor: masteryColor(data.mastery),
        fontSize: `${0.75 + Math.min(data.importance, 5) * 0.035}rem`,
      }}
    >
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <span className={styles.dot} style={{ background: masteryColor(data.mastery) }} />
      {data.name}
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}
