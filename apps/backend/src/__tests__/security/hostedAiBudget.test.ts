import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findUnique: vi.fn() },
    dashboardAccess: { findUnique: vi.fn(), findFirst: vi.fn() },
    userAiConfig: { findUnique: vi.fn() },
    aiUsage: { aggregate: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../utils/encryption.js', () => ({
  decryptApiKey: vi.fn().mockReturnValue('sk-user-byo-key'),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { checkHostedAiBudget } from '../../middleware/planLimits.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/ai', auth, checkHostedAiBudget(), (_req: Request, res: Response) => {
    res.status(201).json({ success: true });
  });
  app.use(errorHandler);
  return app;
}

function mockUser(id: string, plan: string) {
  return { id, email: `${id}@example.com`, name: id, role: 'researcher', plan, dashboardAccess: null };
}

const cents = (n: number) => ({ _sum: { costCents: n } });

describe('Hosted-AI budget guardrails — checkHostedAiBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.userAiConfig.findUnique.mockResolvedValue(null); // no BYO by default
    process.env.HOSTED_AI_ENABLED = 'true';
    process.env.OPENAI_API_KEY = 'sk-server-test';
    process.env.HOSTED_AI_DAILY_CENTS_CEILING = '2000'; // $20/day
    process.env.HOSTED_AI_USER_MONTHLY_CENTS_CAP = '500'; // $5/user/mo
  });

  afterEach(() => {
    delete process.env.HOSTED_AI_ENABLED;
    delete process.env.OPENAI_API_KEY;
    delete process.env.HOSTED_AI_DAILY_CENTS_CEILING;
    delete process.env.HOSTED_AI_USER_MONTHLY_CENTS_CAP;
  });

  it('is a no-op when hosted AI is disabled (no server key)', async () => {
    delete process.env.OPENAI_API_KEY; // disabled
    const jwt = signUserToken('u1', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'pro'));

    const res = await request(createApp()).post('/api/ai').set('Authorization', `Bearer ${jwt}`).send({});
    expect(res.status).toBe(201);
    expect(mockPrisma.aiUsage.aggregate).not.toHaveBeenCalled();
  });

  it('allows a hosted user under both budgets', async () => {
    const jwt = signUserToken('u1', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'pro'));
    mockPrisma.aiUsage.aggregate.mockResolvedValueOnce(cents(500)).mockResolvedValueOnce(cents(100)); // global, user

    const res = await request(createApp()).post('/api/ai').set('Authorization', `Bearer ${jwt}`).send({});
    expect(res.status).toBe(201);
  });

  it('pauses (503) when the global daily ceiling is reached', async () => {
    const jwt = signUserToken('u1', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'pro'));
    mockPrisma.aiUsage.aggregate.mockResolvedValueOnce(cents(2000)); // global == ceiling

    const res = await request(createApp()).post('/api/ai').set('Authorization', `Bearer ${jwt}`).send({});
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('HOSTED_AI_PAUSED');
  });

  it('blocks (403) when the user monthly cap is reached', async () => {
    const jwt = signUserToken('u1', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'pro'));
    mockPrisma.aiUsage.aggregate.mockResolvedValueOnce(cents(800)).mockResolvedValueOnce(cents(500)); // global ok, user == cap

    const res = await request(createApp()).post('/api/ai').set('Authorization', `Bearer ${jwt}`).send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('hostedAiMonthlyCents');
  });

  it('bypasses the budget for a user on their own OpenAI key', async () => {
    const jwt = signUserToken('u-byo', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u-byo', 'pro'));
    mockPrisma.userAiConfig.findUnique.mockResolvedValue({
      userId: 'u-byo',
      provider: 'openai',
      apiKeyEncrypted: 'e',
      apiKeyIv: 'i',
      apiKeyTag: 't',
    });

    const res = await request(createApp()).post('/api/ai').set('Authorization', `Bearer ${jwt}`).send({});
    expect(res.status).toBe(201);
    expect(mockPrisma.aiUsage.aggregate).not.toHaveBeenCalled(); // bypassed before any spend query
  });

  it('skips legacy access-code users (no per-user userId)', async () => {
    const next = vi.fn();
    const req = { userId: undefined } as unknown as Request;
    await checkHostedAiBudget()(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockPrisma.aiUsage.aggregate).not.toHaveBeenCalled();
  });
});
