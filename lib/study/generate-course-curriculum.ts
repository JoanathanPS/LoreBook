import { createClient } from "@/lib/supabase/server";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { withRetry } from "@/lib/ai/retry";
import type { GraphEdge, GraphNode } from "@/components/charts/types";

const MODEL = groq("openai/gpt-oss-120b");

const MATH_RULE =
  'For any mathematical expression or variable: block equations in \\[ ... \\], inline variables/terms in \\( ... \\). Never use bare unformatted math.';

const curriculumSchema = z.object({
  themes: z
    .array(
      z.object({
        name: z.string().max(50).describe("Main thematic topic or core concept name."),
        description: z.string().max(250).describe("Clear 1-2 sentence conceptual intuition and overview."),
        examWeight: z
          .number()
          .int()
          .min(1)
          .max(5)
          .describe("Estimated importance / frequency on exams: 5 = fundamental/guaranteed exam topic, 1 = niche detail."),
        mechanisms: z.array(z.string().max(250)).max(4).describe("2-4 key mechanisms or step-by-step how it works under the hood."),
        subconcepts: z
          .array(
            z.object({
              name: z.string().max(50).describe("Underlying sub-concept or mechanism name."),
              brief: z.string().max(180).describe("One-line description of how this sub-concept works."),
              examWeight: z.number().int().min(1).max(5).describe("Exam weight 1-5 for this specific sub-concept."),
              formulas: z.array(z.string()).max(2).describe("Key formula for this subtopic wrapped in \\( ... \\) or \\[ ... \\]."),
            })
          )
          .min(2)
          .max(5)
          .describe("Direct underlying child concepts and components under this theme."),
        prerequisites: z.array(z.string().max(60)).max(3).describe("Foundational prerequisite topics needed."),
        formulas: z.array(z.string()).max(3).describe("Key governing equations wrapped in LaTeX notation."),
        keyQuestions: z.array(z.string().max(180)).max(3).describe("2-3 core conceptual exam-style questions to test mastery."),
      })
    )
    .min(3)
    .max(8)
    .describe("The 4-8 core curriculum themes and concepts that define this course."),
});

export async function generateCourseCurriculum(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Fetch course info
  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", courseId)
    .single();

  if (!course) {
    throw new Error("Course not found");
  }

  // Fetch document chunks for course context
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title")
    .eq("course_id", courseId);

  const docIds = (docs ?? []).map((d) => d.id);

  let context = "";
  if (docIds.length > 0) {
    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("content")
      .in("document_id", docIds)
      .limit(20);

    context = (chunks ?? []).map((c) => c.content).join("\n---\n");
  }

  const prompt = `You are a university curriculum architect and exam strategist for the course "${course.name}".
Course Materials & Lecture Excerpts:
${context || `Standard rigorous university curriculum for ${course.name}.`}

Analyze the course structure and extract the 4 to 7 primary core themes/concepts that form the backbone of this curriculum.
For EACH core theme:
1. Provide a clear, intuitive description.
2. Estimate the Exam Importance Weight (1 to 5, where 5 means critical guaranteed exam topic).
3. Outline 2-4 step-by-step mechanisms ("Under the hood / how it works").
4. Provide 2 to 4 direct underlying sub-concepts with their own exam weights and formulas.
5. Provide prerequisites, governing formulas (LaTeX formatted), and core exam questions.`;

  const { object } = await withRetry(
    () =>
      generateObject({
        model: MODEL,
        schema: curriculumSchema,
        system: `You are an expert curriculum architect. You organize courses into structured, deep knowledge trees with clear parent themes, underlying sub-concepts, and accurate exam weight estimations (1-5). ${MATH_RULE}`,
        prompt,
      }),
    { label: `Course Curriculum Generator (${course.name})` }
  );

  // Fetch existing mastery scores so we don't wipe out user progress
  const { data: existingMastery } = await supabase
    .from("mastery_scores")
    .select("concept_id, score")
    .eq("user_id", user.id);

  const masteryMap = new Map((existingMastery ?? []).map((m) => [m.concept_id, m.score]));

  const createdNodes: GraphNode[] = [];
  const createdEdges: GraphEdge[] = [];

  for (const theme of object.themes) {
    const examWeight = theme.examWeight ?? 4;
    const { data: parentRow, error: parentError } = await supabase
      .from("concepts")
      .upsert(
        {
          course_id: courseId,
          user_id: user.id,
          name: theme.name,
          description: theme.description,
          level: 1,
          underlying_data: {
            examWeight,
            summary: theme.description,
            mechanisms: theme.mechanisms,
            subconcepts: theme.subconcepts.map((s) => ({
              name: s.name,
              brief: s.brief,
              importance: s.examWeight ?? 3,
            })),
            prerequisites: theme.prerequisites,
            formulas: theme.formulas,
            keyQuestions: theme.keyQuestions,
          },
        },
        { onConflict: "course_id,name" }
      )
      .select("id, name, description, level, underlying_data")
      .single();

    if (parentError || !parentRow) {
      console.warn("Failed to upsert theme parent concept:", parentError?.message);
      continue;
    }

    const parentMastery = masteryMap.get(parentRow.id) ?? 0.5;
    const parentRiskScore = Number((examWeight * (1 - parentMastery)).toFixed(2));
    const parentRiskLevel: "high" | "moderate" | "low" =
      parentRiskScore >= 2.5 ? "high" : parentRiskScore >= 1.0 ? "moderate" : "low";

    createdNodes.push({
      id: parentRow.id,
      name: parentRow.name,
      importance: examWeight,
      mastery: parentMastery,
      examWeight,
      riskScore: parentRiskScore,
      riskLevel: parentRiskLevel,
      parentId: null,
      description: parentRow.description,
      level: 1,
      underlyingData: parentRow.underlying_data,
      sources: (docs ?? []).map((d) => ({ documentId: d.id, documentTitle: d.title })),
    });

    // Insert Level 2 Sub-concepts
    const subRows = theme.subconcepts.map((sub) => {
      const subWeight = sub.examWeight ?? 3;
      return {
        course_id: courseId,
        user_id: user.id,
        name: sub.name,
        parent_id: parentRow.id,
        description: sub.brief,
        level: 2,
        underlying_data: {
          examWeight: subWeight,
          summary: sub.brief,
          formulas: sub.formulas,
          keyQuestions: [`How does ${sub.name} function within ${theme.name}?`],
        },
      };
    });

    const { data: insertedSubs } = await supabase
      .from("concepts")
      .upsert(subRows, { onConflict: "course_id,name" })
      .select("id, name, description, level, parent_id, underlying_data");

    for (const sub of insertedSubs ?? []) {
      const subUnderlying = sub.underlying_data as { examWeight?: number } | null;
      const subWeight = subUnderlying?.examWeight ?? 3;
      const subMastery = masteryMap.get(sub.id) ?? 0.5;
      const subRiskScore = Number((subWeight * (1 - subMastery)).toFixed(2));
      const subRiskLevel: "high" | "moderate" | "low" =
        subRiskScore >= 2.5 ? "high" : subRiskScore >= 1.0 ? "moderate" : "low";

      createdNodes.push({
        id: sub.id,
        name: sub.name,
        importance: subWeight,
        mastery: subMastery,
        examWeight: subWeight,
        riskScore: subRiskScore,
        riskLevel: subRiskLevel,
        parentId: parentRow.id,
        description: sub.description,
        level: 2,
        underlyingData: sub.underlying_data,
        sources: (docs ?? []).map((d) => ({ documentId: d.id, documentTitle: d.title })),
      });

      createdEdges.push({
        source: parentRow.id,
        target: sub.id,
        kind: "hierarchy",
      });
    }

    // Link document concepts if docs exist
    if (docIds.length > 0) {
      const allConceptIds = [parentRow.id, ...(insertedSubs ?? []).map((s) => s.id)];
      const docConceptRows = [];
      for (const dId of docIds) {
        for (const cId of allConceptIds) {
          docConceptRows.push({
            document_id: dId,
            concept_id: cId,
            user_id: user.id,
          });
        }
      }
      await supabase
        .from("document_concepts")
        .upsert(docConceptRows, { onConflict: "document_id,concept_id", ignoreDuplicates: true });
    }
  }

  return {
    success: true,
    nodes: createdNodes,
    edges: createdEdges,
  };
}
