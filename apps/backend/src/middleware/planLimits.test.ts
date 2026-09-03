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
    codingCanvas: { count: vi.fn(), findUnique: vi.fn() },
    canvasShare: { count: vi.fn() },
    aiUsage: { count: vi.fn() },
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

const {
  checkCanvasLimit,
  checkShareLimit,
  checkAnalysisType,
  checkAutoCode,
  checkAiAccess,
  checkEthicsAccess,
  checkIntercoderAccess,
  checkIntegrationsAccess,
  resolveRequestPlan,
} = await import('./planLimits.js');
const { resolveCanvasOwnerPlan, canvasOwnerPlanPayload } = await import('../utils/ownerPlan.js');

const runMiddleware = async (
  mw: ReturnType<typeof checkCanvasLimit>,
  plan = 'free',
  body: Record<string, unknown> = {},
) => {
  // planLimits reads req.userPlan / req.userId (set by the auth middleware),
  // not req.user.
  const req = { userId: 'user-1', userPlan: plan, params: {}, body } as unknown as Request;
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
  mockPrisma.aiUsage.count.mockResolvedValue(0);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bodyOf = (res: Response): any => (res.json as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];

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

/**
 * §3.2 item 2 of the 2026-08-23 audit: every plan gate hardcoded "Pro and Team"
 * and omitted Student, so a verified .edu user on the $5 tier was told to buy
 * the $15 one for features Student already includes in full. The messages are
 * now DERIVED from PLAN_LIMITS, so these assertions are really "the refusal
 * agrees with the table it is refusing from".
 */
describe('plan-gate refusal copy is derived from PLAN_LIMITS', () => {
  it('names Student for an analysis type Student includes', async () => {
    const { res } = await runMiddleware(checkAnalysisType(), 'free', { nodeType: 'matrix' });
    const message = bodyOf(res).error;
    expect(message).toContain('Student');
    expect(message).toContain('Pro');
    expect(message).toContain('Team');
  });

  it('names Student for auto-code, ethics and AI', async () => {
    for (const mw of [checkAutoCode(), checkEthicsAccess(), checkAiAccess()]) {
      const { res } = await runMiddleware(mw, 'free');
      expect(bodyOf(res).error).toMatch(/Student, Pro, and Team/);
    }
  });

  it('still names Team ALONE for intercoder, which only Team has', async () => {
    const { res } = await runMiddleware(checkIntercoderAccess(), 'pro');
    const message = bodyOf(res).error;
    expect(message).toContain('Team');
    expect(message).not.toContain('Student');
    expect(message).not.toContain('Pro');
  });

  it('does not sell integrations on Team, because no tier has them', async () => {
    const { res } = await runMiddleware(checkIntegrationsAccess(), 'team');
    // The old copy said "available on Team plans" while integrationsEnabled is
    // false on every tier - the exact false claim plans.ts documents retiring.
    expect(bodyOf(res).error).toBe('Integrations are not available on any plan.');
  });
});

/** §3.2 item 12: the share gate reported an allowance instead of a remedy. */
describe('checkShareLimit refusal offers a remedy', () => {
  it('tells a Free user which plans include share codes, not just that they have 0', async () => {
    const { res } = await runMiddleware(checkShareLimit(), 'free');
    const message = bodyOf(res).error;
    expect(message).not.toBe('Free plan allows 0 share codes');
    expect(message).toMatch(/Student allows 2/);
    expect(message).toMatch(/Team allows unlimited/);
  });

  it('tells a capped Student to revoke one or upgrade', async () => {
    mockPrisma.canvasShare.count.mockResolvedValue(2);
    const { res } = await runMiddleware(checkShareLimit(), 'student');
    const message = bodyOf(res).error;
    expect(message).toMatch(/revoke a share code/);
    expect(message).toMatch(/Pro allows 5/);
  });
});

/**
 * §3.2 item 7: /pricing sells AI text analysis as "Unlimited" while the server
 * caps every paid tier at the same 1,000/day. The cap is a fair-use guard and
 * stays, but the refusal must not pitch an upgrade that cannot lift it.
 */
describe('the daily AI ceiling does not pitch a useless upgrade', () => {
  it('says the limit applies to every plan and sets upgrade:false', async () => {
    mockPrisma.aiUsage.count.mockResolvedValue(1000);
    const { next, res } = await runMiddleware(checkAiAccess(), 'pro');
    expect(next).not.toHaveBeenCalled();
    const body = bodyOf(res);
    expect(body.upgrade).toBe(false);
    expect(body.error).toMatch(/applies to every plan/);
    expect(body.max).toBe(1000);
  });

  it('still marks genuinely upgradable refusals upgrade:true', async () => {
    const { res } = await runMiddleware(checkShareLimit(), 'free');
    expect(bodyOf(res).upgrade).toBe(true);
  });
});

/**
 * Bug hunt 2026-09-02 M6: the server gates canvas-scoped limits on the canvas
 * OWNER's plan, but the UI gated on the VIEWER's. GET /canvas/:id now reports
 * the owner's plan, computed by the same helper the middleware uses so the two
 * cannot drift.
 */
describe('resolveCanvasOwnerPlan — one resolution shared by middleware and detail route', () => {
  const ownerUser = (plan: string, extra: Partial<{ emailVerified: boolean; trialEndsAt: Date | null }> = {}) => ({
    plan,
    emailVerified: true,
    trialEndsAt: null,
    ...extra,
  });

  it('returns the owner user plan', () => {
    expect(resolveCanvasOwnerPlan({ user: ownerUser('team'), dashboardAccess: null })).toBe('team');
  });

  it('applies the trial overlay exactly like the auth middleware', () => {
    const inTrial = ownerUser('free', { trialEndsAt: new Date(Date.now() + 86_400_000) });
    expect(resolveCanvasOwnerPlan({ user: inTrial, dashboardAccess: null })).toBe('pro');
    const expired = ownerUser('free', { trialEndsAt: new Date(Date.now() - 86_400_000) });
    expect(resolveCanvasOwnerPlan({ user: expired, dashboardAccess: null })).toBe('free');
    const unverified = ownerUser('free', { emailVerified: false, trialEndsAt: new Date(Date.now() + 86_400_000) });
    expect(resolveCanvasOwnerPlan({ user: unverified, dashboardAccess: null })).toBe('free');
  });

  it('falls through to the linked access-code user, then to grandfathered Pro', () => {
    expect(resolveCanvasOwnerPlan({ user: null, dashboardAccess: { user: ownerUser('student') } })).toBe('student');
    expect(resolveCanvasOwnerPlan({ user: null, dashboardAccess: { user: null } })).toBe('pro');
    expect(resolveCanvasOwnerPlan({ user: null, dashboardAccess: null })).toBe('pro');
  });

  it('builds the detail payload with the limits JSON-safe (Infinity -> null)', () => {
    const payload = canvasOwnerPlanPayload({ user: ownerUser('team'), dashboardAccess: null });
    expect(payload.effectivePlan).toBe('team');
    expect(payload.limits.maxCanvases).toBeNull();
    expect(payload.limits.maxWordsPerTranscript).toBe(50000);
    expect(payload.limits.intercoderEnabled).toBe(true);
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });
});

describe('resolveRequestPlan — a collaborator is governed by the OWNER plan, not their own', () => {
  const canvasOwnedBy = (plan: string) => ({
    userId: 'owner-1',
    dashboardAccessId: 'owner-access',
    deletedAt: null,
    user: { plan, emailVerified: true, trialEndsAt: null },
    dashboardAccess: null,
    collaborators: [{ id: 'collab-row' }],
  });
  const collaboratorReq = (viewerPlan: string) =>
    ({
      params: { canvasId: 'canvas-1' },
      userId: 'collaborator-1',
      dashboardAccessId: 'collaborator-access',
      userPlan: viewerPlan,
    }) as unknown as Request;

  it('a Free collaborator on a Team canvas gets Team', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(canvasOwnedBy('team'));
    await expect(resolveRequestPlan(collaboratorReq('free'))).resolves.toBe('team');
  });

  it('a Pro collaborator on a Free canvas gets Free', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(canvasOwnedBy('free'));
    await expect(resolveRequestPlan(collaboratorReq('pro'))).resolves.toBe('free');
  });

  it('agrees with the pure helper on the same row', async () => {
    const row = canvasOwnedBy('student');
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(row);
    await expect(resolveRequestPlan(collaboratorReq('free'))).resolves.toBe(resolveCanvasOwnerPlan(row));
  });
});
