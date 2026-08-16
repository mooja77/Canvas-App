import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockStorage } = vi.hoisted(() => ({
  mockPrisma: {
    fileUpload: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  mockStorage: {
    delete: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/storage.js', () => ({ storage: mockStorage }));
vi.mock('../lib/storage-s3.js', () => ({}));
vi.mock('../lib/storage-local.js', () => ({}));

import { deleteStoredUploads } from './fileCleanup.js';

describe('deleteStoredUploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.fileUpload.findMany.mockResolvedValue([
      { id: 'upload-1', storageKey: 'canvas/one.wav' },
      { id: 'upload-2', storageKey: 'canvas/two.mp4' },
    ]);
    mockPrisma.fileUpload.deleteMany.mockResolvedValue({ count: 2 });
    mockStorage.delete.mockResolvedValue(undefined);
  });

  it('deletes physical objects before their database records', async () => {
    await expect(deleteStoredUploads({ canvasId: 'canvas-1' })).resolves.toBe(2);

    expect(mockStorage.delete).toHaveBeenCalledTimes(2);
    expect(mockPrisma.fileUpload.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['upload-1', 'upload-2'] } },
    });
    expect(mockStorage.delete.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrisma.fileUpload.deleteMany.mock.invocationCallOrder[0],
    );
  });

  it('fails closed and preserves records when physical deletion fails', async () => {
    mockStorage.delete.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(deleteStoredUploads({ userId: 'user-1' })).rejects.toThrow('storage unavailable');
    expect(mockPrisma.fileUpload.deleteMany).not.toHaveBeenCalled();
  });
});
