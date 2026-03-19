/**
 * OpenAI LLM Provider Implementation
 */

import OpenAI from 'openai';
import type {
  LlmProvider,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmStreamChunk,
  LlmEmbeddingResult,
} from './llm.js';
import { registerProvider } from './llm.js';

const DEFAULT_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

const openaiProvider: LlmProvider = {
  name: 'openai',

  async complete(options: LlmCompletionOptions): Promise<LlmCompletionResult> {
    const model = options.model || DEFAULT_MODEL;
    const response = await getClient().chat.completions.create({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
      ...(options.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content || '',
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      model,
    };
  },

  async completeStreaming(
    options: LlmCompletionOptions,
    onChunk: (chunk: LlmStreamChunk) => void,
  ): Promise<LlmCompletionResult> {
    const model = options.model || DEFAULT_MODEL;
    const stream = await getClient().chat.completions.create({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
      stream_options: { include_usage: true },
      ...(options.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    });

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullContent += delta;
        onChunk({ content: delta, done: false });
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens || 0;
        outputTokens = chunk.usage.completion_tokens || 0;
      }
    }

    onChunk({ content: '', done: true });

    return {
      content: fullContent,
      inputTokens,
      outputTokens,
      model,
    };
  },

  async embedText(text: string, model?: string): Promise<LlmEmbeddingResult> {
    const embeddingModel = model || DEFAULT_EMBEDDING_MODEL;
    const response = await getClient().embeddings.create({
      model: embeddingModel,
      input: text,
    });

    return {
      embedding: response.data[0].embedding,
      inputTokens: response.usage?.prompt_tokens || 0,
      model: embeddingModel,
    };
  },

  async embedBatch(texts: string[], model?: string): Promise<LlmEmbeddingResult[]> {
    const embeddingModel = model || DEFAULT_EMBEDDING_MODEL;
    const response = await getClient().embeddings.create({
      model: embeddingModel,
      input: texts,
    });

    return response.data.map((item) => ({
      embedding: item.embedding,
      inputTokens: Math.ceil((response.usage?.prompt_tokens || 0) / texts.length),
      model: embeddingModel,
    }));
  },
};

// Auto-register on import
registerProvider('openai', openaiProvider);

export default openaiProvider;
