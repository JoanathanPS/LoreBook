import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { ConceptGraphView } from "@/components/charts/ConceptGraphView";
import type { GraphEdge, GraphNode, ArtifactRef } from "@/components/charts/types";

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
    .select("id, name")
    .eq("course_id", courseId);

  const conceptIds = (concepts ?? []).map((c) => c.id);

  const [{ data: mastery }, { data: links }] = await Promise.all([
    conceptIds.length
      ? supabase.from("mastery_scores").select("concept_id, score").in("concept_id", conceptIds)
      : Promise.resolve({ data: [] as { concept_id: string; score: number }[] }),
    conceptIds.length
      ? supabase
          .from("concept_links")
          .select("concept_id, artifact_id, study_artifacts(id, title, kind)")
          .in("concept_id", conceptIds)
      : Promise.resolve({ data: [] as Array<{ concept_id: string; artifact_id: string; study_artifacts: ArtifactRef | ArtifactRef[] | null }> }),
  ]);

  const masteryByConcept = new Map((mastery ?? []).map((m) => [m.concept_id, m.score]));

  // Importance = how many artifacts reference the concept.
  const linksByConcept = new Map<string, Set<string>>();
  const artifactsByConcept = new Map<string, ArtifactRef[]>();
  const conceptsByArtifact = new Map<string, string[]>();

  for (const link of links ?? []) {
    if (!linksByConcept.has(link.concept_id)) linksByConcept.set(link.concept_id, new Set());
    linksByConcept.get(link.concept_id)!.add(link.artifact_id);

    const artifact = Array.isArray(link.study_artifacts)
      ? link.study_artifacts[0]
      : link.study_artifacts;
    if (artifact) {
      if (!artifactsByConcept.has(link.concept_id)) artifactsByConcept.set(link.concept_id, []);
      artifactsByConcept.get(link.concept_id)!.push(artifact);
    }

    if (!conceptsByArtifact.has(link.artifact_id)) conceptsByArtifact.set(link.artifact_id, []);
    conceptsByArtifact.get(link.artifact_id)!.push(link.concept_id);
  }

  const nodes: GraphNode[] = (concepts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    importance: linksByConcept.get(c.id)?.size ?? 0,
    mastery: masteryByConcept.get(c.id) ?? 0.5,
  }));

  const edgeSet = new Map<string, GraphEdge>();
  for (const conceptIdsForArtifact of conceptsByArtifact.values()) {
    for (let i = 0; i < conceptIdsForArtifact.length; i++) {
      for (let j = i + 1; j < conceptIdsForArtifact.length; j++) {
        const [a, b] = [conceptIdsForArtifact[i], conceptIdsForArtifact[j]].sort();
        const key = `${a}|${b}`;
        if (!edgeSet.has(key)) edgeSet.set(key, { source: a, target: b });
      }
    }
  }

  return (
    <>
      <GradientMesh />
      <ConceptGraphView
        courseId={course.id}
        courseName={course.name}
        nodes={nodes}
        edges={[...edgeSet.values()]}
        artifactsByConcept={Object.fromEntries(artifactsByConcept)}
      />
    </>
  );
}
