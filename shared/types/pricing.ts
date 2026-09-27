import type { PlanTier } from './plans.js';

export type PaidPlanTier = Exclude<PlanTier, 'free'>;

/**
 * Published list prices in whole US dollars, as shown on /pricing. `annual` is
 * the price of one year billed up front; Team prices are per seat.
 *
 * These are the numbers the Stripe prices were created with. Checkout charges
 * the Stripe price (by VITE_STRIPE_*_PRICE_ID), so this table is for display
 * only: every figure on the pricing page, including the annual saving, is
 * derived from it so the copy cannot drift from the prices. Admin revenue reads
 * the real Stripe price of each subscription instead (backend lib/revenue.ts).
 */
export const PUBLISHED_PRICES_USD: Record<PaidPlanTier, { monthly: number; annual: number }> = {
  student: { monthly: 5, annual: 48 },
  pro: { monthly: 15, annual: 144 },
  team: { monthly: 39, annual: 384 },
};

/** Monthly equivalent of the annual price (e.g. Pro $144/yr -> $12). */
export function annualPricePerMonth(tier: PaidPlanTier): number {
  return PUBLISHED_PRICES_USD[tier].annual / 12;
}

/** Dollars a year saved by paying annually instead of 12 monthly payments. */
export function annualSavingUsd(tier: PaidPlanTier): number {
  const p = PUBLISHED_PRICES_USD[tier];
  return p.monthly * 12 - p.annual;
}

/**
 * Annual saving as a whole percentage of 12 monthly payments, rounded to the
 * nearest point: Student 20, Pro 20, Team 18 (exactly 17.95). The old badge
 * said "Save 20%" for every tier, which Team never was.
 */
export function annualSavingPercent(tier: PaidPlanTier): number {
  const p = PUBLISHED_PRICES_USD[tier];
  return Math.round((1 - p.annual / (p.monthly * 12)) * 100);
}

/** The largest annual saving across paid tiers, for an "up to N%" badge. */
export function maxAnnualSavingPercent(): number {
  return Math.max(...(Object.keys(PUBLISHED_PRICES_USD) as PaidPlanTier[]).map(annualSavingPercent));
}
