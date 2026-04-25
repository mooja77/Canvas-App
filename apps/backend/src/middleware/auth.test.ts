import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mocks must be hoisted so the module under test reads them on import.
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    dashboardAccess: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));

vi.mock('../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

import { auth } from './auth.js';
import { signUserToken, signResearcherToken } from '../utils/jwt.js';
import { AppError } from './errorHandler.js';

interface MockReq {
  headers: Record<string, string | undefined>;
  cookies?: Record<string, string>;
  userId?: string;
  userPlan?: string;
  userRole?: string;
  dashboardAccessId?: string;
  dashboardAccess?: unknown;
}

function makeReq(overrides: Partial<MockReq> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response {
  return {
    setHeader: vi.fn(),
  } as unknown as Response;
}

describe('auth middleware — cookie priority and session invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a jwt from the cookie when no Bearer header is present', async () => {
    const jwt = signUserToken('user-1', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'pro',
      role: 'researcher',
      sessionsInvalidAt: null,
      dashboardAccess: null,
    });

    const req = makeReq({ cookies: { jwt } });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe('user-1');
    expect(req.userPlan).toBe('pro');
  });

  it('prefers the cookie over a stale Bearer header', async () => {
    // Cookie JWT is for user-cookie; Bearer header is for user-header. Cookie wins.
    const cookieJwt = signUserToken('user-cookie', 'researcher', 'pro');
    const headerJwt = signUserToken('user-header', 'researcher', 'free');

    mockPrisma.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve({
        id: where.id,
        plan: where.id === 'user-cookie' ? 'pro' : 'free',
        role: 'researcher',
        sessionsInvalidAt: null,
        dashboardAccess: null,
      }),
    );

    const req = makeReq({
      cookies: { jwt: cookieJwt },
      headers: { authorization: `Bearer ${headerJwt}` },
    });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe('user-cookie');
    expect(req.userPlan).toBe('pro');
  });

  it('falls back to Bearer header when no cookie is present', async () => {
    const jwt = signUserToken('user-bearer', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-bearer',
      plan: 'pro',
      role: 'researcher',
      sessionsInvalidAt: null,
      dashboardAccess: null,
    });

    const req = makeReq({ headers: { authorization: `Bearer ${jwt}` } });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe('user-bearer');
  });

  it('returns 401 when no credential is provided', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    const err = (next as unknown as { mock: { calls: [unknown][] } }).mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(401);
  });

  it('rejects a JWT whose iat predates the user.sessionsInvalidAt timestamp', async () => {
    // Token signed now, then we claim the user invalidated sessions 1 second later.
    const jwt = signUserToken('user-rotated', 'researcher', 'pro');
    const nowMs = Date.now();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-rotated',
      plan: 'pro',
      role: 'researcher',
      // 60s in the future — guarantees iat < sessionsInvalidAt even with clock skew
      sessionsInvalidAt: new Date(nowMs + 60_000),
      dashboardAccess: null,
    });

    const req = makeReq({ cookies: { jwt } });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    const err = (next as unknown as { mock: { calls: [unknown][] } }).mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(401);
    expect((err as AppError).message).toMatch(/session/i);
    expect(req.userId).toBeUndefined();
  });

  it('accepts a JWT whose iat is after the user.sessionsInvalidAt timestamp', async () => {
    // User invalidated 60s ago; token is fresh.
    const jwt = signUserToken('user-fresh', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-fresh',
      plan: 'pro',
      role: 'researcher',
      sessionsInvalidAt: new Date(Date.now() - 60_000),
      dashboardAccess: null,
    });

    const req = makeReq({ cookies: { jwt } });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe('user-fresh');
  });

  it('ignores sessionsInvalidAt when it is null (no rotation yet)', async () => {
    const jwt = signUserToken('user-never-rotated', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-never-rotated',
      plan: 'pro',
      role: 'researcher',
      sessionsInvalidAt: null,
      dashboardAccess: null,
    });

    const req = makeReq({ cookies: { jwt } });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe('user-never-rotated');
  });

  it('accepts legacy researcher JWTs via cookie', async () => {
    const jwt = signResearcherToken('access-1', 'researcher');
    mockPrisma.dashboardAccess.findFirst.mockResolvedValue({
      id: 'access-1',
      name: 'Legacy',
      role: 'researcher',
    });

    const req = makeReq({ cookies: { jwt } });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.dashboardAccessId).toBe('access-1');
    expect(req.userPlan).toBe('pro'); // Legacy grandfathered
  });

  // ─── Trial overlay ───
  // free + active trial → effective plan is 'pro' (full feature access)
  // free + expired trial → effective plan is 'free' (back to limits)
  // pro/team users ignore trial (Stripe is the source of truth once paid)
  it('promotes free user to pro while trial is active', async () => {
    const jwt = signUserToken('user-trial', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-trial',
      plan: 'free',
      role: 'researcher',
      sessionsInvalidAt: null,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      dashboardAccess: null,
    });

    const req = makeReq({ cookies: { jwt } });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.userPlan).toBe('pro');
  });

  it('keeps free user on free plan after trial has expired', async () => {
    const jwt = signUserToken('user-expired', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-expired',
      plan: 'free',
      role: 'researcher',
      sessionsInvalidAt: null,
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      dashboardAccess: null,
    });

    const req = makeReq({ cookies: { jwt } });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.userPlan).toBe('free');
  });

  it('respects user.plan over trialEndsAt — paid users ignore the overlay', async () => {
    // Trial set in the future, but user has already paid (plan === 'pro').
    // The overlay only kicks in for free users, so this stays 'pro'. The
    // inverse case (free user with trial ended but plan accidentally 'pro')
    // would also stay pro, which is correct — plan column is the source of
    // truth post-payment, and Stripe webhooks own it.
    const jwt = signUserToken('user-paid', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-paid',
      plan: 'pro',
      role: 'researcher',
      sessionsInvalidAt: null,
      trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      dashboardAccess: null,
    });

    const req = makeReq({ cookies: { jwt } });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.userPlan).toBe('pro');
  });

  it('treats null trialEndsAt as no trial — pre-2026 free users stay free', async () => {
    const jwt = signUserToken('user-old-free', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-old-free',
      plan: 'free',
      role: 'researcher',
      sessionsInvalidAt: null,
      trialEndsAt: null,
      dashboardAccess: null,
    });

    const req = makeReq({ cookies: { jwt } });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await auth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.userPlan).toBe('free');
  });
});
