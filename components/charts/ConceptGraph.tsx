"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { GraphEdge, GraphNode } from "./types";
import styles from "./ConceptGraph.module.css";

interface SimNode extends GraphNode, d3.SimulationNodeDatum {}
type SimLink = d3.SimulationLinkDatum<SimNode>;

// mastery 0 -> danger red, 0.5 -> amber, 1 -> mastered green.
function masteryColor(m: number): string {
  if (m < 0.5) return d3.interpolateRgb("#d66b6b", "#f2b341")(m / 0.5);
  return d3.interpolateRgb("#f2b341", "#3fae82")((m - 0.5) / 0.5);
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
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = edges.map((e) => ({ source: e.source, target: e.target }));

    const svg = d3.select(svgRef.current).attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(90)
          .strength(0.3),
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide<SimNode>((d) => 14 + d.importance * 3),
      );

    const link = svg
      .append("g")
      .attr("stroke", "rgba(255,255,255,0.12)")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke-width", 1);

    const node = svg
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("class", styles.node)
      .style("cursor", "pointer")
      .on("click", (_event, d) => onSelect(d.id))
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    node
      .append("circle")
      .attr("r", (d) => 8 + d.importance * 3)
      .attr("fill", (d) => masteryColor(d.mastery))
      .attr("stroke", (d) => (d.id === selectedId ? "#fff" : "rgba(255,255,255,0.3)"))
      .attr("stroke-width", (d) => (d.id === selectedId ? 2 : 1));

    node
      .append("text")
      .text((d) => d.name)
      .attr("x", (d) => 12 + d.importance * 3)
      .attr("y", 4)
      .attr("fill", "rgba(255,255,255,0.85)")
      .attr("font-size", 11)
      .attr("font-family", "var(--font-sans)");

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, selectedId, onSelect]);

  return (
    <div ref={containerRef} className={styles.container}>
      <svg ref={svgRef} className={styles.svg} />
    </div>
  );
}
