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

  // Anthropic (https://platform.claude.com/docs/en/about-claude/models/overview, read 28 Sep 2026)
  'claude-sonnet-5': { inputPer1M: 2.0, outputPer1M: 10.0 },
  'claude-haiku-4-5-20251001': { inputPer1M: 1.0, outputPer1M: 5.0 },
  'claude-haiku-4-5': { inputPer1M: 1.0, outputPer1M: 5.0 },
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
