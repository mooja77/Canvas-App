import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { getAuthUserId } from '../utils/routeHelpers.js';
import {
  HDYHAU_ASK_ACCOUNTS_CREATED_FROM,
  HDYHAU_CHANNELS,
  HDYHAU_OTHER_TEXT_MAX,
  forwardHdyhau,
} from '../lib/hdyhau.js';
import { isTestAccountEmail } from '../utils/testAccounts.js';

// How did you hear about us: asked once per account, right after signup.
// The answer OR the skip is stored on the User row so the question never
// comes back, on any device.
export const acquisitionRoutes = Router();

const hdyhauBodySchema = z
  .object({
    skipped: z.literal(true).optional(),
    channel: z.enum(HDYHAU_CHANNELS).optional(),
    otherText: z.string().trim().max(HDYHAU_OTHER_TEXT_MAX).optional(),
  })
  .strict()
  .refine((b) => (b.skipped === true) !== (b.channel !== undefined), {
    message: 'Send either a channel or skipped: true',
  });

// GET /user/hdyhau — should the question be shown to this account?
acquisitionRoutes.get('/user/hdyhau', async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    // Legacy access-code sessions have no User row to store an answer on.
    if (!userId) return res.json({ success: true, data: { ask: false } });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, createdAt: true, acquisitionRespondedAt: true },
    });
    if (!user) return next(new AppError('User not found', 404));

    // Not asked: fixture/operator accounts (their answer is noise, and the
    // weekly production activation canary must not meet an extra card), and
    // the hermetic E2E stack, whose journeys and screenshots predate it.
    const ask =
      user.acquisitionRespondedAt === null &&
      user.createdAt >= HDYHAU_ASK_ACCOUNTS_CREATED_FROM &&
      !isTestAccountEmail(user.email) &&
      process.env.E2E_TEST !== 'true';
    res.json({ success: true, data: { ask } });
  } catch (err) {
    next(err);
  }
});

// POST /user/hdyhau — record the answer or the skip, once.
// Body: { channel: <canonical key>, otherText?: string } | { skipped: true }
acquisitionRoutes.post('/user/hdyhau', validate(hdyhauBodySchema), async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return next(new AppError('Only email accounts can answer this question', 400));

    const body = req.body as z.infer<typeof hdyhauBodySchema>;
    const channel = body.skipped ? null : (body.channel ?? null);
    const otherText = channel === 'other' && body.otherText ? body.otherText : null;

    // Conditional write: only the first answer lands. A second call (another
    // tab, a double tap) matches no row and is a no-op, so nothing is sent twice.
    const { count } = await prisma.user.updateMany({
      where: { id: userId, acquisitionRespondedAt: null },
      data: {
        acquisitionChannel: channel,
        acquisitionOtherText: otherText,
        acquisitionRespondedAt: new Date(),
      },
    });

    if (count === 1 && channel) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      void forwardHdyhau(user?.email, channel, otherText);
    }

    res.json({ success: true, data: { recorded: count === 1 } });
  } catch (err) {
    next(err);
  }
});
