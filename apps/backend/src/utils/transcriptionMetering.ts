import { prisma } from '../lib/prisma.js';
import { decryptApiKey } from './encryption.js';
import { ENTITLED_SUBSCRIPTION_STATUSES } from '../lib/subscriptionStatus.js';

// Whisper costs ~$0.006/min on the platform OpenAI key. Transcription AiUsage
// rows store this as `costCents = ceil(minutes) * TRANSCRIPTION_CENTS_PER_MINUTE`,
// and the monthly meter reverses it to recover minutes. BYO-key transcriptions
// are recorded at cost 0 (the user is billed by OpenAI directly), so they never
// consume the metered monthly pool.
export const TRANSCRIPTION_CENTS_PER_MINUTE = 0.6;

/**
 * Resolve the OpenAI API key to transcribe ON BEHALF OF a user: their own
 * configured OpenAI key when present and decryptable, else undefined (the
 * caller then falls back to the server key). Shared by the transcription
 * worker (to bill the user's key) and the metering middleware (to know a BYO
 * user bypasses the monthly cap) so both agree on what counts as "BYO".
 *
 * A non-OpenAI provider or an un-decryptable key returns undefined — the
 * transcription proceeds on the server key and stays metered.
 */
export async function resolveUserOpenAiKey(userId?: string): Promise<string | undefined> {
  if (!userId) return undefined;
  const aiConfig = await prisma.userAiConfig.findUnique({ where: { userId } });
  if (!aiConfig || aiConfig.provider !== 'openai') return undefined;
  try {
    return decryptApiKey(aiConfig.apiKeyEncrypted, aiConfig.apiKeyIv, aiConfig.apiKeyTag);
  } catch {
    return undefined;
  }
}

/**
 * Server-key transcription minutes a user has consumed in the current calendar
 * month. BYO-key transcriptions are recorded at cost 0 and so are excluded;
 * legacy rows with no userId are excluded by the userId filter.
 */
export async function transcriptionMinutesUsedThisMonth(userId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const agg = await prisma.aiUsage.aggregate({
    _sum: { costCents: true },
    where: { userId, feature: 'transcribe', createdAt: { gte: monthStart } },
  });

  const cents = agg._sum.costCents ?? 0;
  return Math.round(cents / TRANSCRIPTION_CENTS_PER_MINUTE);
}

/**
 * Transcription pool (docs/qa/SEAT-BILLING.md). The allowance belongs to the
 * account that owns the canvas — the one paying — and is shared by everyone
 * who transcribes into that owner's canvases:
 *
 *   pool minutes = plan.transcriptionMinutesPerMonth × paid seats
 *
 * (seats = the Stripe quantity for a subscription billed per seat, else 1).
 * Usage is recorded with `poolOwnerId`, so deleting a canvas does not give
 * minutes back. Rows written before pooling have no poolOwnerId and still
 * count against the person who ran them.
 */
export interface TranscriptionPool {
  poolOwnerId: string;
  plan: string;
  seats: number;
  minutesPerMonth: number;
  minutesUsed: number;
}

export async function transcriptionPoolMinutesUsedThisMonth(poolOwnerId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const agg = await prisma.aiUsage.aggregate({
    _sum: { costCents: true },
    where: {
      feature: 'transcribe',
      createdAt: { gte: monthStart },
      OR: [{ poolOwnerId }, { poolOwnerId: null, userId: poolOwnerId }],
    },
  });
  return Math.round((agg._sum.costCents ?? 0) / TRANSCRIPTION_CENTS_PER_MINUTE);
}

/** The pool owner for a canvas: its owner, or the requester for an unlinked legacy canvas. */
export async function transcriptionPoolOwner(canvasId: string | undefined, requesterId: string): Promise<string> {
  if (!canvasId) return requesterId;
  const canvas = await prisma.codingCanvas.findUnique({
    where: { id: canvasId },
    select: { userId: true, dashboardAccess: { select: { userId: true } } },
  });
  return canvas?.userId ?? canvas?.dashboardAccess?.userId ?? requesterId;
}

export async function transcriptionPool(
  canvasId: string | undefined,
  requesterId: string,
  plan: string,
  perSeatMinutes: number,
): Promise<TranscriptionPool> {
  const poolOwnerId = await transcriptionPoolOwner(canvasId, requesterId);
  const sub = await prisma.subscription.findUnique({
    where: { userId: poolOwnerId },
    select: { status: true, quantity: true },
  });
  const billedPerSeat = (plan === 'pro' || plan === 'team') && !!sub && ENTITLED_SUBSCRIPTION_STATUSES.has(sub.status);
  const seats = billedPerSeat ? Math.max(1, sub!.quantity) : 1;
  return {
    poolOwnerId,
    plan,
    seats,
    minutesPerMonth: perSeatMinutes === Infinity ? Infinity : perSeatMinutes * seats,
    minutesUsed: await transcriptionPoolMinutesUsedThisMonth(poolOwnerId),
  };
}
