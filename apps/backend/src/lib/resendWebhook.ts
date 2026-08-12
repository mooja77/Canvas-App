import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { Webhook } from 'svix';
import { prisma } from './prisma.js';

type ResendOutcome = 'delivered' | 'bounced' | 'complained' | 'suppressed' | 'failed_permanent';
type DeliveryKind = 'account' | 'newsletter';

interface ResendEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    tags?: Record<string, string> | Array<{ name: string; value: string }>;
  };
}

export interface ResendEventResult {
  handled: boolean;
  duplicate?: boolean;
  ignored?: 'unsupported_event' | 'unknown_delivery' | 'stale_or_terminal';
  retryableMissing?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any;

const SAFETY_TERMINAL = new Set(['bounced', 'complained', 'suppressed']);

function outcomeForEvent(type: string): ResendOutcome | null {
  switch (type) {
    case 'email.delivered':
      return 'delivered';
    case 'email.bounced':
      return 'bounced';
    case 'email.complained':
      return 'complained';
    case 'email.suppressed':
      return 'suppressed';
    case 'email.failed':
      return 'failed_permanent';
    default:
      return null;
  }
}

function eventTags(event: ResendEvent): Record<string, string> {
  const tags = event.data?.tags;
  if (!tags) return {};
  if (Array.isArray(tags)) {
    return Object.fromEntries(tags.map((tag) => [tag.name, tag.value]));
  }
  return tags;
}

function eventTime(event: ResendEvent): Date {
  const parsed = event.created_at ? new Date(event.created_at) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function deliveryUpdate(outcome: ResendOutcome, at: Date, providerMessageId?: string) {
  return {
    status: outcome,
    provider: 'resend',
    providerMessageId: providerMessageId || undefined,
    providerEventAt: at,
    error: outcome === 'failed_permanent' ? 'Resend reported email.failed' : null,
    ...(outcome === 'delivered' ? { deliveredAt: at } : {}),
    ...(outcome === 'bounced' ? { bouncedAt: at } : {}),
    ...(outcome === 'complained' ? { complainedAt: at } : {}),
    ...(outcome === 'suppressed' ? { suppressedAt: at } : {}),
  };
}

function shouldIgnore(current: { status: string; providerEventAt?: Date | null }, outcome: ResendOutcome, at: Date) {
  if (current.providerEventAt && current.providerEventAt.getTime() >= at.getTime()) return true;
  // A later or duplicated provider "delivered" event must never re-enable a
  // delivery after a bounce, complaint, or suppression outcome.
  return SAFETY_TERMINAL.has(current.status) && outcome === 'delivered';
}

export async function applyResendEvent(
  event: ResendEvent,
  svixId: string,
  db: PrismaLike = prisma,
): Promise<ResendEventResult> {
  const outcome = outcomeForEvent(event.type);
  if (!outcome) return { handled: false, ignored: 'unsupported_event' };

  const tags = eventTags(event);
  const taggedKind = tags.delivery_kind as DeliveryKind | undefined;
  const taggedId = tags.delivery_id;
  const messageId = event.data?.email_id;
  const providerEventId = `resend:${svixId}`;
  const at = eventTime(event);

  try {
    return await db.$transaction(async (tx: PrismaLike) => {
      if (await tx.webhookEvent.findUnique({ where: { id: providerEventId } })) {
        return { handled: true, duplicate: true };
      }

      let kind: DeliveryKind | null = taggedKind === 'account' || taggedKind === 'newsletter' ? taggedKind : null;
      let delivery = null;

      if (kind === 'account' && taggedId) {
        delivery = await tx.emailDelivery.findUnique({ where: { id: taggedId } });
      } else if (kind === 'newsletter' && taggedId) {
        delivery = await tx.newsletterDelivery.findUnique({ where: { id: taggedId } });
      }

      if (!delivery && messageId) {
        delivery = await tx.emailDelivery.findFirst({
          where: { provider: 'resend', providerMessageId: messageId },
        });
        if (delivery) kind = 'account';
      }
      if (!delivery && messageId) {
        delivery = await tx.newsletterDelivery.findFirst({
          where: { provider: 'resend', providerMessageId: messageId },
        });
        if (delivery) kind = 'newsletter';
      }

      if (!delivery || !kind) {
        return {
          handled: false,
          ignored: 'unknown_delivery',
          retryableMissing: Boolean(taggedId && taggedKind),
        };
      }

      await tx.webhookEvent.create({ data: { id: providerEventId, type: event.type } });

      if (shouldIgnore(delivery, outcome, at)) {
        return { handled: true, ignored: 'stale_or_terminal' };
      }

      if (kind === 'account') {
        await tx.emailDelivery.update({
          where: { id: delivery.id },
          data: { ...deliveryUpdate(outcome, at, messageId), claimedAt: null, retryAt: null },
        });
        if (SAFETY_TERMINAL.has(outcome)) {
          await tx.emailPreference.updateMany({
            where: { userId: delivery.userId },
            data: {
              lifecycle: false,
              productUpdates: false,
              trainingTips: false,
              inactivityNudges: false,
              providerSuppressedAt: at,
              providerSuppressionReason: event.type,
            },
          });
        }
      } else {
        await tx.newsletterDelivery.update({
          where: { id: delivery.id },
          data: deliveryUpdate(outcome, at, messageId),
        });
        if (SAFETY_TERMINAL.has(outcome)) {
          await tx.newsletterSubscriber.update({
            where: { id: delivery.subscriberId },
            data: {
              status: 'suppressed',
              providerSuppressedAt: at,
              providerSuppressionReason: event.type,
            },
          });
        }
      }

      return { handled: true };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { handled: true, duplicate: true };
    }
    throw error;
  }
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function handleResendWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ success: false, error: 'Provider webhook is not configured' });
    return;
  }

  const svixId = header(req, 'svix-id');
  const svixTimestamp = header(req, 'svix-timestamp');
  const svixSignature = header(req, 'svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature || !Buffer.isBuffer(req.body)) {
    res.status(400).json({ success: false, error: 'Invalid webhook request' });
    return;
  }

  let event: ResendEvent;
  try {
    event = new Webhook(secret).verify(req.body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendEvent;
  } catch {
    res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    return;
  }

  try {
    const result = await applyResendEvent(event, svixId);
    if (result.retryableMissing) {
      res.status(503).json({ success: false, retry: true });
      return;
    }
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Email] Resend webhook processing failed:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
}
