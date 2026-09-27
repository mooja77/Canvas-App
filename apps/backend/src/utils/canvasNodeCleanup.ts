import type { Prisma } from '@prisma/client';

export type CanvasEntityType = 'transcript' | 'question' | 'memo' | 'case' | 'computed';

/**
 * Remove generic layout/relationship rows that Prisma cannot cascade because
 * their targets are represented by nodeType/nodeId strings rather than FKs.
 * Call this inside the same transaction that deletes the entity.
 */
export async function deleteCanvasNodeArtifacts(
  tx: Prisma.TransactionClient,
  canvasId: string,
  entityType: CanvasEntityType,
  entityId: string,
): Promise<void> {
  await tx.canvasNodePosition.deleteMany({
    where: {
      canvasId,
      nodeId: { in: [`${entityType}-${entityId}`, entityId] },
    },
  });

  if (entityType === 'question' || entityType === 'case') {
    await tx.canvasRelation.deleteMany({
      where: {
        canvasId,
        OR: [
          { fromType: entityType, fromId: entityId },
          { toType: entityType, toId: entityId },
        ],
      },
    });
  }

  await deleteStaleEmbeddings(tx, canvasId, entityType, entityId);
}

/**
 * Chat (RAG) answers from TextEmbedding.chunkText, whose sourceId has no
 * foreign key. Without this, a deleted transcript, memo or coding kept being
 * quoted and cited by the research assistant until the user re-indexed.
 * Codings that still exist under a different code (a merge moves them before
 * the source code is deleted) are not touched.
 */
export async function deleteStaleEmbeddings(
  tx: Prisma.TransactionClient,
  canvasId: string,
  entityType: CanvasEntityType,
  entityId: string,
): Promise<void> {
  if (entityType === 'transcript' || entityType === 'question') {
    const codings = await tx.canvasTextCoding.findMany({
      where: entityType === 'transcript' ? { canvasId, transcriptId: entityId } : { canvasId, questionId: entityId },
      select: { id: true },
    });
    const sourceIds = codings.map((c) => c.id);
    if (entityType === 'transcript') sourceIds.push(entityId);
    if (sourceIds.length > 0) {
      await tx.textEmbedding.deleteMany({
        where: {
          canvasId,
          OR: [
            { sourceType: 'coding', sourceId: { in: sourceIds } },
            ...(entityType === 'transcript' ? [{ sourceType: 'transcript_chunk', sourceId: entityId }] : []),
          ],
        },
      });
    }
  } else if (entityType === 'memo') {
    await tx.textEmbedding.deleteMany({ where: { canvasId, sourceType: 'memo', sourceId: entityId } });
  }
}
