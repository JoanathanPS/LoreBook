const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3"; // 1024 dims — must match the `vector(1024)` column in migrations/0001_ingestion.sql
const BATCH_SIZE = 96;

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

async function embedBatch(
  texts: string[],
  inputType: "document" | "query",
): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embeddings failed (${res.status}): ${body}`);
  }

  const json: VoyageResponse = await res.json();
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
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
