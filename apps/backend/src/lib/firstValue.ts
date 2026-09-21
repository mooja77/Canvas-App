import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export interface FirstValueEvidence {
  kind: 'first_real_coding';
  canvasId: string;
  codingId: string;
  transcriptId: string;
  recordedAt: string;
}

type FirstValueWriter = Pick<Prisma.TransactionClient, 'user'>;

function evidence(input: {
  canvasId: string;
  codingId: string;
  transcriptId: string;
  recordedAt: Date;
}): FirstValueEvidence {
  return {
    kind: 'first_real_coding',
    canvasId: input.canvasId,
    codingId: input.codingId,
    transcriptId: input.transcriptId,
    recordedAt: input.recordedAt.toISOString(),
  };
}

/**
 * Persist the first genuine research outcome once. Template-seeded content is
 * deliberately ineligible, and the evidence contains no transcript text.
 */
export async function recordFirstValue(
  db: FirstValueWriter,
  input: {
    userId: string | null;
    canvasId: string;
    codingId: string;
    transcriptId: string;
    transcriptSourceType: string | null;
    codingSource: string;
    recordedAt: Date;
  },
): Promise<boolean> {
  if (!input.userId || input.transcriptSourceType === 'sample' || input.codingSource === 'sample') return false;

  const marker = evidence(input);
  const updated = await db.user.updateMany({
    where: { id: input.userId, firstValueAt: null },
    data: {
      firstValueAt: input.recordedAt,
      firstValueCanvasId: input.canvasId,
      firstValueEvidence: JSON.stringify(marker),
      onboardingCompletedAt: input.recordedAt,
    },
  });
  return updated.count === 1;
}

/**
 * Read the durable marker, with a repair path for genuine pre-marker codings.
 * The migration performs the same backfill; this makes lifecycle selection
 * fail safe if a deployment is interrupted between schema and application.
 */
export async function ensureDurableFirstValue(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstValueAt: true } });
  if (user?.firstValueAt) return true;

  const coding = await prisma.canvasTextCoding.findFirst({
    where: {
      source: { not: 'sample' },
      transcript: {
        is: { OR: [{ sourceType: null }, { sourceType: { not: 'sample' } }] },
      },
      OR: [{ coderUserId: userId }, { coderUserId: null, canvas: { userId } }],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      canvasId: true,
      transcriptId: true,
      source: true,
      createdAt: true,
      transcript: { select: { sourceType: true } },
    },
  });
  if (!coding) return false;

  await recordFirstValue(prisma, {
    userId,
    canvasId: coding.canvasId,
    codingId: coding.id,
    transcriptId: coding.transcriptId,
    transcriptSourceType: coding.transcript.sourceType,
    codingSource: coding.source,
    recordedAt: coding.createdAt,
  });
  return true;
}
