import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockLogInfo, mockLogError } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
  mockLogInfo: vi.fn(),
  mockLogError: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/logger.js', () => ({ logError: mockLogError, logInfo: mockLogInfo }));

import {
  AUDIT_RETENTION_DAYS,
  AUDIT_PRUNE_BATCH_SIZE,
  AUDIT_PRUNE_MAX_PER_RUN,
  pruneAuditLogs,
} from './auditRetention.js';

/**
 * /trust, /privacy and the DPA all state a 90-day rolling window for audit and
 * access logs. Enforcing it must not itself be an operational hazard: on a
 * table that has never been pruned, a single unbounded deleteMany is one large
 * transaction against a hot table. These tests pin the bounded behaviour —
 * fixed-size batches, an explicit per-run ceiling, and observable counts.
 */

/** Simulate a table holding `total` expired rows, deleted in batches. */
function seedExpiredRows(total: number) {
  let remaining = total;
  mockPrisma.auditLog.findMany.mockImplementation(async ({ take }: { take: number }) => {
    const n = Math.min(take, remaining);
    return Array.from({ length: n }, (_, i) => ({ id: `row-${remaining - i}` }));
  });
  mockPrisma.auditLog.deleteMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => {
    const n = where.id.in.length;
    remaining -= n;
    return { count: n };
  });
}

describe('audit log retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('matches the 90-day window published on /trust, /privacy and the DPA', () => {
    expect(AUDIT_RETENTION_DAYS).toBe(90);
  });

  it('selects only entries older than the retention window', async () => {
    await pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'));

    const where = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
    expect(where.timestamp.lt).toEqual(new Date('2026-03-03T00:00:00.000Z'));
  });

  it('never asks for more than one batch at a time', async () => {
    seedExpiredRows(AUDIT_PRUNE_BATCH_SIZE * 3);
    await pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'));

    for (const call of mockPrisma.auditLog.findMany.mock.calls) {
      expect(call[0].take).toBe(AUDIT_PRUNE_BATCH_SIZE);
    }
  });

  it('deletes by explicit id list, never by an open-ended predicate', async () => {
    seedExpiredRows(AUDIT_PRUNE_BATCH_SIZE);
    await pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'));

    const where = mockPrisma.auditLog.deleteMany.mock.calls[0][0].where;
    // A bare { timestamp: { lt } } here would be the unbounded single-statement
    // delete this job exists to avoid.
    expect(Array.isArray(where.id.in)).toBe(true);
    expect(where.id.in.length).toBeLessThanOrEqual(AUDIT_PRUNE_BATCH_SIZE);
    expect(where.timestamp).toBeUndefined();
  });

  it('progresses across several batches rather than one large deletion', async () => {
    const total = AUDIT_PRUNE_BATCH_SIZE * 2 + 10;
    seedExpiredRows(total);

    const result = await pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'));

    expect(result.deleted).toBe(total);
    expect(result.batches).toBe(3);
    expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledTimes(3);
  });

  it('stops at the per-run ceiling and says so, leaving the rest for next run', async () => {
    seedExpiredRows(AUDIT_PRUNE_MAX_PER_RUN + AUDIT_PRUNE_BATCH_SIZE * 2);

    const result = await pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'));

    expect(result.deleted).toBe(AUDIT_PRUNE_MAX_PER_RUN);
    expect(result.reachedLimit).toBe(true);
  });

  it('reports not having hit the ceiling on an ordinary run', async () => {
    seedExpiredRows(5);
    const result = await pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'));

    expect(result.deleted).toBe(5);
    expect(result.reachedLimit).toBe(false);
  });

  it('does no work and logs nothing when there is nothing expired', async () => {
    const result = await pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'));

    expect(result).toEqual({ deleted: 0, batches: 0, reachedLimit: false, failed: false });
    expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled();
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  it('logs a summary when it actually removed something', async () => {
    seedExpiredRows(3);
    await pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'));

    expect(mockLogInfo).toHaveBeenCalledTimes(1);
    const [, fields] = mockLogInfo.mock.calls[0];
    expect(fields).toMatchObject({ deleted: 3, batches: 1 });
  });

  it('surfaces a failure without throwing, keeping progress already made', async () => {
    let call = 0;
    mockPrisma.auditLog.findMany.mockImplementation(async ({ take }: { take: number }) =>
      Array.from({ length: take }, (_, i) => ({ id: `row-${i}` })),
    );
    mockPrisma.auditLog.deleteMany.mockImplementation(async () => {
      call++;
      if (call === 2) throw new Error('deadlock detected');
      return { count: AUDIT_PRUNE_BATCH_SIZE };
    });

    const result = await pruneAuditLogs(new Date('2026-06-01T00:00:00.000Z'));

    expect(result.failed).toBe(true);
    expect(result.deleted).toBe(AUDIT_PRUNE_BATCH_SIZE); // the first batch survived
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });
});
