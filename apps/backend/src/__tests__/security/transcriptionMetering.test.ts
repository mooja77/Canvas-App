import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma + crypto before importing anything that uses them ───
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
// BYO-key decryption — returns a usable key so a configured OpenAI provider
// counts as a working BYO key (the bypass path).
vi.mock('../../utils/encryption.js', () => ({
  decryptApiKey: vi.fn().mockReturnValue('sk-user-byo-key'),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { checkTranscriptionMinutes } from '../../middleware/planLimits.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/transcribe', auth, checkTranscriptionMinutes(), (_req: Request, res: Response) => {
    res.status(201).json({ success: true });
  });
  app.use(errorHandler);
  return app;
}

function mockUser(id: string, plan: string) {
  return { id, email: `${id}@example.com`, name: id, role: 'researcher', plan, dashboardAccess: null };
}

/** AiUsage.aggregate stub: report `minutes` of metered (server-key) usage. */
function usageOf(minutes: number) {
  return { _sum: { costCents: minutes * 0.6 } };
}

describe('Transcription minute metering — checkTranscriptionMinutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no BYO key configured.
    mockPrisma.userAiConfig.findUnique.mockResolvedValue(null);
  });

  it('blocks a Free user (0-minute allowance) with no BYO key', async () => {
    const jwt = signUserToken('u-free', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u-free', 'free'));
    mockPrisma.aiUsage.aggregate.mockResolvedValue(usageOf(0));

    const res = await request(createApp()).post('/api/transcribe').set('Authorization', `Bearer ${jwt}`).send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('transcriptionMinutesPerMonth');
    expect(res.body.max).toBe(0);
  });

  it('allows a Student under the monthly cap (120 of 300 min)', async () => {
    const jwt = signUserToken('u-stu', 'researcher', 'student');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u-stu', 'student'));
    mockPrisma.aiUsage.aggregate.mockResolvedValue(usageOf(120));

    const res = await request(createApp()).post('/api/transcribe').set('Authorization', `Bearer ${jwt}`).send({});

    expect(res.status).toBe(201);
  });

  it('blocks a Student who has reached the monthly cap (300 of 300 min)', async () => {
    const jwt = signUserToken('u-stu', 'researcher', 'student');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u-stu', 'student'));
    mockPrisma.aiUsage.aggregate.mockResolvedValue(usageOf(300));

    const res = await request(createApp()).post('/api/transcribe').set('Authorization', `Bearer ${jwt}`).send({});

    expect(res.status).toBe(403);
    expect(res.body.limit).toBe('transcriptionMinutesPerMonth');
    expect(res.body.current).toBe(300);
    expect(res.body.max).toBe(300);
  });

  it('allows a Pro user under the (larger) monthly cap (400 of 600 min)', async () => {
    const jwt = signUserToken('u-pro', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u-pro', 'pro'));
    mockPrisma.aiUsage.aggregate.mockResolvedValue(usageOf(400));

    const res = await request(createApp()).post('/api/transcribe').set('Authorization', `Bearer ${jwt}`).send({});

    expect(res.status).toBe(201);
  });

  it('bypasses the cap entirely for a user with a working BYO OpenAI key (even on Free)', async () => {
    const jwt = signUserToken('u-byo', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u-byo', 'free'));
    mockPrisma.userAiConfig.findUnique.mockResolvedValue({
      userId: 'u-byo',
      provider: 'openai',
      apiKeyEncrypted: 'enc',
      apiKeyIv: 'iv',
      apiKeyTag: 'tag',
    });

    const res = await request(createApp()).post('/api/transcribe').set('Authorization', `Bearer ${jwt}`).send({});

    expect(res.status).toBe(201);
    // BYO bypass short-circuits before the usage query runs.
    expect(mockPrisma.aiUsage.aggregate).not.toHaveBeenCalled();
  });

  it('does NOT bypass for a non-OpenAI BYO provider (Anthropic key cannot drive Whisper)', async () => {
    const jwt = signUserToken('u-anthropic', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u-anthropic', 'free'));
    mockPrisma.userAiConfig.findUnique.mockResolvedValue({
      userId: 'u-anthropic',
      provider: 'anthropic',
      apiKeyEncrypted: 'enc',
      apiKeyIv: 'iv',
      apiKeyTag: 'tag',
    });
    mockPrisma.aiUsage.aggregate.mockResolvedValue(usageOf(0));

    const res = await request(createApp()).post('/api/transcribe').set('Authorization', `Bearer ${jwt}`).send({});

    expect(res.status).toBe(403); // Free cap 0, Anthropic key can't transcribe
  });

  it('blocks legacy access-code users because transcription requires an accountable email user', async () => {
    const next = vi.fn();
    const req = { userId: undefined } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    await checkTranscriptionMinutes()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(mockPrisma.userAiConfig.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.aiUsage.aggregate).not.toHaveBeenCalled();
  });
});
