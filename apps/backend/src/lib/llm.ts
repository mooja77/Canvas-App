/**
 * LLM Provider Abstraction Layer
 *
 * Pluggable interface for LLM providers (OpenAI, Anthropic, etc.)
 * Default provider is determined by AI_PROVIDER env var.
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /**
   * Anthropic prompt-caching hint. When set on a system message, the
   * Anthropic provider lifts this onto the API call so the cached portion
   * of the prompt costs 10% of normal input price for ~5 min. Other
   * providers ignore this field.
   */
  cache_control?: { type: 'ephemeral' };
}

export interface LlmCompletionOptions {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface LlmCompletionResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface LlmStreamChunk {
  content: string;
  done: boolean;
}

export interface LlmEmbeddingResult {
  embedding: number[];
  inputTokens: number;
  model: string;
}

export interface LlmProvider {
  readonly name: string;

  complete(options: LlmCompletionOptions): Promise<LlmCompletionResult>;

  completeStreaming(
    options: LlmCompletionOptions,
    onChunk: (chunk: LlmStreamChunk) => void,
  ): Promise<LlmCompletionResult>;

  embedText(text: string, model?: string): Promise<LlmEmbeddingResult>;

  embedBatch(texts: string[], model?: string): Promise<LlmEmbeddingResult[]>;
}

// Provider factory interface — creates per-request instances with user's API key
export interface LlmProviderFactory {
  create(apiKey: string, defaultModel?: string): LlmProvider;
}

// Provider registry (singletons — server-side fallback)
const providers = new Map<string, LlmProvider>();

export function registerProvider(name: string, provider: LlmProvider): void {
  providers.set(name, provider);
}

// Factory registry (per-request — user BYOK)
const factories = new Map<string, LlmProviderFactory>();

export function registerProviderFactory(name: string, factory: LlmProviderFactory): void {
  factories.set(name, factory);
}

/** Create a provider instance with a specific API key (BYOK) */
export function createProvider(providerName: string, apiKey: string, model?: string): LlmProvider {
  const factory = factories.get(providerName);
  if (!factory) {
    throw new Error(
      `LLM provider factory "${providerName}" not registered. Available: ${[...factories.keys()].join(', ')}`,
    );
  }
  return factory.create(apiKey, model);
}

let defaultProvider: LlmProvider | null = null;

export function getDefaultProvider(): LlmProvider {
  if (defaultProvider) return defaultProvider;

  const providerName = process.env.AI_PROVIDER || 'openai';
  const provider = providers.get(providerName);
  if (!provider) {
    throw new Error(`LLM provider "${providerName}" not registered. Available: ${[...providers.keys()].join(', ')}`);
  }
  defaultProvider = provider;
  return provider;
}

/** Convenience: call complete() on the default provider */
export async function complete(options: LlmCompletionOptions): Promise<LlmCompletionResult> {
  return getDefaultProvider().complete(options);
}

/** Convenience: call completeStreaming() on the default provider */
export async function completeStreaming(
  options: LlmCompletionOptions,
  onChunk: (chunk: LlmStreamChunk) => void,
): Promise<LlmCompletionResult> {
  return getDefaultProvider().completeStreaming(options, onChunk);
}

/** Convenience: call embedText() on the default provider */
export async function embedText(text: string, model?: string): Promise<LlmEmbeddingResult> {
  return getDefaultProvider().embedText(text, model);
}

/** Convenience: call embedBatch() on the default provider */
export async function embedBatch(texts: string[], model?: string): Promise<LlmEmbeddingResult[]> {
  return getDefaultProvider().embedBatch(texts, model);
}
