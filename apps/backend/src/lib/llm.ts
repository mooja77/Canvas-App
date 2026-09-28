/**
 * LLM Provider Abstraction Layer
 *
 * Pluggable interface for LLM providers (OpenAI, Anthropic, etc.)
 * Providers are always created per request from the customer's own key.
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

// There is deliberately NO server-side/default provider. JMS Dev Lab never
// holds a paid AI key for QualCanvas: every AI call runs on the customer's own
// key, created per request from their encrypted UserAiConfig (BYOK). A server
// OPENAI_API_KEY in the environment is ignored (see warnIfServerAiKeyPresent).

// Factory registry (per-request — user BYOK)
const factories = new Map<string, LlmProviderFactory>();

export function registerProviderFactory(name: string, factory: LlmProviderFactory): void {
  factories.set(name, factory);
}

/** Create a provider instance with a specific API key (BYOK) */
export function createProvider(providerName: string, apiKey: string, model?: string): LlmProvider {
  if (!apiKey) throw new Error("An API key of the customer's own is required");
  const factory = factories.get(providerName);
  if (!factory) {
    throw new Error(
      `LLM provider factory "${providerName}" not registered. Available: ${[...factories.keys()].join(', ')}`,
    );
  }
  return factory.create(apiKey, model);
}

/** Env names that used to switch on platform-paid AI. All are ignored now. */
export const RETIRED_SERVER_AI_ENV = ['OPENAI_API_KEY', 'HOSTED_AI_ENABLED', 'AI_PROVIDER'] as const;

/**
 * Log once at start-up if a retired server AI key is set, so a mistaken
 * Railway variable is noticed. Nothing reads it, so it can never be billed.
 */
export function warnIfServerAiKeyPresent(log: (msg: string) => void = console.warn): boolean {
  const present = RETIRED_SERVER_AI_ENV.filter((name) => Boolean(process.env[name]));
  if (present.length === 0) return false;
  log(
    `[ai] ${present.join(', ')} ${present.length > 1 ? 'are' : 'is'} set but ignored: QualCanvas only uses each customer's own AI key. Remove the variable.`,
  );
  return true;
}
