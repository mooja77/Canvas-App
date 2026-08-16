import { afterEach, describe, expect, it, vi } from 'vitest';
import { Webhook } from 'svix';
import { applyResendEvent, handleResendWebhook } from './resendWebhook.js';

function fakeDatabase(
  options: {
    accountDelivery?: Record<string, unknown> | null;
    newsletterDelivery?: Record<string, unknown> | null;
    duplicate?: boolean;
  } = {},
) {
  const tx = {
    webhookEvent: {
      findUnique: vi.fn().mockResolvedValue(options.duplicate ? { id: 'existing' } : null),
      create: vi.fn().mockResolvedValue({}),
    },
    emailDelivery: {
      findUnique: vi.fn().mockResolvedValue(options.accountDelivery ?? null),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    newsletterDelivery: {
      findUnique: vi.fn().mockResolvedValue(options.newsletterDelivery ?? null),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    emailPreference: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    newsletterSubscriber: { update: vi.fn().mockResolvedValue({}) },
  };
  return {
    tx,
    db: { $transaction: vi.fn(async (callback) => callback(tx)) },
  };
}

describe('Resend delivery events', () => {
  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it('marks a tagged account delivery as provider-confirmed delivered', async () => {
    const { db, tx } = fakeDatabase({
      accountDelivery: { id: 'delivery-1', userId: 'user-1', status: 'accepted', providerEventAt: null },
    });

    await expect(
      applyResendEvent(
        {
          type: 'email.delivered',
          created_at: '2026-08-12T12:00:00.000Z',
          data: {
            email_id: 'resend-1',
            tags: { delivery_kind: 'account', delivery_id: 'delivery-1' },
          },
        },
        'event-1',
        db,
      ),
    ).resolves.toEqual({ handled: true });

    expect(tx.emailDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({
        status: 'delivered',
        provider: 'resend',
        providerMessageId: 'resend-1',
        deliveredAt: new Date('2026-08-12T12:00:00.000Z'),
      }),
    });
    expect(tx.emailPreference.updateMany).not.toHaveBeenCalled();
  });

  it('suppresses every optional category after a complaint', async () => {
    const { db, tx } = fakeDatabase({
      accountDelivery: { id: 'delivery-2', userId: 'user-2', status: 'delivered', providerEventAt: null },
    });

    await applyResendEvent(
      {
        type: 'email.complained',
        created_at: '2026-08-12T13:00:00.000Z',
        data: { tags: { delivery_kind: 'account', delivery_id: 'delivery-2' } },
      },
      'event-2',
      db,
    );

    expect(tx.emailDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'complained' }) }),
    );
    expect(tx.emailPreference.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-2' },
      data: expect.objectContaining({
        lifecycle: false,
        productUpdates: false,
        trainingTips: false,
        inactivityNudges: false,
        providerSuppressionReason: 'email.complained',
      }),
    });
  });

  it('suppresses a newsletter subscriber after a provider bounce', async () => {
    const { db, tx } = fakeDatabase({
      newsletterDelivery: {
        id: 'newsletter-1',
        subscriberId: 'subscriber-1',
        status: 'accepted',
        providerEventAt: null,
      },
    });

    await applyResendEvent(
      {
        type: 'email.bounced',
        created_at: '2026-08-12T14:00:00.000Z',
        data: { tags: { delivery_kind: 'newsletter', delivery_id: 'newsletter-1' } },
      },
      'event-3',
      db,
    );

    expect(tx.newsletterSubscriber.update).toHaveBeenCalledWith({
      where: { id: 'subscriber-1' },
      data: expect.objectContaining({ status: 'suppressed', providerSuppressionReason: 'email.bounced' }),
    });
  });

  it('does not downgrade a complaint with a later delivered event', async () => {
    const { db, tx } = fakeDatabase({
      accountDelivery: {
        id: 'delivery-3',
        userId: 'user-3',
        status: 'complained',
        providerEventAt: new Date('2026-08-12T13:00:00.000Z'),
      },
    });

    await expect(
      applyResendEvent(
        {
          type: 'email.delivered',
          created_at: '2026-08-12T14:00:00.000Z',
          data: { tags: { delivery_kind: 'account', delivery_id: 'delivery-3' } },
        },
        'event-4',
        db,
      ),
    ).resolves.toEqual({ handled: true, ignored: 'stale_or_terminal' });
    expect(tx.emailDelivery.update).not.toHaveBeenCalled();
  });

  it('requests a provider retry when a tagged lifecycle delivery is not visible yet', async () => {
    const { db } = fakeDatabase();
    await expect(
      applyResendEvent(
        {
          type: 'email.delivered',
          data: { tags: { delivery_kind: 'account', delivery_id: 'not-yet-visible' } },
        },
        'event-5',
        db,
      ),
    ).resolves.toEqual({
      handled: false,
      ignored: 'unknown_delivery',
      retryableMissing: true,
    });
  });

  it('treats a repeated provider event as an idempotent success', async () => {
    const { db, tx } = fakeDatabase({ duplicate: true });
    await expect(
      applyResendEvent(
        {
          type: 'email.delivered',
          data: { tags: { delivery_kind: 'account', delivery_id: 'delivery-1' } },
        },
        'event-already-seen',
        db,
      ),
    ).resolves.toEqual({ handled: true, duplicate: true });
    expect(tx.emailDelivery.findUnique).not.toHaveBeenCalled();
  });

  it('accepts an untagged transactional event without mutating lifecycle state', async () => {
    const { db, tx } = fakeDatabase();
    await expect(
      applyResendEvent(
        { type: 'email.delivered', data: { email_id: 'verification-message' } },
        'event-transactional',
        db,
      ),
    ).resolves.toEqual({
      handled: false,
      ignored: 'unknown_delivery',
      retryableMissing: false,
    });
    expect(tx.webhookEvent.create).not.toHaveBeenCalled();
  });

  it('verifies the raw signed payload before accepting an event', async () => {
    const secret = `whsec_${Buffer.from('qualcanvas-test-secret').toString('base64')}`;
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const payload = JSON.stringify({ type: 'email.opened', data: { email_id: 'resend-2' } });
    const id = 'signed-event-1';
    const timestamp = new Date();
    const signature = new Webhook(secret).sign(id, timestamp, payload);
    const req = {
      headers: {
        'svix-id': id,
        'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
        'svix-signature': signature,
      },
      body: Buffer.from(payload),
    };
    const response = { statusCode: 200, body: null as unknown, success: true };
    const res = {
      status: vi.fn((code: number) => {
        response.statusCode = code;
        return res;
      }),
      json: vi.fn((body: unknown) => {
        response.body = body;
        return res;
      }),
    };

    await handleResendWebhook(req as never, res as never);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true, handled: false, ignored: 'unsupported_event' });
  });
});
