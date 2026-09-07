"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Zap,
  FileText,
  Flame,
} from "lucide-react";
import { ConceptGraph } from "./ConceptGraph";
import type { ArtifactRef, GraphEdge, GraphNode, ConceptDrilldownData } from "./types";
import { artifactHref } from "@/lib/study/artifact-links";
import { masteryColor, riskColor, RISK_STOPS } from "@/lib/study/mastery-color";
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
  const router = useRouter();
  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const [edges, setEdges] = useState<GraphEdge[]>(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exploringId, setExploringId] = useState<string | null>(null);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [generatingDrill, setGeneratingDrill] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [generatingMindMap, setGeneratingMindMap] = useState(false);

  const onSelect = useCallback((id: string) => {
    setSelectedId(id);
    setExploreError(null);
    setDrillError(null);
  }, []);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const selectedArtifacts = selectedId ? (artifactsByConcept[selectedId] ?? []) : [];

  // Summary Metrics
  const metrics = useMemo(() => {
    if (nodes.length === 0) return { highRiskCount: 0, moderateRiskCount: 0, masteredCount: 0, readinessPct: 0 };
    let high = 0;
    let moderate = 0;
    let mastered = 0;
    let totalMastery = 0;

    for (const n of nodes) {
      const score = n.riskScore ?? ((n.examWeight ?? 3) * (1 - (n.mastery ?? 0.5)));
      if (score >= 2.5) high++;
      else if (score >= 1.0) moderate++;
      else mastered++;
      totalMastery += n.mastery ?? 0.5;
    }

    const readinessPct = Math.round((totalMastery / nodes.length) * 100);
    return { highRiskCount: high, moderateRiskCount: moderate, masteredCount: mastered, readinessPct };
  }, [nodes]);

  // Primary Action: "Drill This Concept" -> calls /api/predict/drill-deck and routes to flashcards
  async function handleDrillConcept(targetNode: GraphNode) {
    if (generatingDrill) return;
    setGeneratingDrill(true);
    setDrillError(null);

    try {
      const focusConcepts = [
        targetNode.name,
        ...(targetNode.underlyingData?.subconcepts?.map((s) => s.name) ?? []),
      ].filter(Boolean);

      const res = await fetch("/api/predict/drill-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          courseName,
          focusConcepts: focusConcepts.slice(0, 4),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error ?? "Failed to create drill deck");
      }

      const data = (await res.json()) as { id: string };
      router.push(`/study/flashcards/${data.id}`);
    } catch (err) {
      console.error(err);
      setDrillError(err instanceof Error ? err.message : "Failed to generate drill deck");
      setGeneratingDrill(false);
    }
  }

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
            const subWeight = 3;
            const subMastery = 0.5;
            const subRisk = Number((subWeight * (1 - subMastery)).toFixed(2));
            next.push({
              id: sub.id,
              name: sub.name,
              importance: subWeight,
              mastery: subMastery,
              examWeight: subWeight,
              riskScore: subRisk,
              riskLevel: subRisk >= 2.5 ? "high" : subRisk >= 1.0 ? "moderate" : "low",
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
              id: `edge-${targetId}-${sub.id}`,
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

  async function handleGenerateMindMap() {
    setGeneratingMindMap(true);
    setExploreError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/mindmap/generate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate knowledge map");
      const data = await res.json();
      if (data.nodes && data.nodes.length > 0) {
        setNodes(data.nodes);
        setEdges(data.edges || []);
      }
    } catch (err) {
      console.error(err);
      setExploreError("Could not generate knowledge map. Please try again.");
    } finally {
      setGeneratingMindMap(false);
    }
  }

  // Helper for selected node metrics
  const selectedExamWeight = selected?.examWeight ?? ((selected?.level ?? 1) <= 1 ? 4 : 2);
  const selectedRiskScore =
    selected?.riskScore ?? Number((selectedExamWeight * (1 - (selected?.mastery ?? 0.5))).toFixed(2));
  const selectedRiskLevel: "high" | "moderate" | "low" =
    selectedRiskScore >= 2.5 ? "high" : selectedRiskScore >= 1.0 ? "moderate" : "low";

  return (
    <div className={styles.wrap}>
      {/* Header Bar */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/library" className={styles.backLink} prefetch={false}>
            ← Back to library
          </Link>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{courseName} — Exam-Risk Map</h1>
            {nodes.length > 0 && (
              <div className={styles.headerStats}>
                {metrics.highRiskCount > 0 ? (
                  <span className={styles.statPillDanger} title="Concepts with high exam frequency and low mastery">
                    <Flame size={12} />
                    {metrics.highRiskCount} High Risk
                  </span>
                ) : (
                  <span className={styles.statPillSafe}>
                    <CheckCircle2 size={12} />
                    0 High Risk
                  </span>
                )}
                <span className={styles.statPillReadiness}>
                  Readiness: {metrics.readinessPct}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.headerRefreshBtn}
            onClick={handleGenerateMindMap}
            disabled={generatingMindMap}
            title="Scan course documents and refresh exam-risk knowledge map"
          >
            {generatingMindMap ? (
              <RefreshCw size={13} className={styles.spinIcon} />
            ) : (
              <Sparkles size={13} />
            )}
            <span>{generatingMindMap ? "Mapping Course..." : "Map Course Concepts"}</span>
          </button>

          <div className={styles.legend}>
            <span className={styles.legendItem} title="Priority Score ≥ 2.5 (High Exam Frequency × Low Mastery)">
              <span className={styles.legendDot} style={{ background: RISK_STOPS.high }} />
              High Exam Risk
            </span>
            <span className={styles.legendItem} title="Priority Score 1.0 - 2.4">
              <span className={styles.legendDot} style={{ background: RISK_STOPS.moderate }} />
              Moderate Risk
            </span>
            <span className={styles.legendItem} title="Priority Score < 1.0 (Mastered)">
              <span className={styles.legendDot} style={{ background: RISK_STOPS.low }} />
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
              Scan all documents and lectures in <strong>{courseName}</strong> to build an interactive Exam-Risk Map that colors topics by what you actually know and surfaces high-yield weak spots.
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
                  Analyzing course materials & mapping curriculum...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Exam-Risk Map from Course Docs
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
              <h4>Exam Risk Inspector</h4>
              <p>Click any concept node to inspect its live mastery %, exam frequency, and launch targeted drill sessions.</p>
            </div>
          ) : (
            <div className={styles.panelContent}>
              {/* Header */}
              <div className={styles.panelHeader}>
                <div className={styles.panelHeaderTop}>
                  <div className={styles.badgeRow}>
                    <span className={styles.levelBadge}>
                      {(selected.level ?? 1) <= 1 ? "Core Topic" : "Subtopic"}
                    </span>
                    <span
                      className={styles.riskStatusBadge}
                      data-risk={selectedRiskLevel}
                    >
                      {selectedRiskLevel === "high"
                        ? "High Exam Risk"
                        : selectedRiskLevel === "moderate"
                        ? "Moderate Risk"
                        : "Mastered"}
                    </span>
                  </div>
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

                {/* Exam Risk Assessment Card */}
                <div className={styles.riskCard}>
                  <div className={styles.riskRow}>
                    <div className={styles.riskStat}>
                      <span className={styles.riskStatLabel}>Exam Weight</span>
                      <span className={styles.riskStatVal}>{selectedExamWeight} / 5</span>
                    </div>
                    <div className={styles.riskStat}>
                      <span className={styles.riskStatLabel}>Live Mastery</span>
                      <span className={styles.riskStatVal}>{Math.round(selected.mastery * 100)}%</span>
                    </div>
                    <div className={styles.riskStat}>
                      <span className={styles.riskStatLabel}>Risk Score</span>
                      <span
                        className={styles.riskStatVal}
                        style={{ color: riskColor(selectedRiskScore) }}
                      >
                        {selectedRiskScore}
                      </span>
                    </div>
                  </div>

                  {/* Mastery Progress Bar */}
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

                {/* Primary Action: "⚡ Drill This Concept" */}
                <button
                  type="button"
                  className={styles.drillPrimaryBtn}
                  onClick={() => handleDrillConcept(selected)}
                  disabled={generatingDrill}
                >
                  {generatingDrill ? (
                    <>
                      <RefreshCw size={15} className={styles.spinIcon} />
                      <span>Generating Drill Deck...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={15} />
                      <span>⚡ Drill This Concept</span>
                    </>
                  )}
                </button>
                {drillError && <p className={styles.errorText}>{drillError}</p>}
              </div>

              {/* Action: Explore Underlying Concepts Button */}
              {(!selected.underlyingData || (selected.underlyingData.subconcepts?.length ?? 0) === 0) && (
                <div className={styles.exploreTriggerCard}>
                  <div className={styles.exploreTriggerInfo}>
                    <Sparkles size={16} className={styles.sparkleIcon} />
                    <span>Want to expand underlying mechanisms?</span>
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
                        Explore Underlying Subtopics
                      </>
                    )}
                  </button>
                  {exploreError && <p className={styles.errorText}>{exploreError}</p>}
                </div>
              )}

              <div className={styles.panelSections}>
                {/* 1. Overview & Intuition */}
                {(selected.description || selected.underlyingData?.summary) && (
                  <div className={styles.sectionBlock}>
                    <h3 className={styles.sectionHeading}>
                      <BookOpen size={14} />
                      Intuition & Summary
                    </h3>
                    <div className={styles.sectionBodyText}>
                      <SimpleMarkdown text={selected.underlyingData?.summary || selected.description || ""} />
                    </div>
                  </div>
                )}

                {/* 2. "Under the Hood" Mechanisms */}
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
                      Sub-concepts & Components
                    </h3>
                    <div className={styles.subconceptsGrid}>
                      {selected.underlyingData.subconcepts.map((sub, idx) => {
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

                {/* 5. Key Formulas & Equations */}
                {selected.underlyingData?.formulas && selected.underlyingData.formulas.length > 0 && (
                  <div className={styles.sectionBlock}>
                    <h3 className={styles.sectionHeading}>
                      <Calculator size={14} />
                      Key Formulas & Equations
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

                {/* 6. Core Questions */}
                {selected.underlyingData?.keyQuestions && selected.underlyingData.keyQuestions.length > 0 && (
                  <div className={styles.sectionBlock}>
                    <h3 className={styles.sectionHeading}>
                      <HelpCircle size={14} />
                      Exam-Style Diagnostic Questions
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

                {/* 7. Connected Source Documents & Lectures */}
                {selected.sources && selected.sources.length > 0 && (
                  <div className={styles.sectionBlock}>
                    <h3 className={styles.sectionHeading}>
                      <FileText size={14} />
                      Source Documents & Notes
                    </h3>
                    <div className={styles.sourcesList}>
                      {selected.sources.map((src, idx) => (
                        <div key={idx} className={styles.sourceItem}>
                          <FileText size={13} className={styles.sourceIcon} />
                          <span className={styles.sourceTitle}>{src.documentTitle}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8. Connected Study Materials */}
                <div className={styles.sectionBlock}>
                  <h3 className={styles.sectionHeading}>
                    <BookOpen size={14} />
                    Connected Decks & Quizzes
                  </h3>
                  {selectedArtifacts.length === 0 ? (
                    <p className={styles.noArtifacts}>No existing artifacts linked yet. Click &ldquo;⚡ Drill This Concept&rdquo; above to generate a dedicated drill deck.</p>
                  ) : (
                    <div className={styles.artifactList}>
                      {selectedArtifacts.map((a) => (
                        <Link
                          key={a.id}
                          href={artifactHref(a.kind, a.id)}
                          className={styles.artifactLink}
                          prefetch={false}
                        >
                          <span className={styles.artifactTitle}>{a.title}</span>
                          <span className={styles.artifactKind}>{a.kind}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* 9. AI Tutor Quick Launch */}
                <div className={styles.tutorActionWrap}>
                  <Link
                    href={`/chat/${courseId}?prompt=Explain the concept of "${encodeURIComponent(
                      selected.name
                    )}" and its underlying mechanisms in detail.`}
                    className={styles.tutorLinkBtn}
                    prefetch={false}
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
