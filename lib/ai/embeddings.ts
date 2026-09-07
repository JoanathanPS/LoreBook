const GEMINI_MODEL = "models/gemini-embedding-001";
const GEMINI_DIM = 768;
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
const BATCH_SIZE = 30;
const MAX_RETRIES = 5;

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

interface GeminiBatchResponse {
  embeddings?: Array<{ values: number[] }>;
  error?: { message: string; code: number };
}

interface GeminiSingleResponse {
  embedding?: { values: number[] };
  error?: { message: string; code: number };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------- Gemini
async function embedBatchGemini(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");

  const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:batchEmbedContents?key=${apiKey}`;
  const requests = texts.map((text) => ({
    model: GEMINI_MODEL,
    content: { parts: [{ text }] },
    outputDimensionality: GEMINI_DIM,
  }));

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });

    if (res.ok) {
      const json: GeminiBatchResponse = await res.json();
      if (!json.embeddings || json.embeddings.length === 0) {
        throw new Error("Gemini returned empty embeddings array.");
      }
      return json.embeddings.map((e) => e.values);
    }

    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error("Invalid GEMINI_API_KEY. Please check .env.local.");
    }

    if (attempt === MAX_RETRIES) {
      throw new Error(`Gemini embeddings failed (${res.status}): ${errText}`);
    }

    let waitMs = 15_000;
    try {
      const errJson = JSON.parse(errText);
      const retryDetail = errJson.error?.details?.find(
        (d: Record<string, unknown>) => typeof d.retryDelay === "string"
      );
      const retryDelayStr = retryDetail?.retryDelay;
      if (retryDelayStr && typeof retryDelayStr === "string") {
        const secs = parseFloat(retryDelayStr.replace("s", ""));
        if (!isNaN(secs) && secs > 0) waitMs = Math.ceil(secs * 1000) + 2000;
      }
    } catch {
      waitMs = res.status === 429 ? 15_000 : Math.min(1000 * 2 ** attempt, 8000);
    }

    await sleep(waitMs);
  }

  throw new Error("Gemini embeddings failed after retries.");
}

async function embedQueryGemini(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");

  const url = `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      content: { parts: [{ text }] },
      outputDimensionality: GEMINI_DIM,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini query embedding failed (${res.status}): ${errText}`);
  }

  const json: GeminiSingleResponse = await res.json();
  if (!json.embedding?.values) {
    throw new Error("Gemini query embedding returned empty values.");
  }

  return json.embedding.values;
}

// ---------------------------------------------------------------- Voyage (Fallback)
async function embedBatchVoyage(
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
      body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: inputType }),
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

// ---------------------------------------------------------------- Exported functions
/** Embed chunks that will be stored and searched against later. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const useGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    if (useGemini) {
      out.push(...(await embedBatchGemini(batch)));
    } else {
      out.push(...(await embedBatchVoyage(batch, "document")));
    }
  }
  return out;
}

/** Embed a user's search/chat query */
export async function embedQuery(text: string): Promise<number[]> {
  const useGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);

  if (useGemini) {
    return embedQueryGemini(text);
  }
  const [embedding] = await embedBatchVoyage([text], "query");
  return embedding;
}

