import { describe, expect, it, vi } from 'vitest';
import { deleteCanvasNodeArtifacts } from './canvasNodeCleanup.js';

function transactionMock() {
  return {
    canvasNodePosition: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    canvasRelation: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    canvasTextCoding: { findMany: vi.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]) },
    textEmbedding: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
  };
}

describe('deleteCanvasNodeArtifacts', () => {
  it('removes both prefixed layout rows and relation endpoints for a code', async () => {
    const tx = transactionMock();
    await deleteCanvasNodeArtifacts(tx as never, 'canvas-1', 'question', 'q1');
    expect(tx.canvasNodePosition.deleteMany).toHaveBeenCalledWith({
      where: { canvasId: 'canvas-1', nodeId: { in: ['question-q1', 'q1'] } },
    });
    expect(tx.canvasRelation.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ canvasId: 'canvas-1' }) }),
    );
  });

  it('does not query relations for entity types relations cannot target', async () => {
    const tx = transactionMock();
    await deleteCanvasNodeArtifacts(tx as never, 'canvas-1', 'memo', 'm1');
    expect(tx.canvasRelation.deleteMany).not.toHaveBeenCalled();
  });

  it('drops chat embeddings for a deleted transcript and its codings', async () => {
    const tx = transactionMock();
    await deleteCanvasNodeArtifacts(tx as never, 'canvas-1', 'transcript', 't1');
    expect(tx.canvasTextCoding.findMany).toHaveBeenCalledWith({
      where: { canvasId: 'canvas-1', transcriptId: 't1' },
      select: { id: true },
    });
    expect(tx.textEmbedding.deleteMany).toHaveBeenCalledWith({
      where: {
        canvasId: 'canvas-1',
        OR: [
          { sourceType: 'coding', sourceId: { in: ['c1', 'c2', 't1'] } },
          { sourceType: 'transcript_chunk', sourceId: 't1' },
        ],
      },
    });
  });

  it('drops chat embeddings for a deleted memo', async () => {
    const tx = transactionMock();
    await deleteCanvasNodeArtifacts(tx as never, 'canvas-1', 'memo', 'm1');
    expect(tx.textEmbedding.deleteMany).toHaveBeenCalledWith({
      where: { canvasId: 'canvas-1', sourceType: 'memo', sourceId: 'm1' },
    });
  });

  it('leaves embeddings alone for a code whose codings were moved away (merge)', async () => {
    const tx = transactionMock();
    tx.canvasTextCoding.findMany.mockResolvedValue([]);
    await deleteCanvasNodeArtifacts(tx as never, 'canvas-1', 'question', 'q1');
    expect(tx.textEmbedding.deleteMany).not.toHaveBeenCalled();
  });
});
