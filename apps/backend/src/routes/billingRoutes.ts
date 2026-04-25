import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getStripe } from '../lib/stripe.js';
import { auth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const billingRoutes = Router();

// POST /api/billing/create-checkout — create a Stripe Checkout session
billingRoutes.post('/billing/create-checkout', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email account required for billing', 403);

    const stripe = getStripe();
    const { priceId, plan } = req.body;

    if (!priceId || typeof priceId !== 'string') {
      return res.status(400).json({ success: false, error: 'Price ID is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

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

    // Auto-apply academic discount for .edu emails
    const discounts: { coupon: string }[] = [];
    if (user.email.endsWith('.edu') && process.env.STRIPE_ACADEMIC_COUPON_ID) {
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
      metadata: { userId: user.id, plan: plan || 'pro' },
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

  // Idempotency: skip already-processed events
  const existing = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (existing) {
    return res.json({ received: true });
  }
  await prisma.webhookEvent.create({ data: { id: event.id, type: event.type } });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan || 'pro';
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const item = sub.items.data[0];
          const periodStart = item?.current_period_start ?? Math.floor(Date.now() / 1000);
          const periodEnd = item?.current_period_end ?? Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
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
          await prisma.subscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: {
              status: sub.status,
              currentPeriodStart: new Date(sub.current_period_start * 1000),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              cancelAtPeriodEnd: sub.cancel_at_period_end || false,
              stripePriceId: sub.items.data[0]?.price?.id || existingSub.stripePriceId,
            },
          });
          // Downgrade user if subscription is no longer active
          if (!['active', 'trialing'].includes(sub.status)) {
            await prisma.user.update({
              where: { id: existingSub.userId },
              data: { plan: 'free' },
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = event.data.object as any;
        const existing = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
          include: { user: true },
        });
        if (existing) {
          await prisma.$transaction([
            prisma.subscription.update({
              where: { stripeSubscriptionId: sub.id },
              data: { status: 'canceled' },
            }),
            prisma.user.update({
              where: { id: existing.userId },
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
        // date. Refresh from Stripe so UI showing "renews on X" is accurate.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const existing = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscriptionId },
          });
          if (existing) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
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
            await prisma.$transaction([
              prisma.subscription.update({
                where: { stripeSubscriptionId: subscriptionId },
                data: { status: 'past_due' },
              }),
              prisma.user.update({
                where: { id: failedSub.userId },
                data: { plan: 'free' },
              }),
            ]);
          }
        }
        break;
      }
    }

    console.log(`[Stripe Webhook] Processed: ${event.type} (${event.id})`);
    res.json({ received: true });
  } catch (err) {
    // Acknowledge receipt with 200 so Stripe doesn't retry indefinitely with
    // exponential backoff (up to 3 days). The event ID was already recorded
    // in WebhookEvent above, so a re-delivery wouldn't help anyway — it'd
    // just hit the idempotency dedupe and short-circuit. Real failures are
    // visible in Railway logs prefixed [Stripe Webhook] FAILED.
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[Stripe Webhook] FAILED ${event.type} (${event.id}) — ${message}`, stack);
    res.status(200).json({ received: true, processed: false, error: message });
  }
}
