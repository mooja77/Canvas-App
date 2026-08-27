import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockLogError, mockLogInfo } = vi.hoisted(() => ({
  mockPrisma: { pilotFeedback: { deleteMany: vi.fn() } },
  mockLogError: vi.fn(),
  mockLogInfo: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/logger.js', () => ({ logError: mockLogError, logInfo: mockLogInfo }));

import { PILOT_FEEDBACK_RETENTION_DAYS, prunePilotFeedback } from './pilotFeedbackRetention.js';

describe('pilot feedback retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.pilotFeedback.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('matches the 12-month window published on the privacy page', () => {
    expect(PILOT_FEEDBACK_RETENTION_DAYS).toBe(365);
  });

  it('deletes only feedback older than 365 days', async () => {
    mockPrisma.pilotFeedback.deleteMany.mockResolvedValue({ count: 2 });
    const result = await prunePilotFeedback(new Date('2026-08-27T00:00:00.000Z'));

    expect(mockPrisma.pilotFeedback.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2025-08-27T00:00:00.000Z') } },
    });
    expect(result).toEqual({ deleted: 2, failed: false });
    expect(mockLogInfo).toHaveBeenCalledOnce();
  });

  it('reports a database failure without taking down the process', async () => {
    mockPrisma.pilotFeedback.deleteMany.mockRejectedValue(new Error('database unavailable'));

    await expect(prunePilotFeedback()).resolves.toEqual({ deleted: 0, failed: true });
    expect(mockLogError).toHaveBeenCalledOnce();
  });
});
