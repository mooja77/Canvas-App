import { prisma } from '../lib/prisma.js';
import { decryptApiKey } from './encryption.js';

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
