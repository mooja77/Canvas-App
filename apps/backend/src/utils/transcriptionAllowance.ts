import type { Request } from 'express';
import { getPlanLimits } from '../config/plans.js';
import { resolveRequestPlan } from '../middleware/planLimits.js';
import { resolveUserOpenAiKey, transcriptionPool } from './transcriptionMetering.js';

export interface TranscriptionAllowance {
  /** Plan that governs this canvas (the owner's). */
  plan: string;
  /** Included server-key minutes per month; null = no cap. */
  minutesPerMonth: number | null;
  /** Included minutes already used this month from the canvas owner's pool. */
  minutesUsed: number;
  /** Paid seats sharing the pool (Pro/Team are per seat; 1 otherwise). */
  seats: number;
  /** null = no cap. */
  minutesRemaining: number | null;
  /** The requester has their own OpenAI key: their transcriptions bypass the allowance. */
  usesOwnKey: boolean;
  /** The server has a platform OpenAI key, so included minutes can actually be used. */
  serverTranscriptionConfigured: boolean;
}

/**
 * What the audio-transcription screen shows before an upload: the same inputs
 * `checkTranscriptionMinutes` decides with (plan limit, monthly meter, BYO key),
 * so the screen and the gate cannot disagree.
 */
export async function transcriptionAllowanceFor(req: Request): Promise<TranscriptionAllowance> {
  const plan = await resolveRequestPlan(req);
  const perSeat = getPlanLimits(plan).transcriptionMinutesPerMonth;
  const userId = req.userId;
  const canvasId = req.params.id || req.params.canvasId;
  // The same pool checkTranscriptionMinutes meters: the canvas owner's minutes
  // x paid seats, shared by everyone transcribing into that owner's canvases.
  const [usesOwnKey, pool] = await Promise.all([
    resolveUserOpenAiKey(userId).then(Boolean),
    userId ? transcriptionPool(canvasId, userId, plan, perSeat) : Promise.resolve(null),
  ]);
  const cap = pool ? pool.minutesPerMonth : perSeat;
  const minutesUsed = pool ? pool.minutesUsed : 0;
  const unlimited = cap === Infinity;
  return {
    plan,
    minutesPerMonth: unlimited ? null : cap,
    minutesUsed,
    seats: pool?.seats ?? 1,
    minutesRemaining: unlimited ? null : Math.max(0, cap - minutesUsed),
    usesOwnKey,
    serverTranscriptionConfigured: Boolean(process.env.OPENAI_API_KEY),
  };
}
