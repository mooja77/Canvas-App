/**
 * Anthropic LLM Provider Implementation (Claude)
 *
 * Note: Anthropic does not offer an embeddings API.
 * Users who choose Anthropic must use OpenAI or Google for embedding-dependent features.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LlmProvider,
  LlmProviderFactory,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmStreamChunk,
  LlmEmbeddingResult,
} from './llm.js';
import { registerProviderFactory } from './llm.js';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

function createAnthropicProvider(client: Anthropic, defaultModel: string): LlmProvider {
  return {
    name: 'anthropic',

    async complete(options: LlmCompletionOptions): Promise<LlmCompletionResult> {
      const model = options.model || defaultModel;

      // Extract system message
      const systemMsg = options.messages.find((m) => m.role === 'system');
      const userMessages = options.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      let system = systemMsg?.content || '';
      if (options.responseFormat === 'json') {
        system += '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation.';
      }

      const response = await client.messages.create({
        model,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.3,
        ...(system ? { system } : {}),
        messages: userMessages,
      });

      const content = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      return {
        content,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        model,
      };
    },

    async completeStreaming(
      options: LlmCompletionOptions,
      onChunk: (chunk: LlmStreamChunk) => void,
    ): Promise<LlmCompletionResult> {
      const model = options.model || defaultModel;

      const systemMsg = options.messages.find((m) => m.role === 'system');
      const userMessages = options.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      let system = systemMsg?.content || '';
      if (options.responseFormat === 'json') {
        system += '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation.';
      }

      const stream = client.messages.stream({
        model,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.3,
        ...(system ? { system } : {}),
        messages: userMessages,
      });

      let fullContent = '';

      for await (const event of stream) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (event.type === 'content_block_delta' && (event as any).delta?.type === 'text_delta') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const text = (event as any).delta.text || '';
          if (text) {
            fullContent += text;
            onChunk({ content: text, done: false });
          }
        }
      }

      onChunk({ content: '', done: true });

      const finalMessage = await stream.finalMessage();

      return {
        content: fullContent,
        inputTokens: finalMessage.usage?.input_tokens || 0,
        outputTokens: finalMessage.usage?.output_tokens || 0,
        model,
      };
    },

    async embedText(_text: string): Promise<LlmEmbeddingResult> {
      throw new Error(
        'Anthropic does not support embeddings. For RAG chat and data indexing, ' +
        'please configure an OpenAI or Google API key.',
      );
    },

    async embedBatch(_texts: string[]): Promise<LlmEmbeddingResult[]> {
      throw new Error(
        'Anthropic does not support embeddings. For RAG chat and data indexing, ' +
        'please configure an OpenAI or Google API key.',
      );
    },
  };
}

const anthropicFactory: LlmProviderFactory = {
  create(apiKey: string, defaultModel?: string): LlmProvider {
    const client = new Anthropic({ apiKey });
    return createAnthropicProvider(client, defaultModel || DEFAULT_MODEL);
  },
};

registerProviderFactory('anthropic', anthropicFactory);

export default anthropicFactory;
