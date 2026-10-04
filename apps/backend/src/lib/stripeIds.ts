/**
 * Real Stripe subscription ids start with "sub_". Production also holds
 * complimentary rows written by hand ("comp_...", read-only check 28 Sep 2026)
 * that Stripe has never seen. Any code that would send a subscription id to
 * Stripe must check this first: Stripe answers "No such subscription"
 * (Sentry QUALCANVAS-7, GET /api/admin/billing).
 */
export function isStripeSubscriptionId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('sub_');
}
