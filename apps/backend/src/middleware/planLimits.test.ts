import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * These caps had no direct tests at all - every integration suite mocks the
 * whole module out with `() => next()`. That is how the counts and the caps
 * drifted apart unnoticed: /auth/me reported share usage excluding trashed
 * canvases while checkShareLimit counted them, so the account page could read
 * "3/5" and share creation would still be refused.
 *
 * The assertions are deliberately on the Prisma `where` clause, because the
 * contract that broke is precisely "what does this count".
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    codingCanvas: { count: vi.fn() },
    canvasShare: { count: vi.fn() },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../utils/transcriptionMetering.js', () => ({
  resolveUserOpenAiKey: vi.fn(),
  transcriptionMinutesUsedThisMonth: vi.fn(),
}));
vi.mock('../utils/hostedAiBudget.js', () => ({
  isHostedAiEnabled: vi.fn(() => false),
  hostedDailyCeilingCents: vi.fn(() => 0),
  hostedUserMonthlyCapCents: vi.fn(() => 0),
  globalSpendTodayCents: vi.fn(() => 0),
  userSpendThisMonthCents: vi.fn(() => 0),
}));

const { checkCanvasLimit, checkShareLimit } = await import('./planLimits.js');

const runMiddleware = async (mw: ReturnType<typeof checkCanvasLimit>, plan = 'free') => {
  // planLimits reads req.userPlan / req.userId (set by the auth middleware),
  // not req.user.
  const req = { userId: 'user-1', userPlan: plan, params: {} } as unknown as Request;
  const next = vi.fn() as unknown as NextFunction;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  await mw(req, res, next);
  return { next, res };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.codingCanvas.count.mockResolvedValue(0);
  mockPrisma.canvasShare.count.mockResolvedValue(0);
});

describe('checkCanvasLimit', () => {
  it('counts only live canvases, so a trashed one does not hold a slot', async () => {
    await runMiddleware(checkCanvasLimit());
    const where = mockPrisma.codingCanvas.count.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({ deletedAt: null });
  });

  it('refuses once the live count reaches the cap', async () => {
    mockPrisma.codingCanvas.count.mockResolvedValue(2); // Free allows 2
    const { next, res } = await runMiddleware(checkCanvasLimit());
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('checkShareLimit', () => {
  it('counts only shares on live canvases, matching the usage /auth/me reports', async () => {
    await runMiddleware(checkShareLimit());
    const where = mockPrisma.canvasShare.count.mock.calls[0]?.[0]?.where;
    // The regression: without deletedAt the meter and the cap disagree, and a
    // user reads "3/5" while being refused.
    expect(where?.canvas).toMatchObject({ deletedAt: null });
  });

  it('lets a share through when under the cap', async () => {
    // Free allows 0 shares, so use a tier that actually permits sharing.
    mockPrisma.canvasShare.count.mockResolvedValue(1);
    const { next } = await runMiddleware(checkShareLimit(), 'student'); // student allows 2
    expect(next).toHaveBeenCalled();
  });

  it('refuses once the live share count reaches the cap', async () => {
    mockPrisma.canvasShare.count.mockResolvedValue(2);
    const { next, res } = await runMiddleware(checkShareLimit(), 'student');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
