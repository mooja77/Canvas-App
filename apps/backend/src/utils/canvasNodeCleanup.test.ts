import { describe, expect, it, vi } from 'vitest';
import { deleteCanvasNodeArtifacts } from './canvasNodeCleanup.js';

function transactionMock() {
  return {
    canvasNodePosition: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    canvasRelation: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
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
});
