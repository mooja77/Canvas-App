import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    dashboardAccess: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    codingCanvas: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasTranscript: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    canvasQuestion: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    canvasTextCoding: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasNodePosition: {
      upsert: vi.fn(),
    },
    canvasComputedNode: {
      create: vi.fn(),
    },
    canvasShare: { count: vi.fn() },
    canvasMemo: { count: vi.fn() },
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../middleware/authLimiter.js', () => ({
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../middleware/planLimits.js', () => ({
  checkCanvasLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkTranscriptLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkWordLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCodeLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAutoCode: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCaseAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkShareLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAnalysisType: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAnalysisTypeOnRun: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock12nanoid'),
}));

vi.mock('../../lib/stripe.js', () => ({
  getStripe: vi.fn().mockReturnValue({
    subscriptions: { cancel: vi.fn() },
  }),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(),
  },
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { canvasRoutes } from '../../routes/canvasRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, canvasRoutes);
  app.use(errorHandler);
  return app;
}

describe('Input validation tests', () => {
  let app: express.Express;
  const userId = 'user-val-1';
  const dashboardAccessId = 'da-val-1';
  const jwt = signUserToken(userId, 'researcher', 'pro');
  const canvasId = 'canvas-val-1';

  const mockUser = {
    id: userId,
    email: 'validator@example.com',
    name: 'Validator',
    role: 'researcher',
    plan: 'pro',
    dashboardAccess: { id: dashboardAccessId },
  };

  const mockCanvas = {
    id: canvasId,
    name: 'Validation Canvas',
    dashboardAccessId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
  });

  // ─── POST /canvas with empty name → 400 ───
  it('POST /canvas with empty name returns 400', async () => {
    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/validation/i);
  });

  // ─── POST /canvas with name > 200 chars → 400 ───
  it('POST /canvas with name > 200 chars returns 400', async () => {
    const longName = 'A'.repeat(201);

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: longName });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/validation/i);
  });

  // ─── POST /canvas/:id/transcripts with empty content → 400 ───
  it('POST /canvas/:id/transcripts with empty content returns 400', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ title: 'Valid Title', content: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/validation/i);
  });

  // ─── POST /canvas/:id/codings with startOffset > endOffset → 400 ───
  it('POST /canvas/:id/codings with startOffset > endOffset returns 400', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/codings`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        transcriptId: 'tid',
        questionId: 'qid',
        startOffset: 100,
        endOffset: 0,
        codedText: 'text',
      });

    // endOffset has min(1), so endOffset=0 fails validation
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── POST /canvas/:id/questions with text > 1000 chars → 400 ───
  it('POST /canvas/:id/questions with text > 1000 chars returns 400', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/questions`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ text: 'Q'.repeat(1001) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/validation/i);
  });

  // ─── PUT /canvas/:canvasId with invalid JSON body → error ───
  it('PUT /canvas/:canvasId with invalid JSON body returns error status', async () => {
    const res = await request(app)
      .put(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');

    // Express json parser throws a SyntaxError which the error handler catches as 500
    // The key assertion is that the request does not succeed
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  // ─── POST /canvas/:id/computed with invalid nodeType → 400 ───
  it('POST /canvas/:id/computed with invalid nodeType returns 400', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ nodeType: 'nonexistent_type', label: 'Bad Node' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/validation/i);
  });

  // ─── POST /canvas with missing name field → 400 ───
  it('POST /canvas with missing name field returns 400', async () => {
    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ description: 'Only description, no name' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
