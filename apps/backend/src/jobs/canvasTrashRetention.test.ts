import { beforeEach, describe, expect, it, vi } from 'vitest';

const { codingCanvas, deleteStoredUploads } = vi.hoisted(() => ({
  codingCanvas: { findMany: vi.fn(), delete: vi.fn() },
  deleteStoredUploads: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ prisma: { codingCanvas } }));
vi.mock('../utils/fileCleanup.js', () => ({ deleteStoredUploads }));
vi.mock('../lib/logger.js', () => ({ logError: vi.fn(), logInfo: vi.fn() }));

import { CANVAS_TRASH_RETENTION_DAYS, pruneCanvasTrash } from './canvasTrashRetention.js';

describe('canvas trash retention', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes expired storage before cascading the canvas row', async () => {
    codingCanvas.findMany.mockResolvedValueOnce([{ id: 'expired-1' }]);
    deleteStoredUploads.mockResolvedValue(undefined);
    codingCanvas.delete.mockResolvedValue({ id: 'expired-1' });

    const result = await pruneCanvasTrash(new Date('2026-08-26T12:00:00.000Z'));

    expect(CANVAS_TRASH_RETENTION_DAYS).toBe(30);
    expect(result).toEqual({ deleted: 1, failed: 0, reachedLimit: false });
    expect(deleteStoredUploads).toHaveBeenCalledWith({ canvasId: 'expired-1' });
    expect(deleteStoredUploads.mock.invocationCallOrder[0]).toBeLessThan(
      codingCanvas.delete.mock.invocationCallOrder[0],
    );
    expect(codingCanvas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: { lt: new Date('2026-07-27T12:00:00.000Z') } }),
      }),
    );
  });

  it('keeps the database row when object-storage deletion fails', async () => {
    codingCanvas.findMany.mockResolvedValueOnce([{ id: 'retry-later' }]);
    deleteStoredUploads.mockRejectedValue(new Error('storage unavailable'));

    const result = await pruneCanvasTrash();

    expect(result.failed).toBe(1);
    expect(codingCanvas.delete).not.toHaveBeenCalled();
  });
});
