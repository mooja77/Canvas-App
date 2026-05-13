/**
 * Google (Gemini) LLM Provider Implementation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  LlmProvider,
  LlmProviderFactory,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmStreamChunk,
  LlmEmbeddingResult,
} from './llm.js';
import { registerProviderFactory } from './llm.js';
import { withLlmRetry } from './llm-retry.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004';

function createGoogleProvider(genAI: GoogleGenerativeAI, defaultModel: string): LlmProvider {
  return {
    name: 'google',

    async complete(options: LlmCompletionOptions): Promise<LlmCompletionResult> {
      const modelName = options.model || defaultModel;

      const systemMsg = options.messages.find((m) => m.role === 'system');
      const chatMessages = options.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: m.content }],
        }));

      const model = genAI.getGenerativeModel({
        model: modelName,
        ...(systemMsg ? { systemInstruction: { role: 'user', parts: [{ text: systemMsg.content }] } } : {}),
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxTokens ?? 2048,
          ...(options.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
        },
      });

      // Use the last user message as the prompt, prior messages as history
      const history = chatMessages.slice(0, -1);
      const lastMessage = chatMessages[chatMessages.length - 1];

      const chat = model.startChat({ history });
      const result = await withLlmRetry(() => chat.sendMessage(lastMessage.parts));

      const text = result.response.text();
      const usage = result.response.usageMetadata;

      return {
        content: text,
        inputTokens: usage?.promptTokenCount || 0,
        outputTokens: usage?.candidatesTokenCount || 0,
        model: modelName,
      };
    },

    async completeStreaming(
      options: LlmCompletionOptions,
      onChunk: (chunk: LlmStreamChunk) => void,
    ): Promise<LlmCompletionResult> {
      const modelName = options.model || defaultModel;

      const systemMsg = options.messages.find((m) => m.role === 'system');
      const chatMessages = options.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: m.content }],
        }));

      const model = genAI.getGenerativeModel({
        model: modelName,
        ...(systemMsg ? { systemInstruction: { role: 'user', parts: [{ text: systemMsg.content }] } } : {}),
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxTokens ?? 2048,
          ...(options.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
        },
      });

      const history = chatMessages.slice(0, -1);
      const lastMessage = chatMessages[chatMessages.length - 1];

      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(lastMessage.parts);

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullContent += text;
          onChunk({ content: text, done: false });
        }
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount || 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }
      }

      onChunk({ content: '', done: true });

      return { content: fullContent, inputTokens, outputTokens, model: modelName };
    },

    async embedText(text: string, model?: string): Promise<LlmEmbeddingResult> {
      const embeddingModel = model || DEFAULT_EMBEDDING_MODEL;
      const embedModel = genAI.getGenerativeModel({ model: embeddingModel });
      const result = await embedModel.embedContent(text);

      return {
        embedding: result.embedding.values,
        inputTokens: 0, // Google doesn't report token usage for embeddings
        model: embeddingModel,
      };
    },

    async embedBatch(texts: string[], model?: string): Promise<LlmEmbeddingResult[]> {
      const embeddingModel = model || DEFAULT_EMBEDDING_MODEL;
      const embedModel = genAI.getGenerativeModel({ model: embeddingModel });

      // Google's batchEmbedContents
      const result = await embedModel.batchEmbedContents({
        requests: texts.map((text) => ({ content: { parts: [{ text }], role: 'user' } })),
      });

      return result.embeddings.map((emb) => ({
        embedding: emb.values,
        inputTokens: 0,
        model: embeddingModel,
      }));
    },
  };
}

const googleFactory: LlmProviderFactory = {
  create(apiKey: string, defaultModel?: string): LlmProvider {
    const genAI = new GoogleGenerativeAI(apiKey);
    return createGoogleProvider(genAI, defaultModel || DEFAULT_MODEL);
  },
};

registerProviderFactory('google', googleFactory);

export default googleFactory;
