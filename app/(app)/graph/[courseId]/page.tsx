import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { ConceptGraphView } from "@/components/charts/ConceptGraphView";
import type { GraphEdge, GraphNode, ArtifactRef, SourceDocRef } from "@/components/charts/types";

export default async function GraphPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", courseId)
    .single();
  if (!course) notFound();

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name, parent_id, description, level, underlying_data")
    .eq("course_id", courseId);

  const conceptIds = (concepts ?? []).map((c) => c.id);

  const [{ data: mastery }, { data: links }, { data: docLinks }] = await Promise.all([
    conceptIds.length
      ? supabase.from("mastery_scores").select("concept_id, score").in("concept_id", conceptIds)
      : Promise.resolve({ data: [] as { concept_id: string; score: number }[] }),
    conceptIds.length
      ? supabase
          .from("concept_links")
          .select("concept_id, artifact_id, study_artifacts(id, title, kind)")
          .in("concept_id", conceptIds)
      : Promise.resolve({
          data: [] as Array<{
            concept_id: string;
            artifact_id: string;
            study_artifacts: ArtifactRef | ArtifactRef[] | null;
          }>,
        }),
    conceptIds.length
      ? supabase
          .from("document_concepts")
          .select("concept_id, document_id, documents(id, title)")
          .in("concept_id", conceptIds)
      : Promise.resolve({
          data: [] as Array<{
            concept_id: string;
            document_id: string;
            documents: { id: string; title: string } | { id: string; title: string }[] | null;
          }>,
        }),
  ]);

  const masteryByConcept = new Map((mastery ?? []).map((m) => [m.concept_id, m.score]));

  const artifactsByConcept = new Map<string, ArtifactRef[]>();
  for (const link of links ?? []) {
    const artifact = Array.isArray(link.study_artifacts)
      ? link.study_artifacts[0]
      : link.study_artifacts;
    if (artifact) {
      if (!artifactsByConcept.has(link.concept_id)) artifactsByConcept.set(link.concept_id, []);
      artifactsByConcept.get(link.concept_id)!.push(artifact);
    }
  }

  const docSourcesByConcept = new Map<string, SourceDocRef[]>();
  for (const docLink of docLinks ?? []) {
    const doc = Array.isArray(docLink.documents) ? docLink.documents[0] : docLink.documents;
    if (doc) {
      if (!docSourcesByConcept.has(docLink.concept_id)) {
        docSourcesByConcept.set(docLink.concept_id, []);
      }
      docSourcesByConcept.get(docLink.concept_id)!.push({
        documentId: doc.id,
        documentTitle: doc.title,
      });
    }
  }

  const nodes: GraphNode[] = (concepts ?? []).map((c) => {
    const masteryScore = masteryByConcept.get(c.id) ?? 0.5;
    const underlying = c.underlying_data as { examWeight?: number } | null;
    const examWeight = underlying?.examWeight ?? (c.level === 1 ? 4 : 2);
    const riskScore = Number((examWeight * (1 - masteryScore)).toFixed(2));
    const riskLevel: "high" | "moderate" | "low" =
      riskScore >= 2.5 ? "high" : riskScore >= 1.0 ? "moderate" : "low";

    const conceptSources = docSourcesByConcept.get(c.id) ?? [];

    return {
      id: c.id,
      name: c.name,
      importance: examWeight,
      mastery: masteryScore,
      examWeight,
      riskScore,
      riskLevel,
      parentId: c.parent_id ?? null,
      description: c.description ?? null,
      level: c.level ?? 1,
      underlyingData: c.underlying_data,
      sources: conceptSources,
    };
  });

  // Strict Curriculum Hierarchy Edges Only (no co-occurrence hairballs)
  const hierarchicalEdges: GraphEdge[] = [];
  for (const c of concepts ?? []) {
    if (c.parent_id) {
      hierarchicalEdges.push({
        id: `edge-${c.parent_id}-${c.id}`,
        source: c.parent_id,
        target: c.id,
        kind: "hierarchy",
      });
    }
  }

  return (
    <>
      <GradientMesh />
      <ConceptGraphView
        courseId={course.id}
        courseName={course.name}
        nodes={nodes}
        edges={hierarchicalEdges}
        artifactsByConcept={Object.fromEntries(artifactsByConcept)}
      />
    </>
  );
}
