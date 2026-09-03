import { beforeEach, describe, expect, it, vi } from 'vitest';

const { codingCanvas, tx, $transaction, deleteStoredUploads } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    fileUpload: { findMany: vi.fn() },
    codingCanvas: { delete: vi.fn() },
  };
  return {
    codingCanvas: { findMany: vi.fn() },
    tx,
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    deleteStoredUploads: vi.fn(),
  };
});

vi.mock('../lib/prisma.js', () => ({ prisma: { codingCanvas, $transaction } }));
vi.mock('../utils/fileCleanup.js', () => ({ deleteStoredUploads }));
vi.mock('../lib/logger.js', () => ({ logError: vi.fn(), logInfo: vi.fn() }));

import { CANVAS_TRASH_RETENTION_DAYS, pruneCanvasTrash } from './canvasTrashRetention.js';

describe('canvas trash retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.fileUpload.findMany.mockResolvedValue([]);
    tx.codingCanvas.delete.mockResolvedValue({});
    deleteStoredUploads.mockResolvedValue(0);
  });

  it('re-checks expiry under a row lock, deletes the row, and only then removes storage', async () => {
    codingCanvas.findMany.mockResolvedValueOnce([{ id: 'expired-1' }]);
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'expired-1' }]);
    tx.fileUpload.findMany.mockResolvedValueOnce([{ id: 'up-1' }, { id: 'up-2' }]);

    const result = await pruneCanvasTrash(new Date('2026-08-26T12:00:00.000Z'));

    expect(CANVAS_TRASH_RETENTION_DAYS).toBe(30);
    expect(result).toEqual({ deleted: 1, skipped: 0, failed: 0, orphanedUploads: 0, reachedLimit: false });
    expect(codingCanvas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: { lt: new Date('2026-07-27T12:00:00.000Z') } }),
      }),
    );
    // The lock query carries the cutoff so the check is `deletedAt < cutoff`, not just "exists".
    const lockCall = tx.$queryRaw.mock.calls[0];
    expect(lockCall[0].join('?')).toMatch(/FOR UPDATE/);
    expect(lockCall[0].join('?')).toMatch(/"deletedAt" < \?/);
    expect(lockCall.slice(1)).toEqual(['expired-1', new Date('2026-07-27T12:00:00.000Z')]);
    // Upload ids are captured inside the transaction (FileUpload.canvasId is SetNull on delete).
    expect(tx.fileUpload.findMany).toHaveBeenCalledWith({ where: { canvasId: 'expired-1' }, select: { id: true } });
    expect(tx.codingCanvas.delete).toHaveBeenCalledWith({ where: { id: 'expired-1' } });
    expect(deleteStoredUploads).toHaveBeenCalledWith({ id: { in: ['up-1', 'up-2'] } });
    // Storage goes AFTER the database delete: an orphaned object is recoverable, a purged restored canvas is not.
    expect(tx.codingCanvas.delete.mock.invocationCallOrder[0]).toBeLessThan(
      deleteStoredUploads.mock.invocationCallOrder[0],
    );
  });

  it('skips a canvas that was restored between the batch query and the lock (M5)', async () => {
    codingCanvas.findMany.mockResolvedValueOnce([{ id: 'restored-1' }, { id: 'expired-2' }]);
    // Restored canvas: deletedAt is null again, so the conditional lock matches nothing.
    tx.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'expired-2' }]);

    const result = await pruneCanvasTrash();

    expect(result).toEqual({ deleted: 1, skipped: 1, failed: 0, orphanedUploads: 0, reachedLimit: false });
    expect(tx.codingCanvas.delete).toHaveBeenCalledTimes(1);
    expect(tx.codingCanvas.delete).toHaveBeenCalledWith({ where: { id: 'expired-2' } });
    expect(tx.codingCanvas.delete).not.toHaveBeenCalledWith({ where: { id: 'restored-1' } });
    expect(deleteStoredUploads).not.toHaveBeenCalledWith(expect.objectContaining({ canvasId: 'restored-1' }));
  });

  it('reports storage failures after commit as orphaned uploads, not as a failed canvas', async () => {
    codingCanvas.findMany.mockResolvedValueOnce([{ id: 'expired-1' }]);
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'expired-1' }]);
    tx.fileUpload.findMany.mockResolvedValueOnce([{ id: 'up-1' }, { id: 'up-2' }, { id: 'up-3' }]);
    deleteStoredUploads.mockRejectedValueOnce(new Error('storage unavailable'));

    const result = await pruneCanvasTrash();

    expect(result).toEqual({ deleted: 1, skipped: 0, failed: 0, orphanedUploads: 3, reachedLimit: false });
  });

  it('keeps the canvas in Trash and never touches storage when the database delete fails', async () => {
    codingCanvas.findMany.mockResolvedValueOnce([{ id: 'retry-later' }]);
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'retry-later' }]);
    tx.fileUpload.findMany.mockResolvedValueOnce([{ id: 'up-1' }]);
    tx.codingCanvas.delete.mockRejectedValueOnce(new Error('db unavailable'));

    const result = await pruneCanvasTrash();

    expect(result).toEqual({ deleted: 0, skipped: 0, failed: 1, orphanedUploads: 0, reachedLimit: false });
    expect(deleteStoredUploads).not.toHaveBeenCalled();
  });

  it('does not ask storage to delete anything for a canvas without uploads', async () => {
    codingCanvas.findMany.mockResolvedValueOnce([{ id: 'expired-1' }]);
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'expired-1' }]);

    await pruneCanvasTrash();

    expect(deleteStoredUploads).not.toHaveBeenCalled();
  });
});
