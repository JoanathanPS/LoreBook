import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { withRetry } from "@/lib/ai/retry";

const MODEL = groq("openai/gpt-oss-120b");

const mindmapSchema = z.object({
  themes: z
    .array(
      z.object({
        name: z.string().max(50).describe("Main thematic topic or core concept name."),
        description: z.string().max(200).describe("Brief 1-2 sentence overview of this core concept."),
        mechanisms: z.array(z.string()).max(4).describe("2-4 key mechanisms or how this topic works."),
        subconcepts: z
          .array(
            z.object({
              name: z.string().max(50).describe("Underlying sub-concept name."),
              brief: z.string().max(150).describe("One-line description of the sub-concept."),
            })
          )
          .min(2)
          .max(5)
          .describe("Direct underlying child concepts under this theme."),
        prerequisites: z.array(z.string()).max(3).describe("Foundational prerequisite topics."),
        formulas: z.array(z.string()).max(2).describe("Key formulas if applicable wrapped in \\( ... \\) or \\[ ... \\]."),
      })
    )
    .min(3)
    .max(8)
    .describe("The 4-8 core curriculum themes and concepts that define this course."),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Fetch course info
  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", courseId)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Fetch chunks across documents in this course
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
      .limit(16);

    context = (chunks ?? []).map((c) => c.content).join("\n---\n");
  }

  const prompt = `You are designing a university-grade Knowledge Mind Map for the course "${course.name}".
Course Materials & Documents:
${context || `Standard university curriculum for ${course.name}.`}

Analyze the course and extract the 4 to 7 primary core themes/concepts. For EACH core theme, provide:
1. Clear description.
2. Step-by-step mechanisms ("how it works / under the hood").
3. 2 to 4 direct underlying sub-concepts.
4. Prerequisites and key formulas.`;

  try {
    const { object } = await withRetry(
      () =>
        generateObject({
          model: MODEL,
          schema: mindmapSchema,
          system:
            "You are an expert curriculum architect. You organize subjects into structured, deep knowledge trees with clear parent themes and underlying sub-concepts. Formulas should be wrapped in \\( ... \\).",
          prompt,
        }),
      { label: `Course Mind Map Generator (${course.name})` }
    );

    // Insert Level 1 Theme Concepts
    const createdNodes: Array<{
      id: string;
      name: string;
      importance: number;
      mastery: number;
      parentId?: string | null;
      description?: string | null;
      level?: number;
      underlyingData?: Record<string, unknown> | null;
    }> = [];

    const createdEdges: Array<{
      source: string;
      target: string;
      kind?: "hierarchy" | "cooccurrence";
    }> = [];

    for (const theme of object.themes) {
      const { data: parentRow } = await supabase
        .from("concepts")
        .upsert(
          {
            course_id: courseId,
            user_id: user.id,
            name: theme.name,
            description: theme.description,
            level: 1,
            underlying_data: {
              summary: theme.description,
              mechanisms: theme.mechanisms,
              subconcepts: theme.subconcepts.map((s) => ({ name: s.name, brief: s.brief, importance: 3 })),
              prerequisites: theme.prerequisites,
              formulas: theme.formulas,
              keyQuestions: [`How does ${theme.name} apply in practice?`],
            },
          },
          { onConflict: "course_id,name" }
        )
        .select("id, name, description, level, underlying_data")
        .single();

      if (parentRow) {
        createdNodes.push({
          id: parentRow.id,
          name: parentRow.name,
          importance: 3,
          mastery: 0.5,
          parentId: null,
          description: parentRow.description,
          level: 1,
          underlyingData: parentRow.underlying_data,
        });

        // Insert Level 2 Sub-concepts
        const subRows = theme.subconcepts.map((sub) => ({
          course_id: courseId,
          user_id: user.id,
          name: sub.name,
          parent_id: parentRow.id,
          description: sub.brief,
          level: 2,
        }));

        const { data: insertedSubs } = await supabase
          .from("concepts")
          .upsert(subRows, { onConflict: "course_id,name" })
          .select("id, name, description, level, parent_id");

        for (const sub of insertedSubs ?? []) {
          createdNodes.push({
            id: sub.id,
            name: sub.name,
            importance: 1,
            mastery: 0.5,
            parentId: parentRow.id,
            description: sub.description,
            level: 2,
          });

          createdEdges.push({
            source: parentRow.id,
            target: sub.id,
            kind: "hierarchy",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      nodes: createdNodes,
      edges: createdEdges,
    });
  } catch (err) {
    console.error("Failed to generate course mindmap", err);
    return NextResponse.json(
      { error: "Failed to generate knowledge map" },
      { status: 500 }
    );
  }
}
