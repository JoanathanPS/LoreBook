import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { ExamPredictorView } from "@/components/predict/ExamPredictorView";

interface DocConceptRow {
  concept_id: string;
  documents: { is_exam_paper: boolean } | { is_exam_paper: boolean }[] | null;
}

export default async function PredictPage({
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

  const [{ data: docConcepts }, { data: mastery }, { count: examPaperCount }] = await Promise.all([
    conceptIds.length
      ? supabase
          .from("document_concepts")
          .select("concept_id, documents(is_exam_paper)")
          .in("concept_id", conceptIds)
          .returns<DocConceptRow[]>()
      : Promise.resolve({ data: [] as DocConceptRow[] }),
    conceptIds.length
      ? supabase.from("mastery_scores").select("concept_id, score").in("concept_id", conceptIds)
      : Promise.resolve({ data: [] as { concept_id: string; score: number }[] }),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("is_exam_paper", true),
  ]);

  const frequencyByConcept = new Map<string, number>();
  for (const row of docConcepts ?? []) {
    const doc = Array.isArray(row.documents) ? row.documents[0] : row.documents;
    if (doc?.is_exam_paper) {
      frequencyByConcept.set(row.concept_id, (frequencyByConcept.get(row.concept_id) ?? 0) + 1);
    }
  }
  const masteryByConcept = new Map((mastery ?? []).map((m) => [m.concept_id, m.score]));

  const priorities = (concepts ?? [])
    .map((c) => {
      const frequency = frequencyByConcept.get(c.id) ?? 0;
      const masteryScore = masteryByConcept.get(c.id) ?? 0.5;
      return {
        conceptId: c.id,
        name: c.name,
        frequency,
        mastery: masteryScore,
        priority: frequency * (1 - masteryScore),
      };
    })
    .filter((p) => p.frequency > 0)
    .sort((a, b) => b.priority - a.priority);

  return (
    <>
      <GradientMesh />
      <ExamPredictorView
        courseId={course.id}
        courseName={course.name}
        examPaperCount={examPaperCount ?? 0}
        priorities={priorities}
      />
    </>
  );
}
