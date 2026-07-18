import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getStripe } from '../lib/stripe.js';
import { auth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const billingRoutes = Router();

type QcPlan = 'student' | 'pro' | 'team';
const QC_PLANS: readonly QcPlan[] = ['student', 'pro', 'team'];

/**
 * Resolve the QualCanvas plan tier from a Stripe Price, trusting ONLY Stripe —
 * never client-supplied input. Our prices are tagged metadata.app='qualcanvas'
 * + metadata.plan; we fall back to the product name for any grandfathered /
 * untagged price. Returns null for unknown or foreign prices (this is a Stripe
 * account shared across JMS products), so callers can reject them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deriveQualcanvasPlan(stripe: ReturnType<typeof getStripe>, price: any): Promise<QcPlan | null> {
  if (!price) return null;
  const meta = price.metadata || {};
  if (meta.app === 'qualcanvas' && QC_PLANS.includes(meta.plan)) return meta.plan as QcPlan;
  try {
    let product = typeof price.product === 'object' ? price.product : null;
    if (!product && typeof price.product === 'string') product = await stripe.products.retrieve(price.product);
    const name = String(product?.name || '').toLowerCase();
    if (!name.startsWith('qualcanvas')) return null;
    if (name.includes('student')) return 'student';
    if (name.includes('team')) return 'team';
    if (name.includes('pro')) return 'pro';
  } catch {
    /* fall through to null */
  }
  return null;
}

// POST /api/billing/create-checkout — create a Stripe Checkout session
billingRoutes.post('/billing/create-checkout', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email account required for billing', 403);

    const stripe = getStripe();
    // NB: the client `plan` is deliberately ignored — the tier is derived from
    // the price on Stripe below. Trusting req.body.plan let a user pay the $5
    // Student price while claiming Team, and stack the .edu coupon on Student.
    const { priceId } = req.body;

    if (!priceId || typeof priceId !== 'string') {
      return res.status(400).json({ success: false, error: 'Price ID is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    // Resolve the plan from the price itself. This rejects unknown/foreign
    // price IDs on the shared Stripe account and pins the coupon/entitlement to
    // what the user is actually paying for.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let price: any;
    try {
      price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    } catch {
      throw new AppError('Invalid price', 400);
    }
    const plan = await deriveQualcanvasPlan(stripe, price);
    if (!plan) throw new AppError('Unrecognized plan price', 400);

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Auto-apply academic discount for .edu emails.
    // The Student tier is already academically priced ($5), so it must NOT
    // stack the 40% coupon on top (that would drop it to ~$3). The coupon
    // applies only to the full-price Pro/Team plans. `plan` is server-derived
    // from the price, so this can't be bypassed by a forged request body.
    const discounts: { coupon: string }[] = [];
    if (user.email.endsWith('.edu') && plan !== 'student' && process.env.STRIPE_ACADEMIC_COUPON_ID) {
      discounts.push({ coupon: process.env.STRIPE_ACADEMIC_COUPON_ID });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:5174';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(discounts.length > 0 ? { discounts } : {}),
      success_url: `${appUrl}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      metadata: { userId: user.id, plan },
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (err) {
    next(err);
  }
});

// POST /api/billing/create-portal — create a Stripe Customer Portal session
billingRoutes.post('/billing/create-portal', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email account required for billing', 403);

    const stripe = getStripe();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) throw new AppError('No billing account found', 404);

    const appUrl = process.env.APP_URL || 'http://localhost:5174';
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/account`,
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (err) {
    next(err);
  }
});

// GET /api/billing/subscription — get subscription details
billingRoutes.get('/billing/subscription', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email account required for billing', 403);

    const subscription = await prisma.subscription.findUnique({ where: { userId } });

    res.json({
      success: true,
      data: subscription
        ? {
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

const nowSecs = () => Math.floor(Date.now() / 1000);

// POST /api/billing/webhook — Stripe webhook handler
// This route needs raw body, registered separately in index.ts
export async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Idempotency: only successfully processed events are persisted. A failed
  // delivery must remain retryable by Stripe.
  const existing = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (existing) {
    return res.json({ received: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['items.data.price.product'],
          });
          const item = sub.items.data[0];
          // Entitlement is derived from the subscribed price, not client metadata.
          const plan = (await deriveQualcanvasPlan(stripe, item?.price)) || session.metadata?.plan || 'pro';
          const periodStart = item?.current_period_start ?? nowSecs();
          const periodEnd = item?.current_period_end ?? nowSecs() + 30 * 24 * 3600;
          await prisma.$transaction([
            prisma.subscription.upsert({
              where: { userId },
              create: {
                userId,
                stripeSubscriptionId: subscriptionId,
                stripePriceId: item?.price?.id || '',
                status: 'active',
                currentPeriodStart: new Date(periodStart * 1000),
                currentPeriodEnd: new Date(periodEnd * 1000),
              },
              update: {
                stripeSubscriptionId: subscriptionId,
                stripePriceId: item?.price?.id || '',
                status: 'active',
                currentPeriodStart: new Date(periodStart * 1000),
                currentPeriodEnd: new Date(periodEnd * 1000),
              },
            }),
            prisma.user.update({
              where: { id: userId },
              data: { plan },
            }),
          ]);
        }
        break;
      }

      case 'customer.subscription.updated': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = event.data.object as any;
        const existingSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });
        if (existingSub) {
          const item = sub.items.data[0];
          // Period fields live on the subscription ITEM in this API version;
          // reading sub.current_period_* yields undefined → Invalid Date.
          const periodStart = item?.current_period_start ?? nowSecs();
          const periodEnd = item?.current_period_end ?? nowSecs() + 30 * 24 * 3600;
          await prisma.subscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: {
              status: sub.status,
              currentPeriodStart: new Date(periodStart * 1000),
              currentPeriodEnd: new Date(periodEnd * 1000),
              cancelAtPeriodEnd: sub.cancel_at_period_end || false,
              stripePriceId: item?.price?.id || existingSub.stripePriceId,
            },
          });
          if (['active', 'trialing'].includes(sub.status)) {
            // Re-derive the tier from the (possibly changed) price so a plan
            // switch in the Customer Portal actually updates entitlements.
            const plan = await deriveQualcanvasPlan(stripe, item?.price);
            if (plan) {
              await prisma.user.update({ where: { id: existingSub.userId }, data: { plan } });
            }
          } else {
            await prisma.user.update({ where: { id: existingSub.userId }, data: { plan: 'free' } });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = event.data.object as any;
        const subRow = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
          include: { user: true },
        });
        if (subRow) {
          await prisma.$transaction([
            prisma.subscription.update({
              where: { stripeSubscriptionId: sub.id },
              data: { status: 'canceled' },
            }),
            prisma.user.update({
              where: { id: subRow.userId },
              data: { plan: 'free' },
            }),
          ]);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Recurring renewal succeeded — Stripe doesn't fire customer.subscription.updated
        // on routine renewals (only on plan changes), so without this handler the
        // Subscription.currentPeriodEnd would stay stuck at the original signup
        // date. Refresh from Stripe so UI showing "renews on X" is accurate, and
        // restore the paid tier (e.g. after recovering from a past_due dunning).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const subRow = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscriptionId },
          });
          if (subRow) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId, {
              expand: ['items.data.price.product'],
            });
            const item = sub.items.data[0];
            if (item) {
              await prisma.subscription.update({
                where: { stripeSubscriptionId: subscriptionId },
                data: {
                  status: sub.status,
                  currentPeriodStart: new Date(item.current_period_start * 1000),
                  currentPeriodEnd: new Date(item.current_period_end * 1000),
                },
              });
              if (['active', 'trialing'].includes(sub.status)) {
                const plan = await deriveQualcanvasPlan(stripe, item.price);
                if (plan) {
                  await prisma.user.update({ where: { id: subRow.userId }, data: { plan } });
                }
              }
            }
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const failedSub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscriptionId },
          });
          if (failedSub) {
            // Mark past_due but DO NOT demote the plan. Stripe Smart Retries
            // usually recover the payment within days (an expired card, a
            // temporary decline); demoting on the first failure stripped paying
            // users of access with no restore path. Final cancellation is
            // handled by customer.subscription.deleted.
            await prisma.subscription.update({
              where: { stripeSubscriptionId: subscriptionId },
              data: { status: 'past_due' },
            });
          }
        }
        break;
      }
    }

    // Record only after successful handling. The unique event id also makes
    // concurrent successful deliveries converge safely.
    try {
      await prisma.webhookEvent.create({ data: { id: event.id, type: event.type } });
    } catch (recordError) {
      const code = (recordError as { code?: string }).code;
      if (code !== 'P2002') throw recordError;
    }
    console.log(`[Stripe Webhook] Processed: ${event.type} (${event.id})`);
    return res.json({ received: true });
  } catch (err) {
    // A non-2xx response tells Stripe to retry transient failures. Because the
    // event was not persisted above, the next delivery will be processed.
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[Stripe Webhook] FAILED ${event.type} (${event.id}) — ${message}`, stack);
    return res.status(500).json({ received: false, processed: false, error: 'Webhook processing failed' });
  }
}
