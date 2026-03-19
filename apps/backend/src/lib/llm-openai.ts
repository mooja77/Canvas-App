/**
 * OpenAI LLM Provider Implementation
 *
 * Supports both singleton (server-side key) and factory (per-user BYOK) modes.
 */

import OpenAI from 'openai';
import type {
  LlmProvider,
  LlmProviderFactory,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmStreamChunk,
  LlmEmbeddingResult,
} from './llm.js';
import { registerProvider, registerProviderFactory } from './llm.js';

const DEFAULT_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

/** Create an OpenAI LlmProvider with a specific client and default model */
function createOpenAIProvider(client: OpenAI, defaultModel: string): LlmProvider {
  return {
    name: 'openai',

    async complete(options: LlmCompletionOptions): Promise<LlmCompletionResult> {
      const model = options.model || defaultModel;
      const response = await client.chat.completions.create({
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
      const model = options.model || defaultModel;
      const stream = await client.chat.completions.create({
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

      return { content: fullContent, inputTokens, outputTokens, model };
    },

    async embedText(text: string, model?: string): Promise<LlmEmbeddingResult> {
      const embeddingModel = model || DEFAULT_EMBEDDING_MODEL;
      const response = await client.embeddings.create({ model: embeddingModel, input: text });
      return {
        embedding: response.data[0].embedding,
        inputTokens: response.usage?.prompt_tokens || 0,
        model: embeddingModel,
      };
    },

    async embedBatch(texts: string[], model?: string): Promise<LlmEmbeddingResult[]> {
      const embeddingModel = model || DEFAULT_EMBEDDING_MODEL;
      const response = await client.embeddings.create({ model: embeddingModel, input: texts });
      return response.data.map((item) => ({
        embedding: item.embedding,
        inputTokens: Math.ceil((response.usage?.prompt_tokens || 0) / texts.length),
        model: embeddingModel,
      }));
    },
  };
}

// Factory for BYOK — creates a fresh provider with user's API key
const openaiFactory: LlmProviderFactory = {
  create(apiKey: string, defaultModel?: string): LlmProvider {
    const client = new OpenAI({ apiKey });
    return createOpenAIProvider(client, defaultModel || DEFAULT_MODEL);
  },
};

registerProviderFactory('openai', openaiFactory);

// Singleton for server-side fallback (if OPENAI_API_KEY is set)
if (process.env.OPENAI_API_KEY) {
  const serverClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  registerProvider('openai', createOpenAIProvider(serverClient, DEFAULT_MODEL));
}

export default openaiFactory;
