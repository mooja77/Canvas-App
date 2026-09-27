import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set — billing features disabled');
}

// Reliability fix #7 — maxNetworkRetries protects us from transient network
// hiccups between Railway and Stripe. Without it, a single dropped TCP
// packet during checkout finalization can leave the user paid-up at Stripe
// but with no Subscription row on our side. Stripe SDK uses idempotent
// retries so this is safe.
//
// STRIPE_API_HOST/PORT/PROTOCOL point the SDK at a local Stripe double for the
// full-stack test suite and simulation (e2e/fullstack). They are ignored in
// production so a stray variable can never redirect live billing traffic.
const stubHost = process.env.NODE_ENV !== 'production' ? process.env.STRIPE_API_HOST : undefined;
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: stubHost ? 0 : 3,
      timeout: 10_000,
      ...(stubHost
        ? {
            host: stubHost,
            port: Number(process.env.STRIPE_API_PORT || 443),
            protocol: process.env.STRIPE_API_PROTOCOL === 'http' ? 'http' : 'https',
          }
        : {}),
    })
  : null;

export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return stripe;
}
