const MAX_CHUNK_CHARS = 1800;
const MIN_CHUNK_CHARS = 200;

/**
 * Greedily packs paragraphs into ~MAX_CHUNK_CHARS chunks, splitting an
 * oversized single paragraph on sentence boundaries as a fallback.
 */
export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const pieces =
      paragraph.length > MAX_CHUNK_CHARS ? splitLongParagraph(paragraph) : [paragraph];

    for (const piece of pieces) {
      if (current && current.length + piece.length + 2 > MAX_CHUNK_CHARS) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current}\n\n${piece}` : piece;
      }
    }
  }

  if (current) chunks.push(current);

  // Merge a too-small trailing chunk into the previous one rather than
  // storing a near-empty embedding.
  if (chunks.length > 1 && chunks[chunks.length - 1].length < MIN_CHUNK_CHARS) {
    const last = chunks.pop()!;
    chunks[chunks.length - 1] += `\n\n${last}`;
  }

  return chunks;
}

function splitLongParagraph(paragraph: string): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > MAX_CHUNK_CHARS) {
      pieces.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}
