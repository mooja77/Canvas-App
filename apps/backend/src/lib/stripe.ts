import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set — billing features disabled');
}

// Reliability fix #7 — maxNetworkRetries protects us from transient network
// hiccups between Railway and Stripe. Without it, a single dropped TCP
// packet during checkout finalization can leave the user paid-up at Stripe
// but with no Subscription row on our side. Stripe SDK uses idempotent
// retries so this is safe.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 3,
      timeout: 10_000,
    })
  : null;

export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return stripe;
}
