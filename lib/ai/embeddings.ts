const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3"; // 1024 dims — must match the `vector(1024)` column in migrations/0001_ingestion.sql
const BATCH_SIZE = 96;

// Without a payment method on file, Voyage caps free accounts at 3
// requests/minute — trivial to exceed once chat (one embedQuery call per
// message) and ingestion overlap. Retry 429s with backoff instead of
// failing the user's message/upload outright; a real payment method
// (billing stays free up to Voyage's 200M-token allowance) is the actual
// fix for sustained use, this just absorbs the occasional burst.
const MAX_RETRIES = 5;

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedBatch(
  texts: string[],
  inputType: "document" | "query",
): Promise<number[][]> {
  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType }),
    });

    if (res.ok) {
      const json: VoyageResponse = await res.json();
      return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    }

    lastError = await res.text();
    const retryable = res.status === 429 || res.status >= 500;

    if (!retryable || attempt === MAX_RETRIES) {
      const friendly =
        res.status === 401 || res.status === 403
          ? "Voyage rejected the API key — check VOYAGE_API_KEY in .env.local."
          : res.status === 429
            ? "Voyage embeddings are rate limited (free-tier quota). Wait a minute and try again."
            : `Voyage embeddings failed (${res.status}): ${lastError}`;
      throw new Error(friendly);
    }

    const retryAfter = Number(res.headers.get("retry-after"));
    const baseWaitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 21_000;
    const waitMs = res.status === 429 ? baseWaitMs : Math.min(2000 * 2 ** attempt, 20_000);
    await sleep(waitMs);
  }

  throw new Error(
    `Voyage embeddings are rate limited (free-tier quota) even after ${MAX_RETRIES} retries: ${lastError}`,
  );
}

/** Embed chunks that will be stored and searched against later. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    out.push(...(await embedBatch(batch, "document")));
  }
  return out;
}

/** Embed a user's search/chat query — Voyage recommends a different input_type for this side. */
export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([text], "query");
  return embedding;
}
