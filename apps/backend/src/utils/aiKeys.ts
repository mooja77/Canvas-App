import { prisma } from '../lib/prisma.js';
import { decryptApiKey } from './encryption.js';

/**
 * Whose AI key pays — the single place that decides it for transcription.
 *
 * QualCanvas never holds a paid AI key of its own (decision 28 Sep 2026).
 * Every call runs on a customer's key, stored AES-256-GCM encrypted in
 * UserAiConfig. There is no server key and no included allowance.
 *
 * Collaborator rule (a coder transcribing into someone else's canvas):
 *   1. The requester's own OpenAI key, when they have connected one. They
 *      chose to pay; the owner is never charged when the coder can pay.
 *   2. Otherwise the canvas owner's OpenAI key, but ONLY when the owner has
 *      switched on "Let collaborators transcribe with my key"
 *      (UserAiConfig.shareWithCollaborators, off by default). The screen names
 *      the owner before the upload, and the owner sees the minutes each
 *      collaborator used under Account -> AI.
 *   3. Otherwise nobody can pay: the route answers TRANSCRIPTION_KEY_REQUIRED.
 * The key is resolved again when the job runs, so switching sharing off or
 * removing the key stops queued jobs from spending on it.
 */

/** OpenAI's published Whisper price, https://developers.openai.com/api/docs/pricing (read 28 Sep 2026). */
export const WHISPER_USD_PER_MINUTE = 0.006;

export type TranscriptionKeySource = 'own' | 'canvas-owner';

export interface TranscriptionKeyResolution {
  /** Decrypted key that will be sent to OpenAI, or null when nobody can pay. */
  apiKey: string | null;
  /** The account whose key pays (null when none). */
  keyOwnerId: string | null;
  source: TranscriptionKeySource | null;
  /** The canvas owner (the requester for a canvas they own). */
  canvasOwnerId: string;
  isCanvasOwner: boolean;
  /** The canvas owner has an OpenAI key and lets collaborators use it. */
  ownerSharesKey: boolean;
  /** The canvas owner has connected an OpenAI key at all. */
  ownerHasOpenAiKey: boolean;
}

interface StoredKey {
  apiKey: string;
  shareWithCollaborators: boolean;
}

/** The user's own decrypted OpenAI key, or null (none, another provider, or undecryptable). */
export async function ownOpenAiKey(userId: string | undefined | null): Promise<StoredKey | null> {
  if (!userId) return null;
  const config = await prisma.userAiConfig.findUnique({ where: { userId } });
  if (!config || config.provider !== 'openai') return null;
  try {
    return {
      apiKey: decryptApiKey(config.apiKeyEncrypted, config.apiKeyIv, config.apiKeyTag),
      shareWithCollaborators: Boolean(config.shareWithCollaborators),
    };
  } catch {
    return null;
  }
}

/** The account that owns a canvas: its owner, or the requester for an unlinked legacy canvas. */
export async function canvasOwnerId(canvasId: string | undefined, requesterId: string): Promise<string> {
  if (!canvasId) return requesterId;
  const canvas = await prisma.codingCanvas.findUnique({
    where: { id: canvasId },
    select: { userId: true, dashboardAccess: { select: { userId: true } } },
  });
  return canvas?.userId ?? canvas?.dashboardAccess?.userId ?? requesterId;
}

export async function resolveTranscriptionKey(
  canvasId: string | undefined,
  requesterId: string,
): Promise<TranscriptionKeyResolution> {
  const ownerId = await canvasOwnerId(canvasId, requesterId);
  const isCanvasOwner = ownerId === requesterId;
  const [mine, owners] = await Promise.all([
    ownOpenAiKey(requesterId),
    isCanvasOwner ? Promise.resolve(null) : ownOpenAiKey(ownerId),
  ]);
  const ownerKey = isCanvasOwner ? mine : owners;
  const ownerSharesKey = Boolean(ownerKey?.shareWithCollaborators);
  const base = {
    canvasOwnerId: ownerId,
    isCanvasOwner,
    ownerSharesKey,
    ownerHasOpenAiKey: Boolean(ownerKey),
  };
  if (mine) return { ...base, apiKey: mine.apiKey, keyOwnerId: requesterId, source: 'own' };
  if (!isCanvasOwner && owners && owners.shareWithCollaborators) {
    return { ...base, apiKey: owners.apiKey, keyOwnerId: ownerId, source: 'canvas-owner' };
  }
  return { ...base, apiKey: null, keyOwnerId: null, source: null };
}

function monthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface TranscriptionUsage {
  minutes: number;
  estimatedCostUsd: number;
}

function usageFromSeconds(seconds: number): TranscriptionUsage {
  const minutes = Math.round((seconds / 60) * 10) / 10;
  return { minutes, estimatedCostUsd: Math.round((seconds / 60) * WHISPER_USD_PER_MINUTE * 100) / 100 };
}

/** Plain usage reporting: transcription billed to this account's own key this calendar month. */
export async function transcriptionUsageOnKey(keyOwnerId: string): Promise<TranscriptionUsage> {
  const agg = await prisma.aiUsage.aggregate({
    _sum: { durationSeconds: true },
    where: { keyOwnerId, feature: 'transcribe', createdAt: { gte: monthStart() } },
  });
  return usageFromSeconds(agg._sum.durationSeconds ?? 0);
}

export interface CollaboratorKeyUsage extends TranscriptionUsage {
  userId: string;
  name: string | null;
  email: string | null;
}

/** Minutes other people transcribed on this owner's shared key this month, per person. */
export async function collaboratorUsageOnKey(keyOwnerId: string): Promise<CollaboratorKeyUsage[]> {
  const rows = await prisma.aiUsage.groupBy({
    by: ['userId'],
    _sum: { durationSeconds: true },
    where: {
      keyOwnerId,
      feature: 'transcribe',
      createdAt: { gte: monthStart() },
      NOT: { userId: keyOwnerId },
    },
  });
  const ids = rows.map((r) => r.userId).filter((id): id is string => Boolean(id));
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows
    .filter((r) => r.userId)
    .map((r) => ({
      userId: r.userId as string,
      name: byId.get(r.userId as string)?.name ?? null,
      email: byId.get(r.userId as string)?.email ?? null,
      ...usageFromSeconds(r._sum.durationSeconds ?? 0),
    }));
}
