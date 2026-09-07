"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import * as d3 from "d3";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type Node as RFNode,
  type Edge as RFEdge,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Network, GitBranch, Search, Maximize2, Minimize2 } from "lucide-react";
import type { GraphEdge, GraphNode } from "./types";
import { ConceptNode, type ConceptFlowNode, type ConceptNodeData } from "./ConceptNode";
import { masteryColor } from "@/lib/study/mastery-color";
import styles from "./ConceptGraph.module.css";

const nodeTypes: NodeTypes = { concept: ConceptNode };

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
}
type SimLink = d3.SimulationLinkDatum<SimNode>;

/** Force-directed layout for network mode */
function layoutForce(nodes: GraphNode[], edges: GraphEdge[]): Map<string, { x: number; y: number }> {
  const simNodes: SimNode[] = nodes.map((n) => ({ id: n.id }));
  const simLinks: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target }));

  const simulation = d3
    .forceSimulation(simNodes)
    .force(
      "link",
      d3
        .forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(160)
        .strength(0.35),
    )
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(0, 0))
    .force("collide", d3.forceCollide<SimNode>(85))
    .stop();

  for (let i = 0; i < 300; i++) simulation.tick();

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of simNodes) positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
  return positions;
}

/** Hierarchical mind-map layout with horizontal branching */
function layoutMindMap(
  rootId: string,
  visibleNodes: GraphNode[],
  childMap: Map<string, string[]>,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeMap = new Map(visibleNodes.map((n) => [n.id, n]));

  // Get primary nodes (level 1 or direct children of root)
  const primaryIds = childMap.get(rootId) ?? visibleNodes.filter((n) => !n.parentId && n.id !== rootId).map((n) => n.id);
  
  // Vertical spacing constants
  const X_GAP = 280;
  const Y_GAP = 65;

  let currentY = 0;

  // Helper to recursively place a subtree
  function placeSubtree(nodeId: string, depth: number): { minY: number; maxY: number } {
    const children = (childMap.get(nodeId) ?? []).filter((cid) => nodeMap.has(cid));
    const x = depth * X_GAP;

    if (children.length === 0) {
      const y = currentY;
      positions.set(nodeId, { x, y });
      currentY += Y_GAP;
      return { minY: y, maxY: y };
    }

    const startY = currentY;
    const childYs: number[] = [];

    for (const childId of children) {
      const range = placeSubtree(childId, depth + 1);
      childYs.push((range.minY + range.maxY) / 2);
    }

    const avgChildY = childYs.reduce((a, b) => a + b, 0) / childYs.length;
    positions.set(nodeId, { x, y: avgChildY });

    return { minY: startY, maxY: currentY - Y_GAP };
  }

  // Place root
  const primaryYs: number[] = [];

  for (const pid of primaryIds) {
    if (!nodeMap.has(pid)) continue;
    const range = placeSubtree(pid, 1);
    primaryYs.push((range.minY + range.maxY) / 2);
  }

  const rootY = primaryYs.length > 0 ? primaryYs.reduce((a, b) => a + b, 0) / primaryYs.length : 0;
  positions.set(rootId, { x: 0, y: rootY });

  // Center everything vertically around 0
  const allYs = Array.from(positions.values()).map((p) => p.y);
  const midY = (Math.min(...allYs) + Math.max(...allYs)) / 2;
  for (const [id, pos] of positions.entries()) {
    positions.set(id, { x: pos.x, y: pos.y - midY });
  }

  return positions;
}

function InnerGraph({
  courseName,
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  courseName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onExplore?: (id: string, name: string) => void;
}) {
  const { fitView } = useReactFlow();
  const [layoutMode, setLayoutMode] = useState<"mindmap" | "network">("mindmap");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Set of expanded node IDs in mind-map mode
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Default: expand root and first level concepts
    return new Set(["course-root", ...nodes.slice(0, 8).map((n) => n.id)]);
  });

  const rootNodeId = "course-root";

  // Build complete tree with synthetic course root
  const allNodesWithRoot: GraphNode[] = useMemo(() => {
    const rootNode: GraphNode = {
      id: rootNodeId,
      name: courseName,
      importance: 5,
      mastery: 0.8,
      level: 0,
    };
    return [rootNode, ...nodes];
  }, [nodes, courseName]);

  // Child mapping: parentId -> childIds
  const childMap = useMemo(() => {
    const map = new Map<string, string[]>();
    map.set(rootNodeId, []);

    for (const n of nodes) {
      const pid = n.parentId || rootNodeId;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(n.id);
    }
    return map;
  }, [nodes]);

  // Toggle expand / collapse for a node
  const handleToggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedIds(new Set(allNodesWithRoot.map((n) => n.id)));
  }, [allNodesWithRoot]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set([rootNodeId]));
  }, []);

  // Filter visible nodes based on expanded ancestors in Mind Map mode
  const visibleNodes = useMemo(() => {
    if (layoutMode === "network") return allNodesWithRoot.filter((n) => n.id !== rootNodeId);

    const visible = new Set<string>([rootNodeId]);

    function addVisibleChildren(parentId: string) {
      if (!expandedIds.has(parentId)) return;
      const children = childMap.get(parentId) ?? [];
      for (const cid of children) {
        visible.add(cid);
        addVisibleChildren(cid);
      }
    }

    addVisibleChildren(rootNodeId);
    return allNodesWithRoot.filter((n) => visible.has(n.id));
  }, [layoutMode, allNodesWithRoot, expandedIds, childMap]);

  // Compute positions
  const positions = useMemo(() => {
    if (layoutMode === "mindmap") {
      return layoutMindMap(rootNodeId, visibleNodes, childMap);
    }
    return layoutForce(visibleNodes, edges);
  }, [layoutMode, visibleNodes, childMap, edges]);

  // Visible edges
  const visibleEdges: RFEdge[] = useMemo(() => {
    const visibleIdSet = new Set(visibleNodes.map((n) => n.id));

    if (layoutMode === "mindmap") {
      const treeEdges: RFEdge[] = [];
      for (const n of visibleNodes) {
        if (n.id === rootNodeId) continue;
        const pid = n.parentId || rootNodeId;
        if (visibleIdSet.has(pid)) {
          treeEdges.push({
            id: `edge-${pid}-${n.id}`,
            source: pid,
            target: n.id,
            sourceHandle: "right",
            targetHandle: "left",
            type: "smoothstep",
            animated: pid === selectedId || n.id === selectedId,
            style: {
              stroke: n.id === selectedId ? "#7b3232" : "rgba(160, 124, 62, 0.4)",
              strokeWidth: n.id === selectedId ? 2.5 : 1.75,
            },
          });
        }
      }
      return treeEdges;
    }

    return edges
      .filter((e) => visibleIdSet.has(e.source) && visibleIdSet.has(e.target))
      .map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        style: { stroke: "rgba(38, 49, 63, 0.25)", strokeWidth: 1.5 },
      }));
  }, [visibleNodes, layoutMode, selectedId, edges]);

  // RF Nodes with rich metadata
  const rfNodes: ConceptFlowNode[] = useMemo(() => {
    const lowerQuery = searchQuery.trim().toLowerCase();

    return visibleNodes.map((n) => {
      const children = childMap.get(n.id) ?? [];
      const isMatch = lowerQuery ? n.name.toLowerCase().includes(lowerQuery) : true;

      return {
        id: n.id,
        type: "concept",
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        data: {
          id: n.id,
          name: n.name,
          mastery: n.mastery ?? 0.5,
          importance: n.importance ?? 1,
          level: n.level ?? (n.id === rootNodeId ? 0 : 1),
          isRoot: n.id === rootNodeId,
          isInspected: n.id === selectedId,
          isExpanded: expandedIds.has(n.id),
          hasChildren: children.length > 0,
          childCount: children.length,
          onToggleExpand: handleToggleExpand,
        },
        style: {
          opacity: isMatch ? 1 : 0.25,
          transition: "opacity 0.2s ease",
        },
      };
    });
  }, [visibleNodes, positions, selectedId, expandedIds, childMap, handleToggleExpand, searchQuery]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: RFNode) => {
      if (node.id === rootNodeId) return;
      onSelect(node.id);
    },
    [onSelect],
  );

  // Auto-fit on layout or expand change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.25, duration: 400 });
    }, 50);
    return () => clearTimeout(timer);
  }, [layoutMode, expandedIds.size, fitView]);

  return (
    <div className={styles.container}>
      {/* Top Floating Control Bar */}
      <div className={styles.canvasControls}>
        <div className={styles.modeToggleGroup}>
          <button
            type="button"
            className={styles.controlBtn}
            data-active={layoutMode === "mindmap"}
            onClick={() => setLayoutMode("mindmap")}
            title="Interactive Tree Mind Map"
          >
            <GitBranch size={13} />
            Mind Map
          </button>
          <button
            type="button"
            className={styles.controlBtn}
            data-active={layoutMode === "network"}
            onClick={() => setLayoutMode("network")}
            title="Neural Network Co-occurrence Graph"
          >
            <Network size={13} />
            Network
          </button>
        </div>

        {layoutMode === "mindmap" && (
          <div className={styles.actionToggleGroup}>
            <button
              type="button"
              className={styles.iconActionBtn}
              onClick={handleExpandAll}
              title="Expand all branches"
            >
              <Maximize2 size={13} />
              Expand
            </button>
            <button
              type="button"
              className={styles.iconActionBtn}
              onClick={handleCollapseAll}
              title="Collapse to main topics"
            >
              <Minimize2 size={13} />
              Collapse
            </button>
          </div>
        )}

        <div className={styles.searchBox}>
          <Search size={13} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={visibleEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="rgba(38, 49, 64, 0.12)" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          nodeColor={(n) => masteryColor((n.data as ConceptNodeData).mastery ?? 0.5)}
          maskColor="rgba(243, 236, 218, 0.65)"
          bgColor="#ede3cb"
          className={styles.minimap}
          position="bottom-right"
        />
      </ReactFlow>
    </div>
  );
}

export function ConceptGraph(props: {
  courseName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onExplore?: (id: string, name: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <InnerGraph {...props} />
    </ReactFlowProvider>
  );
}

