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
}
