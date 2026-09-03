import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * GET /admin/usage against a mocked Prisma: every aggregate must carry the
 * real-user exclusion, and a cohort member's coding on somebody else's canvas
 * must activate the coder, not the canvas owner. Bug hunt 2026-09-02, the
 * "/usage sub-aggregates skip realUsersWhere" and "funnel attributes
 * collaborator codings to the owner" suspicions - both confirmed here (the
 * assertions failed before the fix) and on a real Postgres in
 * __tests__/integration/admin-usage-real-users.test.ts.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findMany: vi.fn() },
    codingCanvas: { findMany: vi.fn(), count: vi.fn() },
    canvasTranscript: { findMany: vi.fn(), count: vi.fn() },
    canvasTextCoding: { findMany: vi.fn(), count: vi.fn() },
    canvasComputedNode: { count: vi.fn(), groupBy: vi.fn() },
    aiUsage: { groupBy: vi.fn(), aggregate: vi.fn() },
    auditLog: { groupBy: vi.fn() },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/lifecycleEmail.js', () => ({
  createEmailCampaign: vi.fn(),
  getEmailStats: vi.fn(),
  listEmailCampaigns: vi.fn(),
  sendCampaign: vi.fn(),
}));

import { adminRoutes, realUsersWhere } from './adminRoutes.js';

const REAL_USER = 'real-user-1';
const signedUp = new Date('2026-09-01T00:00:00.000Z');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRoutes);
  return app;
}

type WhereArg = { where?: Record<string, unknown> };
const whereOf = (fn: { mock: { calls: unknown[][] } }, call = 0) => (fn.mock.calls[call]?.[0] as WhereArg).where;

describe('GET /admin/usage - real-user exclusion on every aggregate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_API_KEY = 'usage-admin-key';

    mockPrisma.user.findMany.mockImplementation(async (args: { where?: Record<string, unknown> }) => {
      const where = args.where ?? {};
      // Top-user email lookup.
      if (where.id) return [{ id: REAL_USER, email: 'real@ucc.ie', name: 'Real' }];
      // Signup cohort for the window.
      if (where.createdAt) return [{ id: REAL_USER, createdAt: signedUp }];
      // Real-user id list.
      return [{ id: REAL_USER }];
    });
    mockPrisma.codingCanvas.findMany.mockResolvedValue([]);
    mockPrisma.codingCanvas.count.mockResolvedValue(0);
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([]);
    mockPrisma.canvasTranscript.count.mockResolvedValue(0);
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([]);
    mockPrisma.canvasTextCoding.count.mockResolvedValue(0);
    mockPrisma.canvasComputedNode.count.mockResolvedValue(0);
    mockPrisma.canvasComputedNode.groupBy.mockResolvedValue([]);
    mockPrisma.aiUsage.groupBy.mockResolvedValue([]);
    mockPrisma.aiUsage.aggregate.mockResolvedValue({ _sum: { costCents: 0, inputTokens: 0, outputTokens: 0 } });
    mockPrisma.auditLog.groupBy.mockResolvedValue([]);
  });

  const getUsage = () => request(makeApp()).get('/admin/usage?period=30d').set('x-admin-key', 'usage-admin-key');

  it('filters computed-node, AI-usage, action and top-user breakdowns the same way as the headline counts', async () => {
    const res = await getUsage();
    expect(res.status).toBe(200);

    // Relation-backed model: same relation filter the counts use.
    expect(whereOf(mockPrisma.canvasComputedNode.groupBy)).toMatchObject({
      canvas: { user: { is: realUsersWhere } },
    });

    // AiUsage and AuditLog have no relation to User: the exclusion is the
    // real-user id list.
    const byRealUser = { in: [REAL_USER] };
    expect(whereOf(mockPrisma.aiUsage.groupBy)).toMatchObject({ userId: byRealUser });
    expect(whereOf(mockPrisma.aiUsage.aggregate)).toMatchObject({ userId: byRealUser });
    expect(mockPrisma.auditLog.groupBy).toHaveBeenCalledTimes(2);
    expect(whereOf(mockPrisma.auditLog.groupBy, 0)).toMatchObject({ actorId: byRealUser });
    expect(whereOf(mockPrisma.auditLog.groupBy, 1)).toMatchObject({ actorId: byRealUser });

    // The id list itself is built from realUsersWhere.
    const idListCall = mockPrisma.user.findMany.mock.calls.find(
      (call) => (call[0] as WhereArg).where === realUsersWhere,
    );
    expect(idListCall).toBeDefined();
  });

  it('activates a cohort member who only codes as a collaborator on someone else’s canvas', async () => {
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([
      // The canvas belongs to a non-cohort owner; the coding is the cohort user's.
      {
        createdAt: new Date('2026-09-01T05:00:00.000Z'),
        coderUserId: REAL_USER,
        canvas: { userId: 'owner-outside-cohort' },
      },
    ]);

    const res = await getUsage();
    expect(res.status).toBe(200);

    // The query reaches codings by coder as well as by canvas owner.
    expect(whereOf(mockPrisma.canvasTextCoding.findMany)).toMatchObject({
      OR: [
        { coder: { is: expect.objectContaining({ createdAt: expect.anything() }) } },
        { coderUserId: null, canvas: { user: { is: expect.objectContaining({ createdAt: expect.anything() }) } } },
      ],
    });

    expect(res.body.data.activation).toMatchObject({ cohortSize: 1, activatedUsers: 1, activationRate: 100 });
    const coding = res.body.data.activation.stages.find((s: { key: string }) => s.key === 'coding');
    expect(coding).toMatchObject({ users: 1, medianHoursToReach: 5 });
  });

  it('still credits an unattributed coding to the canvas owner', async () => {
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([
      { createdAt: new Date('2026-09-01T02:00:00.000Z'), coderUserId: null, canvas: { userId: REAL_USER } },
    ]);

    const res = await getUsage();
    expect(res.body.data.activation.activatedUsers).toBe(1);
  });
});
