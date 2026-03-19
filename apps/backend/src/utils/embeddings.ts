/**
 * Text chunking and cosine similarity utilities for RAG pipeline.
 */

/** Approximate token count (rough: 1 token ~= 4 chars) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface TextChunk {
  text: string;
  index: number;
}

/**
 * Split text into ~500-token chunks with 50-token overlap.
 * Splits on sentence boundaries when possible.
 */
export function chunkText(text: string, maxTokens = 500, overlapTokens = 50): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  // If text fits in one chunk, return it directly
  if (estimateTokens(text) <= maxTokens) {
    return [{ text: text.trim(), index: 0 }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    // Try to break on sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end);
      // Find last sentence-ending punctuation
      const lastSentence = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf('! '),
        slice.lastIndexOf('.\n'),
        slice.lastIndexOf('?\n'),
        slice.lastIndexOf('!\n'),
      );
      if (lastSentence > maxChars * 0.3) {
        end = start + lastSentence + 2; // include the punctuation and space
      }
    }

    const chunkStr = text.slice(start, end).trim();
    if (chunkStr.length > 0) {
      chunks.push({ text: chunkStr, index: chunkIndex++ });
    }

    // Move start forward, accounting for overlap
    start = end - overlapChars;
    if (start >= text.length) break;
    // Prevent infinite loop
    if (start <= (end - maxChars)) {
      start = end;
    }
  }

  return chunks;
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

export interface SimilarChunk {
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  chunkText: string;
  similarity: number;
}

/**
 * Find the top-k most similar chunks to a query embedding.
 */
export function findSimilarChunks(
  queryEmbedding: number[],
  embeddings: { sourceType: string; sourceId: string; chunkIndex: number; chunkText: string; embedding: string }[],
  topK = 5,
  minSimilarity = 0.3,
): SimilarChunk[] {
  const scored = embeddings.map((e) => {
    let embeddingVec: number[];
    try {
      embeddingVec = JSON.parse(e.embedding);
    } catch {
      return null;
    }
    const similarity = cosineSimilarity(queryEmbedding, embeddingVec);
    return {
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      chunkIndex: e.chunkIndex,
      chunkText: e.chunkText,
      similarity,
    };
  }).filter((item): item is SimilarChunk => item !== null && item.similarity >= minSimilarity);

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}
