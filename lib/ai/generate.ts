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
      ? "Write a clear, well-organized study summary of the material below. Use headings and bullet points. Cover every distinct topic — don't skip anything, but don't pad either."
      : "Extract every formula, equation, and key definition from the material below into a compact formula sheet. Group by topic. For each: the formula/definition, what each symbol means, and a one-line note on when to use it.";

  const { text } = await generateText({
    model: MODEL,
    system: `${instructions}\n\nOutput plain markdown text only — no preamble.`,
    prompt: context,
  });

  return text.trim();
}

const flashcardsSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().describe("The question or prompt side of the card"),
        back: z.string().describe("The answer side of the card"),
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
    system: `Create up to ${count} spaced-repetition flashcards from the material below. Each card tests ONE discrete fact, definition, or concept — no multi-part questions. Prefer "what/why/how" prompts over yes/no. Keep answers concise (1-3 sentences).`,
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
