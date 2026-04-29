import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { getAuthUserId } from '../utils/routeHelpers.js';
import { getEmailPreferencePayload, unsubscribeByToken, updateEmailPreferences } from '../lib/lifecycleEmail.js';

export const lifecycleEmailRoutes = Router();
export const publicLifecycleEmailRoutes = Router();

const preferencesSchema = z.object({
  lifecycle: z.boolean().optional(),
  productUpdates: z.boolean().optional(),
  trainingTips: z.boolean().optional(),
  inactivityNudges: z.boolean().optional(),
});

function requireUserId(req: import('express').Request): string {
  const userId = getAuthUserId(req);
  if (!userId) throw new AppError('Email authentication required', 401);
  return userId;
}

// ─── Public unsubscribe endpoint used by email footer links ───
publicLifecycleEmailRoutes.get('/unsubscribe/:token', async (req, res, next) => {
  try {
    const ok = await unsubscribeByToken(req.params.token);
    const title = ok ? 'You are unsubscribed' : 'Unsubscribe link not found';
    const message = ok
      ? 'You will no longer receive QualCanvas lifecycle, training, inactivity, or product update emails.'
      : 'This unsubscribe link is invalid or has expired.';

    res.type('html').send(`
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
    <p style="font-size:17px;line-height:1.6;margin:0;">${message}</p>
  </main>
</body>
</html>`);
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
