import type { Prisma } from '@prisma/client';
import { safeJsonParse } from '../utils/routeHelpers.js';
import { deleteCanvasNodeArtifacts } from '../utils/canvasNodeCleanup.js';

/**
 * Starter templates seed a small coded study so a new researcher sees a coded
 * canvas first. Every seeded transcript carries sourceType 'sample' and every
 * seeded coding source 'sample'. Seeded memos have no marker column, so a memo
 * counts as sample material only while its title AND content are still exactly
 * the template's text: a memo the researcher has edited is theirs.
 *
 * The starter codes (CanvasQuestion rows) are the codebook, not sample data,
 * and are kept.
 */
export const SAMPLE_SOURCE = 'sample';
const TEMPLATE_DESCRIPTION_PREFIX = 'Created from template: ';

type SampleTx = Prisma.TransactionClient;

export interface SampleDataSummary {
  transcripts: number;
  codings: number;
  memos: number;
}

async function sampleMemoIds(tx: SampleTx, canvasId: string): Promise<string[]> {
  const canvas = await tx.codingCanvas.findUnique({ where: { id: canvasId }, select: { description: true } });
  const description = canvas?.description ?? '';
  if (!description.startsWith(TEMPLATE_DESCRIPTION_PREFIX)) return [];
  const templateName = description.slice(TEMPLATE_DESCRIPTION_PREFIX.length);
  const template = await tx.canvasTemplate.findFirst({
    where: { name: templateName },
    select: { sampleMemos: true },
  });
  const seeded = template?.sampleMemos
    ? (safeJsonParse(template.sampleMemos, []) as { title: string; content: string }[])
    : [];
  if (seeded.length === 0) return [];
  const memos = await tx.canvasMemo.findMany({
    where: { canvasId, OR: seeded.map((m) => ({ title: m.title.slice(0, 200), content: m.content })) },
    select: { id: true },
  });
  return memos.map((m) => m.id);
}

export async function summarizeSampleData(tx: SampleTx, canvasId: string): Promise<SampleDataSummary> {
  const [transcripts, codings, memoIds] = await Promise.all([
    tx.canvasTranscript.count({ where: { canvasId, sourceType: SAMPLE_SOURCE } }),
    tx.canvasTextCoding.count({ where: { canvasId, source: SAMPLE_SOURCE } }),
    sampleMemoIds(tx, canvasId),
  ]);
  return { transcripts, codings, memos: memoIds.length };
}

/**
 * Delete the seeded study from one canvas. Codings the researcher made on a
 * sample transcript go with it (they annotate sample text); nothing on the
 * researcher's own transcripts is touched.
 */
export async function removeSampleData(tx: SampleTx, canvasId: string): Promise<SampleDataSummary> {
  const [transcripts, memoIds] = await Promise.all([
    tx.canvasTranscript.findMany({ where: { canvasId, sourceType: SAMPLE_SOURCE }, select: { id: true } }),
    sampleMemoIds(tx, canvasId),
  ]);
  const transcriptIds = transcripts.map((t) => t.id);

  // Sample codings can only sit on sample transcripts today, but delete them by
  // their own marker too so a future seeding change cannot leave orphans.
  const codingsOnSample = transcriptIds.length
    ? await tx.canvasTextCoding.deleteMany({ where: { canvasId, transcriptId: { in: transcriptIds } } })
    : { count: 0 };
  const markedCodings = await tx.canvasTextCoding.deleteMany({ where: { canvasId, source: SAMPLE_SOURCE } });

  for (const id of transcriptIds) await deleteCanvasNodeArtifacts(tx, canvasId, 'transcript', id);
  for (const id of memoIds) await deleteCanvasNodeArtifacts(tx, canvasId, 'memo', id);
  if (transcriptIds.length) await tx.canvasTranscript.deleteMany({ where: { canvasId, id: { in: transcriptIds } } });
  if (memoIds.length) await tx.canvasMemo.deleteMany({ where: { canvasId, id: { in: memoIds } } });

  return {
    transcripts: transcriptIds.length,
    codings: codingsOnSample.count + markedCodings.count,
    memos: memoIds.length,
  };
}
