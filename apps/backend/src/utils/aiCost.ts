/**
 * AI cost calculation in cents (USD).
 *
 * Pricing as of 2026-05-13. Numbers are USD per 1,000,000 tokens.
 * Update when providers change prices.
 *
 * NOTE: this is best-effort and only used for in-product analytics dashboards
 * and chargeback math. Authoritative billing is whatever the provider charges
 * us; this calculation can drift.
 */

interface ModelPricing {
  inputPer1M: number; // USD
  outputPer1M: number; // USD
}

const PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0 },

  // Anthropic
  'claude-sonnet-4-20250514': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-sonnet-4-5': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-haiku-4-5-20251001': { inputPer1M: 0.8, outputPer1M: 4.0 },
  'claude-haiku-4-5': { inputPer1M: 0.8, outputPer1M: 4.0 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-haiku-20241022': { inputPer1M: 0.8, outputPer1M: 4.0 },

  // Google
  'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.0 },
};

/**
 * Calculate cost in cents (1/100 USD) for a single LLM call.
 *
 * Returns a non-negative integer. Unknown models cost 0 (so we never
 * over-charge a user for math errors) — we'll see unknown-model events in
 * AiUsage rows with the model name and can backfill pricing later.
 */
export function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  const usd = (inputTokens * pricing.inputPer1M) / 1_000_000 + (outputTokens * pricing.outputPer1M) / 1_000_000;
  return Math.max(0, Math.round(usd * 100));
}
