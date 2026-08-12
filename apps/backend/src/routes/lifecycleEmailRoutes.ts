import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { getAuthUserId } from '../utils/routeHelpers.js';
import { getEmailPreferencePayload, unsubscribeByToken, updateEmailPreferences } from '../lib/lifecycleEmail.js';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../lib/email.js';
import { sha256 } from '../utils/hashing.js';

export const lifecycleEmailRoutes = Router();
export const publicLifecycleEmailRoutes = Router();

const preferencesSchema = z.object({
  lifecycle: z.boolean().optional(),
  productUpdates: z.boolean().optional(),
  trainingTips: z.boolean().optional(),
  inactivityNudges: z.boolean().optional(),
});

const newsletterSchema = z.object({ email: z.string().email().max(254) });
const newsletterSubscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true',
  message: { success: false, error: 'Too many subscription requests; please try again later' },
});

function publicApiUrl(): string {
  return (
    process.env.PUBLIC_API_URL ||
    process.env.API_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://api.qualcanvas.com/api' : 'http://localhost:3007/api')
  ).replace(/\/$/, '');
}

function requireUserId(req: import('express').Request): string {
  const userId = getAuthUserId(req);
  if (!userId) throw new AppError('Email authentication required', 401);
  return userId;
}

function unsubscribePage(options: { confirmed: boolean; token: string }): string {
  const title = options.confirmed ? 'You are unsubscribed' : 'Unsubscribe from product emails';
  const content = options.confirmed
    ? '<p style="font-size:17px;line-height:1.6;margin:0;">You will no longer receive QualCanvas lifecycle, training, inactivity, or product update emails.</p>'
    : `<p style="font-size:17px;line-height:1.6;margin:0 0 24px;">Confirm that you want to stop all optional QualCanvas product emails.</p>
       <form method="post" action="/api/email/unsubscribe/${encodeURIComponent(options.token)}">
         <button type="submit" style="border:0;border-radius:8px;background:#0f766e;color:white;padding:12px 20px;font-weight:700;cursor:pointer;">Confirm unsubscribe</button>
       </form>`;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — QualCanvas</title>
</head>
<body style="margin:0;background:#f3f0e8;font-family:Georgia,'Times New Roman',serif;color:#1f2933;">
  <main style="max-width:680px;margin:12vh auto;padding:40px;background:#fffaf0;border:1px solid #ded2bd;border-radius:18px;">
    <p style="margin:0 0 10px;text-transform:uppercase;letter-spacing:.16em;font-size:12px;color:#0f766e;">QualCanvas</p>
    <h1 style="margin:0 0 16px;font-size:32px;">${title}</h1>
    ${content}
  </main>
</body>
</html>`;
}

// GET is confirmation-only. It must not mutate state because mail scanners
// routinely follow links. RFC 8058 clients use the POST route below.
publicLifecycleEmailRoutes.get('/unsubscribe/:token', async (req, res, next) => {
  try {
    res.type('html').send(unsubscribePage({ confirmed: false, token: req.params.token }));
  } catch (err) {
    next(err);
  }
});

publicLifecycleEmailRoutes.post('/unsubscribe/:token', async (req, res, next) => {
  try {
    // Deliberately return the same response for valid, invalid and already-used
    // tokens. Unsubscribe is idempotent and does not expose account existence.
    await unsubscribeByToken(req.params.token);
    res.type('html').send(unsubscribePage({ confirmed: true, token: '' }));
  } catch (err) {
    next(err);
  }
});

// ─── Public field-guide newsletter double opt-in ───
publicLifecycleEmailRoutes.post(
  '/newsletter/subscribe',
  newsletterSubscribeLimiter,
  validate(newsletterSchema),
  async (req, res, next) => {
    try {
      const email = req.body.email.trim().toLowerCase();
      const token = crypto.randomBytes(32).toString('hex');
      const unsubscribeToken = crypto.randomBytes(24).toString('hex');
      const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });

      if (existing?.status === 'confirmed') {
        return res.json({ success: true, message: 'Check your inbox to confirm your subscription.' });
      }

      await prisma.newsletterSubscriber.upsert({
        where: { email },
        create: {
          email,
          status: 'pending',
          confirmTokenHash: sha256(token),
          unsubscribeToken,
        },
        update: {
          status: 'pending',
          confirmTokenHash: sha256(token),
          unsubscribeToken,
          unsubscribedAt: null,
        },
      });

      const confirmUrl = `${publicApiUrl()}/email/newsletter/confirm/${token}`;
      const sent = await sendEmail(
        email,
        'Confirm your QualCanvas field-guide subscription',
        `<p>Confirm that you want the QualCanvas methodology field guide.</p><p><a href="${confirmUrl}">Confirm subscription</a></p><p>If you did not request this, ignore this email.</p>`,
      );
      if (!sent) throw new AppError('Confirmation email could not be sent', 503);

      res.status(202).json({ success: true, message: 'Check your inbox to confirm your subscription.' });
    } catch (err) {
      next(err);
    }
  },
);

publicLifecycleEmailRoutes.get('/newsletter/confirm/:token', async (req, res, next) => {
  try {
    const subscriber = await prisma.newsletterSubscriber.findFirst({
      where: { confirmTokenHash: sha256(req.params.token), status: 'pending' },
    });
    if (!subscriber) throw new AppError('Confirmation link is invalid or has already been used', 400);

    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { status: 'confirmed', confirmedAt: new Date(), confirmTokenHash: null, unsubscribedAt: null },
    });
    res
      .type('html')
      .send(
        '<main style="max-width:640px;margin:12vh auto;font-family:system-ui;padding:32px"><h1>Subscription confirmed</h1><p>You will receive the QualCanvas methodology field guide. Every message includes an unsubscribe link.</p><p><a href="https://qualcanvas.com/methodology">Read the field guide</a></p></main>',
      );
  } catch (err) {
    next(err);
  }
});

function newsletterUnsubscribePage(token: string, confirmed: boolean): string {
  return `<main style="max-width:640px;margin:12vh auto;font-family:system-ui;padding:32px">
    <h1>${confirmed ? 'You are unsubscribed' : 'Unsubscribe from the QualCanvas field guide'}</h1>
    ${
      confirmed
        ? '<p>You will not receive further field-guide emails.</p>'
        : `<p>Confirm that you want to stop field-guide emails.</p><form method="post" action="/api/email/newsletter/unsubscribe/${encodeURIComponent(
            token,
          )}"><button type="submit">Confirm unsubscribe</button></form>`
    }
  </main>`;
}

publicLifecycleEmailRoutes.get('/newsletter/unsubscribe/:token', async (req, res, next) => {
  try {
    res.type('html').send(newsletterUnsubscribePage(req.params.token, false));
  } catch (err) {
    next(err);
  }
});

publicLifecycleEmailRoutes.post('/newsletter/unsubscribe/:token', async (req, res, next) => {
  try {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: req.params.token },
    });
    if (subscriber) {
      await prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { status: 'unsubscribed', unsubscribedAt: new Date(), confirmTokenHash: null },
      });
    }
    res
      .type('html')
      .send(newsletterUnsubscribePage('', true));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/email/preferences ───
lifecycleEmailRoutes.get('/email/preferences', async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.json({
        success: true,
        data: {
          lifecycle: false,
          productUpdates: false,
          trainingTips: false,
          inactivityNudges: false,
          unsubscribedAt: null,
        },
      });
    }
    const data = await getEmailPreferencePayload(userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/email/preferences ───
lifecycleEmailRoutes.put('/email/preferences', validate(preferencesSchema), async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const data = await updateEmailPreferences(userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
