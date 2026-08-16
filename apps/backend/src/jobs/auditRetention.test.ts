import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: { deleteMany: vi.fn() },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/logger.js', () => ({ logError: vi.fn(), logInfo: vi.fn() }));

import { AUDIT_RETENTION_DAYS, pruneAuditLogs } from './auditRetention.js';

/**
 * /trust, /privacy and the DPA all state that audit and access logs are kept on
 * a 90-day rolling basis. Nothing enforced that: rows accumulated forever,
 * including the IP address on every authenticated request. These tests are the
 * enforcement of a published promise, so the retention constant is asserted
 * directly — changing it should require changing the public wording too.
 */
describe('audit log retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('matches the 90-day window published on /trust, /privacy and the DPA', () => {
    expect(AUDIT_RETENTION_DAYS).toBe(90);
  });

  it('deletes entries older than the retention window', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await pruneAuditLogs(now);

    const where = mockPrisma.auditLog.deleteMany.mock.calls[0][0].where;
    expect(where.timestamp.lt).toEqual(new Date('2026-03-03T00:00:00.000Z'));
  });

  it('keeps an entry that is one day inside the window', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await pruneAuditLogs(now);

    const cutoff: Date = mockPrisma.auditLog.deleteMany.mock.calls[0][0].where.timestamp.lt;
    const eightyNineDaysOld = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);

    expect(eightyNineDaysOld.getTime()).toBeGreaterThan(cutoff.getTime());
  });

  it('removes an entry that is one day outside the window', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await pruneAuditLogs(now);

    const cutoff: Date = mockPrisma.auditLog.deleteMany.mock.calls[0][0].where.timestamp.lt;
    const ninetyOneDaysOld = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);

    expect(ninetyOneDaysOld.getTime()).toBeLessThan(cutoff.getTime());
  });

  it('reports how many rows it removed', async () => {
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 1234 });
    expect(await pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'))).toBe(1234);
  });

  it('does not throw when the delete fails, so one bad run cannot crash the server', async () => {
    mockPrisma.auditLog.deleteMany.mockRejectedValue(new Error('db down'));
    await expect(pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'))).resolves.toBe(0);
  });
});
