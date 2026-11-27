/**
 * Embeddings for RAG.
 *
 * Every vector stored in `document_chunks.embedding` and every query vector
 * must come from the SAME model at the SAME dimension. Vectors from two
 * different models live in unrelated spaces, so a silent provider fallback
 * (the old Gemini → Voyage switch) produced either a DB error
 * ("expected 768 dimensions, not 1024") or, worse, garbage search results.
 *
 * So: one provider (Gemini gemini-embedding-001 at 768d), no silent fallback,
 * and a hard dimension check before anything touches the database.
 */

export const EMBEDDING_MODEL = "models/gemini-embedding-001";
export const EMBEDDING_DIM = 768;

// Free tier for gemini-embedding-001 is limited mostly by tokens/minute, so
// batches are packed by an estimated token budget, not a fixed count.
const MAX_ITEMS_PER_BATCH = 100; // API hard limit for batchEmbedContents
const MAX_TOKENS_PER_BATCH = 12_000;
// Keep the worst case well inside a serverless function's time budget:
// fail fast with a clear "quota" message rather than get killed mid-retry.
const MAX_RETRIES = 3;
const MAX_WAIT_MS = 20_000;

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

interface GeminiBatchResponse {
  embeddings?: Array<{ values: number[] }>;
}

export class EmbeddingConfigError extends Error {
  override name = "EmbeddingConfigError";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new EmbeddingConfigError(
      "Embeddings are not configured on the server: GEMINI_API_KEY is missing. " +
        "Add it to the deployment's environment variables and redeploy.",
    );
  }
  return key;
}

/** ~4 chars per token is close enough for budgeting English study material. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}

function assertDims(vectors: number[][], expectedCount: number): void {
  if (vectors.length !== expectedCount) {
    throw new Error(
      `Embedding provider returned ${vectors.length} vectors for ${expectedCount} inputs.`,
    );
  }
  const bad = vectors.find((v) => v.length !== EMBEDDING_DIM);
  if (bad) {
    throw new Error(
      `Embedding provider returned ${bad.length}-dim vectors; the database expects ${EMBEDDING_DIM}.`,
    );
  }
}

/** Reads Google's RetryInfo detail ("retryDelay": "23s") when present. */
function retryDelayFrom(errText: string): number | null {
  try {
    const json = JSON.parse(errText);
    const detail = json.error?.details?.find(
      (d: Record<string, unknown>) => typeof d.retryDelay === "string",
    );
    const secs = parseFloat(String(detail?.retryDelay ?? "").replace("s", ""));
    return Number.isFinite(secs) && secs > 0 ? Math.ceil(secs * 1000) + 1000 : null;
  } catch {
    return null;
  }
}

async function embedBatch(texts: string[], taskType: TaskType): Promise<number[][]> {
  const key = apiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:batchEmbedContents`;
  const body = JSON.stringify({
    requests: texts.map((text) => ({
      model: EMBEDDING_MODEL,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIM,
    })),
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
      });
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(Math.min(1000 * 2 ** attempt, 10_000));
      continue;
    }

    if (res.ok) {
      const json: GeminiBatchResponse = await res.json();
      const vectors = (json.embeddings ?? []).map((e) => normalize(e.values));
      assertDims(vectors, texts.length);
      return vectors;
    }

    const errText = await res.text();
    if (res.status === 400 && /API key not valid/i.test(errText)) {
      throw new EmbeddingConfigError("GEMINI_API_KEY was rejected by Google. Check the key.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new EmbeddingConfigError("GEMINI_API_KEY was rejected by Google. Check the key.");
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      if (res.status === 429) {
        throw new Error(
          "The embedding service's free-tier quota is used up for now. Wait a minute and retry this document.",
        );
      }
      throw new Error(`Embedding request failed (${res.status}): ${errText.slice(0, 300)}`);
    }

    const suggested = retryDelayFrom(errText);
    const backoff = res.status === 429 ? 15_000 : Math.min(1000 * 2 ** attempt, 10_000);
    await sleep(Math.min(suggested ?? backoff, MAX_WAIT_MS));
  }

  throw new Error("Embedding request failed after retries.");
}

/** Groups texts so each request stays under the item and token budgets. */
function packBatches(texts: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let tokens = 0;
  for (const text of texts) {
    const t = estimateTokens(text);
    if (current.length > 0 && (current.length >= MAX_ITEMS_PER_BATCH || tokens + t > MAX_TOKENS_PER_BATCH)) {
      batches.push(current);
      current = [];
      tokens = 0;
    }
    current.push(text);
    tokens += t;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** Embed chunks that will be stored and searched against later. */
export async function embedDocuments(
  texts: string[],
  onProgress?: (done: number, total: number) => void | Promise<void>,
): Promise<number[][]> {
  const out: number[][] = [];
  for (const batch of packBatches(texts)) {
    out.push(...(await embedBatch(batch, "RETRIEVAL_DOCUMENT")));
    await onProgress?.(out.length, texts.length);
  }
  return out;
}

/** Embed a user's search/chat query. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text], "RETRIEVAL_QUERY");
  return vector;
}
