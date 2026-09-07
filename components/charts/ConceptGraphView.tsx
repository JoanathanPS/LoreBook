"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Layers,
  ArrowRight,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Calculator,
  ChevronRight,
  RefreshCw,
  X,
  CheckCircle2,
} from "lucide-react";
import { ConceptGraph } from "./ConceptGraph";
import type { ArtifactRef, GraphEdge, GraphNode, ConceptDrilldownData } from "./types";
import { artifactHref } from "@/lib/study/artifact-links";
import { masteryColor, MASTERY_STOPS } from "@/lib/study/mastery-color";
import { SimpleMarkdown } from "@/components/study/SimpleMarkdown";
import styles from "./ConceptGraphView.module.css";

export function ConceptGraphView({
  courseId,
  courseName,
  nodes: initialNodes,
  edges: initialEdges,
  artifactsByConcept,
}: {
  courseId: string;
  courseName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  artifactsByConcept: Record<string, ArtifactRef[]>;
}) {
  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const [edges, setEdges] = useState<GraphEdge[]>(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exploringId, setExploringId] = useState<string | null>(null);
  const [exploreError, setExploreError] = useState<string | null>(null);

  const onSelect = useCallback((id: string) => {
    setSelectedId(id);
    setExploreError(null);
  }, []);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const selectedArtifacts = selectedId ? (artifactsByConcept[selectedId] ?? []) : [];

  // Trigger AI exploration for what's actually under the concept
  async function handleExplore(targetId: string, targetName: string) {
    if (exploringId) return;
    setExploringId(targetId);
    setExploreError(null);

    try {
      const res = await fetch("/api/concepts/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId: targetId,
          conceptName: targetName,
          courseId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to explore concept");
      }

      const data = await res.json();
      const underlying: ConceptDrilldownData = data.underlyingData;
      const subconcepts: Array<{ id: string; name: string; description?: string; level?: number; parent_id?: string }> =
        data.subconcepts ?? [];

      // Update parent node with underlying data
      setNodes((prev) => {
        const next = prev.map((n) => {
          if (n.id === targetId) {
            return {
              ...n,
              description: underlying.summary || n.description,
              underlyingData: underlying,
            };
          }
          return n;
        });

        // Add newly generated subconcepts to node list if not already present
        const existingIds = new Set(prev.map((n) => n.id));
        for (const sub of subconcepts) {
          if (!existingIds.has(sub.id)) {
            next.push({
              id: sub.id,
              name: sub.name,
              importance: 1,
              mastery: 0.5,
              parentId: targetId,
              description: sub.description,
              level: sub.level ?? 2,
            });
            existingIds.add(sub.id);
          }
        }
        return next;
      });

      // Add hierarchical edges
      setEdges((prev) => {
        const nextEdges = [...prev];
        const existingEdgeKeys = new Set(prev.map((e) => `${e.source}-${e.target}`));
        for (const sub of subconcepts) {
          const key = `${targetId}-${sub.id}`;
          if (!existingEdgeKeys.has(key)) {
            nextEdges.push({
              source: targetId,
              target: sub.id,
              kind: "hierarchy",
            });
            existingEdgeKeys.add(key);
          }
        }
        return nextEdges;
      });
    } catch (err) {
      console.error(err);
      setExploreError("Could not explore underlying concepts. Please try again.");
    } finally {
      setExploringId(null);
    }
  }

  const [generatingMindMap, setGeneratingMindMap] = useState(false);

  async function handleGenerateMindMap() {
    setGeneratingMindMap(true);
    setExploreError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/mindmap/generate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate mind map");
      const data = await res.json();
      if (data.nodes && data.nodes.length > 0) {
        setNodes(data.nodes);
        setEdges(data.edges || []);
      }
    } catch (err) {
      console.error(err);
      setExploreError("Could not generate mind map. Please try again.");
    } finally {
      setGeneratingMindMap(false);
    }
  }

  return (
    <div className={styles.wrap}>
      {/* Header Bar */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/library" className={styles.backLink}>
            ← Back to library
          </Link>
          <h1 className={styles.title}>{courseName} — Knowledge Mind Map</h1>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.headerRefreshBtn}
            onClick={handleGenerateMindMap}
            disabled={generatingMindMap}
            title="Scan course documents and refresh knowledge mind map"
          >
            {generatingMindMap ? (
              <RefreshCw size={13} className={styles.spinIcon} />
            ) : (
              <Sparkles size={13} />
            )}
            <span>{generatingMindMap ? "Mapping..." : "Map Course Concepts"}</span>
          </button>

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: MASTERY_STOPS.low }} />
              Needs work
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: MASTERY_STOPS.mid }} />
              Developing
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: MASTERY_STOPS.high }} />
              Mastered
            </span>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className={styles.body}>
        {nodes.length === 0 ? (
          <div className={styles.emptyState}>
            <BookOpen size={40} className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>No concepts mapped yet</h3>
            <p className={styles.emptySub}>
              Scan all uploaded documents and lectures in <strong>{courseName}</strong> to automatically construct a hierarchical Knowledge Mind Map with core concepts and underlying mechanisms.
            </p>
            <button
              type="button"
              className={styles.generateMindMapBtn}
              onClick={handleGenerateMindMap}
              disabled={generatingMindMap}
            >
              {generatingMindMap ? (
                <>
                  <RefreshCw size={16} className={styles.spinIcon} />
                  Analyzing course materials & mapping concepts...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Knowledge Mind Map from Course Docs
                </>
              )}
            </button>
            {exploreError && <p className={styles.errorText}>{exploreError}</p>}
          </div>
        ) : (
          <ConceptGraph
            courseName={courseName}
            nodes={nodes}
            edges={edges}
            selectedId={selectedId}
            onSelect={onSelect}
            onExplore={handleExplore}
          />
        )}

        {/* Right Deep Inspector Panel */}
        <aside className={styles.panel} data-open={!!selected}>
          {!selected ? (
            <div className={styles.panelPrompt}>
              <Layers size={32} className={styles.panelPromptIcon} />
              <h4>Concept Explorer</h4>
              <p>Click any node in the mind map to discover what is actually under it.</p>
            </div>
          ) : (
            <div className={styles.panelContent}>
              {/* Header */}
              <div className={styles.panelHeader}>
                <div className={styles.panelHeaderTop}>
                  <span className={styles.levelBadge}>
                    {(selected.level ?? 1) <= 1 ? "Core Concept" : "Underlying Sub-concept"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className={styles.closeBtn}
                    title="Close inspector"
                  >
                    <X size={15} />
                  </button>
                </div>

                <h2 className={styles.panelTitle}>{selected.name}</h2>

                {/* Mastery Bar */}
                <div className={styles.masteryWrap}>
                  <div className={styles.masteryInfo}>
                    <span className={styles.masteryLabel}>Mastery Level</span>
                    <span className={styles.masteryPercent}>{Math.round(selected.mastery * 100)}%</span>
                  </div>
                  <div className={styles.masteryBar}>
                    <div
                      className={styles.masteryFill}
                      style={{
                        width: `${Math.round(selected.mastery * 100)}%`,
                        background: masteryColor(selected.mastery),
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Action: Explore Underlying Concepts Button */}
              {(!selected.underlyingData || (selected.underlyingData.subconcepts?.length ?? 0) === 0) && (
                <div className={styles.exploreTriggerCard}>
                  <div className={styles.exploreTriggerInfo}>
                    <Sparkles size={16} className={styles.sparkleIcon} />
                    <span>Want to see what is under this concept?</span>
                  </div>
                  <button
                    type="button"
                    className={styles.exploreBtn}
                    disabled={exploringId === selected.id}
                    onClick={() => handleExplore(selected.id, selected.name)}
                  >
                    {exploringId === selected.id ? (
                      <>
                        <RefreshCw size={14} className={styles.spinIcon} />
                        Analyzing underlying mechanisms...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Explore Underlying Concepts
                      </>
                    )}
                  </button>
                  {exploreError && <p className={styles.errorText}>{exploreError}</p>}
                </div>
              )}

              <div className={styles.panelSections}>
                {/* 1. Overview & Summary */}
                {(selected.description || selected.underlyingData?.summary) && (
                  <div className={styles.sectionBlock}>
                    <h3 className={styles.sectionHeading}>
                      <BookOpen size={14} />
                      Intuition & Definition
                    </h3>
                    <div className={styles.sectionBodyText}>
                      <SimpleMarkdown text={selected.underlyingData?.summary || selected.description || ""} />
                    </div>
                  </div>
                )}

                {/* 2. "What's Actually Under It" (Mechanisms & Architecture) */}
                {selected.underlyingData?.mechanisms && selected.underlyingData.mechanisms.length > 0 && (
                  <div className={styles.sectionBlock}>
                    <h3 className={styles.sectionHeading}>
                      <Layers size={14} />
                      Under the Hood (How It Works)
                    </h3>
                    <div className={styles.mechanismsList}>
                      {selected.underlyingData.mechanisms.map((mech, idx) => (
                        <div key={idx} className={styles.mechanismItem}>
                          <span className={styles.mechanismNum}>{idx + 1}</span>
                          <div className={styles.mechanismContent}>
                            <SimpleMarkdown text={mech} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Underlying Sub-concepts (Clickable) */}
                {selected.underlyingData?.subconcepts && selected.underlyingData.subconcepts.length > 0 && (
                  <div className={styles.sectionBlock}>
                    <h3 className={styles.sectionHeading}>
                      <ChevronRight size={14} />
                      Underlying Concepts & Building Blocks
                    </h3>
                    <div className={styles.subconceptsGrid}>
                      {selected.underlyingData.subconcepts.map((sub, idx) => {
                        // Check if a node already exists with this name
                        const matchedNode = nodes.find(
                          (n) => n.name.toLowerCase() === sub.name.toLowerCase()
                        );

                        return (
                          <div
                            key={idx}
                            className={styles.subconceptCard}
                            onClick={() => {
                              if (matchedNode) {
                                setSelectedId(matchedNode.id);
                              }
                            }}
                          >
                            <div className={styles.subconceptHeader}>
                              <span className={styles.subconceptDot} />
                              <span className={styles.subconceptName}>{sub.name}</span>
                              {matchedNode && <ArrowRight size={12} className={styles.subArrow} />}
                            </div>
                            <p className={styles.subconceptBrief}>{sub.brief}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Prerequisites */}
                {selected.underlyingData?.prerequisites && selected.underlyingData.prerequisites.length > 0 && (
                  <div className={styles.sectionBlock}>
                    <h3 className={styles.sectionHeading}>
                      <CheckCircle2 size={14} />
                      Prerequisites
                    </h3>
                    <ul className={styles.prereqList}>
                      {selected.underlyingData.prerequisites.map((prereq, idx) => (
                        <li key={idx} className={styles.prereqItem}>
                          {prereq}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 5. Key Formulas & Formal Rules */}
                {selected.underlyingData?.formulas && selected.underlyingData.formulas.length > 0 && (
                  <div className={styles.sectionBlock}>
                    <h3 className={styles.sectionHeading}>
                      <Calculator size={14} />
                      Key Formulas & Governing Rules
                    </h3>
                    <div className={styles.formulasWrap}>
                      {selected.underlyingData.formulas.map((formula, idx) => (
                        <div key={idx} className={styles.formulaBox}>
                          <SimpleMarkdown text={formula} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Key Conceptual Questions */}
                {selected.underlyingData?.keyQuestions && selected.underlyingData.keyQuestions.length > 0 && (
                  <div className={styles.sectionBlock}>
                    <h3 className={styles.sectionHeading}>
                      <HelpCircle size={14} />
                      Core Questions to Test Understanding
                    </h3>
                    <ul className={styles.questionsList}>
                      {selected.underlyingData.keyQuestions.map((q, idx) => (
                        <li key={idx} className={styles.questionItem}>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 7. Connected Study Artifacts */}
                <div className={styles.sectionBlock}>
                  <h3 className={styles.sectionHeading}>
                    <BookOpen size={14} />
                    Connected Study Materials
                  </h3>
                  {selectedArtifacts.length === 0 ? (
                    <p className={styles.noArtifacts}>No study materials linked directly to this node yet.</p>
                  ) : (
                    <div className={styles.artifactList}>
                      {selectedArtifacts.map((a) => (
                        <Link
                          key={a.id}
                          href={artifactHref(a.kind, a.id)}
                          className={styles.artifactLink}
                        >
                          <span className={styles.artifactTitle}>{a.title}</span>
                          <span className={styles.artifactKind}>{a.kind}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* 8. AI Tutor Quick Launch */}
                <div className={styles.tutorActionWrap}>
                  <Link
                    href={`/chat/${courseId}?prompt=Explain the concept of "${encodeURIComponent(
                      selected.name
                    )}" and its underlying mechanisms in detail.`}
                    className={styles.tutorLinkBtn}
                  >
                    <MessageSquare size={14} />
                    Ask AI Tutor about {selected.name}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

