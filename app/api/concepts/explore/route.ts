import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { withRetry } from "@/lib/ai/retry";

const MODEL = groq("openai/gpt-oss-120b");

const exploreSchema = z.object({
  summary: z
    .string()
    .describe("Clear, pedagogical 2-3 sentence explanation of what this concept is and why it matters."),
  mechanisms: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Step-by-step points explaining what is actually 'under the hood' / how the mechanism, theory, or process works."),
  subconcepts: z
    .array(
      z.object({
        name: z.string().max(60).describe("Name of the underlying sub-concept or building block."),
        brief: z.string().max(160).describe("One-sentence description of what this sub-concept does or represents."),
        importance: z.number().min(1).max(5).describe("Relative importance 1 to 5."),
      })
    )
    .min(3)
    .max(6)
    .describe("Direct underlying child concepts or sub-topics that make up this concept."),
  prerequisites: z
    .array(z.string())
    .max(4)
    .describe("Fundamental prerequisite topics or background knowledge needed to understand this."),
  formulas: z
    .array(z.string())
    .max(3)
    .describe("Key LaTeX formulas, formal rules, or governing equations wrapped in \\( ... \\) or \\[ ... \\]. Empty if non-mathematical."),
  keyQuestions: z
    .array(z.string())
    .max(3)
    .describe("2-3 thought-provoking questions that test deep comprehension of this concept."),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { conceptId, conceptName, courseId } = await request.json();
  if (!conceptId || !conceptName || !courseId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 1. Check if concept already has underlying_data
  const { data: existingConcept } = await supabase
    .from("concepts")
    .select("id, name, description, underlying_data, level, parent_id")
    .eq("id", conceptId)
    .single();

  // Check if subconcepts already exist in database
  const { data: existingSubconcepts } = await supabase
    .from("concepts")
    .select("id, name, description, level, parent_id")
    .eq("parent_id", conceptId);

  if (
    existingConcept?.underlying_data &&
    typeof existingConcept.underlying_data === "object" &&
    existingSubconcepts &&
    existingSubconcepts.length > 0
  ) {
    return NextResponse.json({
      conceptId,
      underlyingData: existingConcept.underlying_data,
      subconcepts: existingSubconcepts,
    });
  }

  // 2. Fetch relevant course document chunks for context grounding
  const { data: chunks } = await supabase
    .from("document_chunks")
    .select("content, page_ref")
    .textSearch("content", conceptName.replace(/[^\w\s]/g, ""), { config: "english" })
    .limit(6);

  let context = "";
  if (chunks && chunks.length > 0) {
    context = chunks.map((c) => c.content).join("\n---\n");
  } else {
    // Fallback to recent chunks from the course's documents
    const { data: courseDocs } = await supabase
      .from("documents")
      .select("id")
      .eq("course_id", courseId)
      .limit(3);
    if (courseDocs && courseDocs.length > 0) {
      const docIds = courseDocs.map((d) => d.id);
      const { data: fallbackChunks } = await supabase
        .from("document_chunks")
        .select("content")
        .in("document_id", docIds)
        .limit(6);
      context = (fallbackChunks ?? []).map((c) => c.content).join("\n---\n");
    }
  }

  // 3. Generate structured underlying concepts breakdown with LLM
  const prompt = `Analyze the academic concept "${conceptName}" in the context of this course.
Course Material Excerpts:
${context || "Standard academic curriculum for this course."}

Break down what is ACTUALLY under this concept: its underlying building blocks, exact mechanisms, sub-concepts, and prerequisites.
Be precise, rigorous, and pedagogical.`;

  try {
    const { object: drilldown } = await withRetry(
      () =>
        generateObject({
          model: MODEL,
          schema: exploreSchema,
          system:
            "You are an expert university professor building an interactive concept mind-map. You break down complex ideas into their underlying sub-concepts, step-by-step mechanisms, and prerequisites. If mentioning math, wrap formulas in \\( ... \\) or \\[ ... \\].",
          prompt,
        }),
      { label: `Concept Explorer (${conceptName})` }
    );

    // 4. Update the parent concept in database
    await supabase
      .from("concepts")
      .update({
        description: drilldown.summary,
        underlying_data: drilldown,
      })
      .eq("id", conceptId);

    // 5. Upsert the generated sub-concepts with parent_id
    const currentLevel = existingConcept?.level ?? 1;
    const subconceptRows = drilldown.subconcepts.map((sub) => ({
      course_id: courseId,
      user_id: user.id,
      name: sub.name,
      parent_id: conceptId,
      description: sub.brief,
      level: currentLevel + 1,
    }));

    const { data: insertedSubs } = await supabase
      .from("concepts")
      .upsert(subconceptRows, { onConflict: "course_id,name", ignoreDuplicates: false })
      .select("id, name, description, level, parent_id");

    return NextResponse.json({
      conceptId,
      underlyingData: drilldown,
      subconcepts: insertedSubs ?? [],
    });
  } catch (err) {
    console.error("Failed to explore concept", err);
    return NextResponse.json(
      { error: "Failed to generate concept breakdown" },
      { status: 500 }
    );
  }
}
