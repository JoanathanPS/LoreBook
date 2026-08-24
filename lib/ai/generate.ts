import { groq } from "@ai-sdk/groq";
import { generateText, generateObject } from "ai";
import { z } from "zod";

const MODEL = groq("openai/gpt-oss-120b");

export async function generateSummaryText(
  context: string,
  kind: "summary" | "formula_sheet",
): Promise<string> {
  const instructions =
    kind === "summary"
      ? "Write a clear, well-organized study summary of the material below. Cover every distinct topic — don't skip anything, but don't pad either."
      : "Extract every formula, equation, and key definition from the material below into a compact formula sheet, grouped by topic. For each: the formula/definition, what each symbol means, and a one-line note on when to use it.";

  const { text } = await generateText({
    model: MODEL,
    system: `${instructions}

Formatting rules (this renders through a plain markdown viewer, so follow these exactly):
- "## " for each major topic heading, "### " for sub-topics within it.
- Use "- " bullets for lists. For a sub-point under a bullet, indent it with exactly two extra spaces before the "-" (nested list).
- Use "1. ", "2. ", etc. for anything sequential or ordered (steps, ranked items).
- Use **bold** only for genuinely key terms, not whole sentences.
- One blank line between sections. No preamble, no "Here is the summary" — start directly with content.`,
    prompt: context,
  });

  return text.trim();
}

const flashcardsSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z
          .string()
          .max(140)
          .describe("A specific question testing ONE fact — never 'explain X' or 'describe X'"),
        back: z
          .string()
          .max(180)
          .describe("The direct answer only — a term, value, or single sentence. No restating the question."),
      }),
    )
    .min(1),
});

export async function generateFlashcards(
  context: string,
  count = 12,
): Promise<Array<{ front: string; back: string }>> {
  const { object } = await generateObject({
    model: MODEL,
    schema: flashcardsSchema,
    system: `Create up to ${count} spaced-repetition flashcards from the material below, following the minimum information principle (like Anki/SuperMemo cards):

- Each card tests exactly ONE atomic fact, term, formula, or relationship — never a multi-part or "explain everything about X" question.
- front: a short, specific, unambiguous question or cloze-style prompt. Someone should be able to answer in a few seconds if they know it.
- back: ONLY the answer itself — a term, number, formula, or one short sentence. Do not repeat the question, do not add a paragraph of explanation.
- Bad example: front "Explain how gradient descent works", back "Gradient descent is an optimization algorithm that..." (too broad, answer too long)
- Good example: front "What does gradient descent minimize?", back "The loss/cost function"
- Vary the question style: definitions, "what is the formula for X", "what does symbol Y represent", cause→effect, comparisons ("X vs Y: which is faster?").
- Spread cards across all topics in the material, not just the first section.`,
    prompt: context,
  });

  return object.cards;
}

const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string(),
        choices: z.array(z.string()).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().describe("Why the correct answer is correct"),
      }),
    )
    .min(1),
});

export interface QuizQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export async function generateQuiz(context: string, count = 8): Promise<QuizQuestion[]> {
  const { object } = await generateObject({
    model: MODEL,
    schema: quizSchema,
    system: `Write ${count} multiple-choice questions (4 choices each, exactly one correct) testing understanding of the material below — not just recall. Distractors should be plausible, not obviously wrong. Cover a spread of topics, not just the first section.`,
    prompt: context,
  });

  return object.questions;
}
