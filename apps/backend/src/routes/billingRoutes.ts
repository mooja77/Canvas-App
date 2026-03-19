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
  } catch (err) { next(err); }
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
  } catch (err) { next(err); }
});

// GET /api/billing/subscription — get subscription details
billingRoutes.get('/billing/subscription', auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email account required for billing', 403);

    const subscription = await prisma.subscription.findUnique({ where: { userId } });

    res.json({
      success: true,
      data: subscription ? {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      } : null,
    });
  } catch (err) { next(err); }
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
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
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
        const sub = event.data.object as any;
        const existing = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });
        if (existing) {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: {
              status: sub.status,
              currentPeriodStart: new Date(sub.current_period_start * 1000),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              cancelAtPeriodEnd: sub.cancel_at_period_end || false,
              stripePriceId: sub.items.data[0]?.price?.id || existing.stripePriceId,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
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

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { status: 'past_due' },
          });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
