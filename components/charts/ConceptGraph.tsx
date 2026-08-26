"use client";

import { useCallback, useMemo } from "react";
import * as d3 from "d3";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type Node as RFNode,
  type Edge as RFEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphEdge, GraphNode } from "./types";
import { ConceptNode, type ConceptFlowNode, type ConceptNodeData } from "./ConceptNode";
import { masteryColor } from "@/lib/study/mastery-color";
import styles from "./ConceptGraph.module.css";

const nodeTypes: NodeTypes = { concept: ConceptNode };

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
}
type SimLink = d3.SimulationLinkDatum<SimNode>;

/** Runs a force simulation to completion (no live rendering) purely to get
 * a reasonable initial layout — react-flow owns all actual interaction
 * (drag/pan/zoom) from there. */
function layout(nodes: GraphNode[], edges: GraphEdge[]): Map<string, { x: number; y: number }> {
  const simNodes: SimNode[] = nodes.map((n) => ({ id: n.id }));
  const simLinks: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target }));

  const simulation = d3
    .forceSimulation(simNodes)
    .force(
      "link",
      d3
        .forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(150)
        .strength(0.3),
    )
    .force("charge", d3.forceManyBody().strength(-350))
    .force("center", d3.forceCenter(0, 0))
    .force(
      "collide",
      d3.forceCollide<SimNode>(70),
    )
    .stop();

  for (let i = 0; i < 300; i++) simulation.tick();

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of simNodes) positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
  return positions;
}

export function ConceptGraph({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const positions = useMemo(() => layout(nodes, edges), [nodes, edges]);

  const rfNodes: ConceptFlowNode[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "concept",
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        data: {
          name: n.name,
          mastery: n.mastery,
          importance: n.importance,
          isInspected: n.id === selectedId,
        },
      })),
    [nodes, positions, selectedId],
  );

  const rfEdges: RFEdge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        style: { stroke: "var(--border)" },
      })),
    [edges],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: RFNode) => onSelect(node.id),
    [onSelect],
  );

  return (
    <div className={styles.container}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} color="rgba(38, 49, 64, 0.16)" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => masteryColor((n.data as ConceptNodeData).mastery ?? 0.5)}
          maskColor="rgba(243, 236, 218, 0.65)"
          bgColor="#ede3cb"
          className={styles.minimap}
        />
      </ReactFlow>
    </div>
  );
}
