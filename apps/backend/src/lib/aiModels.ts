/**
 * The one place QualCanvas names AI models.
 *
 * Why this exists: until 28 Sep 2026 the Anthropic default was the dated id
 * claude-sonnet-4-20250514, which Anthropic RETIRED on 15 June 2026, and the
 * Google defaults (gemini-2.0-flash, text-embedding-004) were shut down on
 * 1 June 2026 and 14 Jan 2026. Every AI call on those keys failed. A guard
 * test (aiModels.test.ts) now fails if any source file names a model on the
 * RETIRED list below, so this cannot silently recur.
 *
 * Sources (re-read before changing anything here; never guess a model id):
 *   Anthropic  https://platform.claude.com/docs/en/about-claude/model-deprecations
 *              https://platform.claude.com/docs/en/about-claude/models/overview
 *   OpenAI     https://developers.openai.com/api/docs/deprecations
 *   Google     https://ai.google.dev/gemini-api/docs/deprecations
 * All four were read on 28 Sep 2026.
 */

export type AiModelProvider = 'openai' | 'anthropic' | 'google';

/**
 * Chat/completion defaults.
 * - anthropic: claude-sonnet-5 is Active, retirement "not sooner than June 30,
 *   2027". It is a dateless id (its own alias), so there is no dated snapshot
 *   to fall off.
 * - openai: gpt-4o is an undated alias with no deprecation notice. Chosen over
 *   the GPT-5/6 reasoning models because QualCanvas's Chat Completions calls
 *   (temperature + max_tokens) are the shape gpt-4o accepts today.
 * - google: gemini-3.5-flash is GA with no shutdown date announced. Gemini 2.5
 *   is limited to projects that already used it, so new keys cannot rely on it.
 */
export const DEFAULT_CHAT_MODELS: Record<AiModelProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-5',
  google: 'gemini-3.5-flash',
};

/** Embedding defaults. Anthropic has no embeddings API. */
export const DEFAULT_EMBEDDING_MODELS: Record<'openai' | 'google', string> = {
  openai: 'text-embedding-3-small',
  google: 'gemini-embedding-001',
};

export interface RetiredModel {
  provider: AiModelProvider;
  /** Date requests start failing (YYYY-MM-DD where the provider lists one). A future date = deprecated. */
  shutdown: string;
  /** What a saved setting is mapped to when an AI call runs. */
  replacement: string;
}

const A = (shutdown: string, replacement: string): RetiredModel => ({ provider: 'anthropic', shutdown, replacement });
const O = (shutdown: string, replacement = DEFAULT_CHAT_MODELS.openai): RetiredModel => ({
  provider: 'openai',
  shutdown,
  replacement,
});
const G = (shutdown: string, replacement: string): RetiredModel => ({ provider: 'google', shutdown, replacement });

/**
 * Retired, or deprecated with an announced shutdown date. Anthropic
 * replacements are the ones Anthropic's deprecations page recommends. OpenAI
 * chat models map to our gpt-4o default (same request shape); Google maps to
 * the listed replacement or our Flash default.
 */
export const RETIRED_MODELS: Record<string, RetiredModel> = {
  // Anthropic
  'claude-sonnet-4-20250514': A('2026-06-15', 'claude-sonnet-4-6'),
  'claude-sonnet-4-0': A('2026-06-15', 'claude-sonnet-4-6'),
  'claude-sonnet-4': A('2026-06-15', 'claude-sonnet-4-6'),
  'claude-opus-4-20250514': A('2026-06-15', 'claude-opus-4-8'),
  'claude-opus-4-0': A('2026-06-15', 'claude-opus-4-8'),
  'claude-opus-4-1-20250805': A('2026-08-05', 'claude-opus-4-8'),
  'claude-opus-4-1': A('2026-08-05', 'claude-opus-4-8'),
  'claude-3-7-sonnet-20250219': A('2026-02-19', 'claude-sonnet-4-6'),
  'claude-3-7-sonnet-latest': A('2026-02-19', 'claude-sonnet-4-6'),
  'claude-3-5-haiku-20241022': A('2026-02-19', 'claude-haiku-4-5-20251001'),
  'claude-3-5-haiku-latest': A('2026-02-19', 'claude-haiku-4-5-20251001'),
  'claude-3-haiku-20240307': A('2026-04-20', 'claude-haiku-4-5-20251001'),
  'claude-3-5-sonnet-20240620': A('2025-10-28', 'claude-sonnet-4-6'),
  'claude-3-5-sonnet-20241022': A('2025-10-28', 'claude-sonnet-4-6'),
  'claude-3-5-sonnet-latest': A('2025-10-28', 'claude-sonnet-4-6'),
  'claude-3-opus-20240229': A('2026-01-05', 'claude-opus-4-8'),
  'claude-3-opus-latest': A('2026-01-05', 'claude-opus-4-8'),
  'claude-3-sonnet-20240229': A('2025-07-21', 'claude-sonnet-4-6'),
  'claude-2.0': A('2025-07-21', 'claude-opus-4-8'),
  'claude-2.1': A('2025-07-21', 'claude-opus-4-8'),
  'claude-instant-1.2': A('2024-11-06', 'claude-haiku-4-5-20251001'),

  // OpenAI (chat)
  'gpt-4.5-preview': O('2025-07-14'),
  'o1-preview': O('2025-07-28'),
  'o1-mini': O('2025-10-27'),
  'chatgpt-4o-latest': O('2026-02-17'),
  'gpt-4-0314': O('2026-03-26'),
  'gpt-4-0125-preview': O('2026-03-26'),
  'gpt-4-1106-preview': O('2026-03-26'),
  'gpt-4-32k': O('2025-06-06'),
  'gpt-4-vision-preview': O('2024-12-06'),
  'gpt-3.5-turbo-instruct': O('2026-09-28'),
  'gpt-3.5-turbo-1106': O('2026-09-28'),
  'gpt-3.5-turbo': O('2026-10-23'),
  'gpt-3.5-turbo-0125': O('2026-10-23'),
  'gpt-4': O('2026-10-23'),
  'gpt-4-0613': O('2026-10-23'),
  'gpt-4-turbo': O('2026-10-23'),
  'gpt-4-turbo-2024-04-09': O('2026-10-23'),
  'gpt-4.1-nano': O('2026-10-23'),
  'gpt-4o-2024-05-13': O('2026-10-23'),
  'o1-2024-12-17': O('2026-10-23'),
  'o3-mini-2025-01-31': O('2026-10-23'),
  'o4-mini-2025-04-16': O('2026-10-23'),

  // Google
  'gemini-2.0-flash': G('2026-06-01', 'gemini-3.5-flash'),
  'gemini-2.0-flash-001': G('2026-06-01', 'gemini-3.5-flash'),
  'gemini-2.0-flash-lite': G('2026-06-01', 'gemini-3.5-flash-lite'),
  'gemini-2.0-flash-lite-001': G('2026-06-01', 'gemini-3.5-flash-lite'),
  // Gemini 1.x is no longer on Google's model or deprecation pages (read 28 Sep
  // 2026): shut down, exact date not re-verified here.
  'gemini-1.5-flash': G('shut down (unlisted)', 'gemini-3.5-flash'),
  'gemini-1.5-pro': G('shut down (unlisted)', 'gemini-3.5-flash'),
  'gemini-pro': G('shut down (unlisted)', 'gemini-3.5-flash'),
  'text-embedding-004': G('2026-01-14', 'gemini-embedding-001'),
  'embedding-001': G('2025-10-30', 'gemini-embedding-001'),
};

/**
 * Normalise a model id for lookup: trims, lowercases, and drops the "models/"
 * prefix Google ids sometimes carry.
 */
function normalise(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/^models\//, '');
}

export function retiredModelInfo(model: string | null | undefined): RetiredModel | undefined {
  if (!model) return undefined;
  return RETIRED_MODELS[normalise(model)];
}

/**
 * The model an AI call should actually use. A saved setting that names a
 * retired (or announced-for-shutdown) model is mapped to its replacement and
 * a warning is logged; the stored setting is not rewritten.
 */
export function resolveModel(
  provider: string,
  model: string | null | undefined,
  warn: (msg: string) => void = console.warn,
): string | undefined {
  if (!model || !model.trim()) return undefined;
  const retired = retiredModelInfo(model);
  if (!retired) return model.trim();
  warn(
    `[ai] saved ${provider} model "${model}" is retired or scheduled for shutdown (${retired.shutdown}); using "${retired.replacement}" instead`,
  );
  return retired.replacement;
}
