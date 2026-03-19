/**
 * RAG (Retrieval-Augmented Generation) pipeline.
 *
 * Query → embed → search similar chunks → build context → call LLM
 */

import { prisma } from '../lib/prisma.js';
import type { LlmProvider } from '../lib/llm.js';
import { findSimilarChunks, type SimilarChunk } from './embeddings.js';

export interface RagResult {
  answer: string;
  citations: { sourceType: string; sourceId: string; text: string }[];
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Run a RAG query against a canvas's embeddings.
 */
export async function ragQuery(
  canvasId: string,
  query: string,
  provider: LlmProvider,
  options: { topK?: number; minSimilarity?: number } = {},
): Promise<RagResult> {
  const topK = options.topK ?? 6;
  const minSimilarity = options.minSimilarity ?? 0.25;

  // 1. Embed the query
  const queryEmbResult = await provider.embedText(query);
  const queryEmbedding = queryEmbResult.embedding;

  // 2. Fetch all embeddings for this canvas
  const allEmbeddings = await prisma.textEmbedding.findMany({
    where: { canvasId },
    select: {
      sourceType: true,
      sourceId: true,
      chunkIndex: true,
      chunkText: true,
      embedding: true,
    },
  });

  if (allEmbeddings.length === 0) {
    return {
      answer: 'No data has been embedded for this canvas yet. Please generate embeddings first by clicking the "Index Data" button.',
      citations: [],
      inputTokens: queryEmbResult.inputTokens,
      outputTokens: 0,
      model: queryEmbResult.model,
    };
  }

  // 3. Find similar chunks
  const similar = findSimilarChunks(queryEmbedding, allEmbeddings, topK, minSimilarity);

  if (similar.length === 0) {
    return {
      answer: 'I could not find relevant information in the canvas data to answer your question. Try rephrasing your query or ensure the canvas data has been indexed.',
      citations: [],
      inputTokens: queryEmbResult.inputTokens,
      outputTokens: 0,
      model: queryEmbResult.model,
    };
  }

  // 4. Build context from similar chunks
  const context = buildContext(similar);

  // 5. Call LLM with context
  const result = await provider.complete({
    messages: [
      {
        role: 'system',
        content: `You are a research assistant for a qualitative coding canvas. You help researchers analyze their interview transcripts, coded data, and memos.

Answer the user's question based ONLY on the provided context from the canvas. Be specific and cite the source material. If the context doesn't contain enough information to fully answer, say so.

Format your response clearly. When referencing source material, use inline citations like [Source: transcript/coding/memo].

Context from the canvas:
${context}`,
      },
      {
        role: 'user',
        content: query,
      },
    ],
    temperature: 0.3,
    maxTokens: 1500,
  });

  // 6. Build citations from the chunks used
  const citations = similar.map((s) => ({
    sourceType: s.sourceType,
    sourceId: s.sourceId,
    text: s.chunkText.slice(0, 200),
  }));

  return {
    answer: result.content,
    citations,
    inputTokens: queryEmbResult.inputTokens + result.inputTokens,
    outputTokens: result.outputTokens,
    model: result.model,
  };
}

/**
 * Build a context string from similar chunks, grouped by source.
 */
function buildContext(chunks: SimilarChunk[]): string {
  const sections: string[] = [];

  for (const chunk of chunks) {
    const label = chunk.sourceType === 'transcript_chunk'
      ? 'Transcript excerpt'
      : chunk.sourceType === 'coding'
        ? 'Coded passage'
        : 'Memo';
    sections.push(`[${label} | similarity: ${chunk.similarity.toFixed(2)}]\n${chunk.chunkText}`);
  }

  return sections.join('\n\n---\n\n');
}
