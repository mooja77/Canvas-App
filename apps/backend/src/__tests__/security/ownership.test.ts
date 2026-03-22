import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
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
      findFirst: vi.fn(),
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
    canvasShare: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
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

describe('Ownership and access control tests', () => {
  let app: express.Express;

  // User A
  const userAId = 'user-a';
  const userADaId = 'da-a';
  const userAJwt = signUserToken(userAId, 'researcher', 'pro');
  const userA = {
    id: userAId,
    email: 'usera@example.com',
    name: 'User A',
    role: 'researcher',
    plan: 'pro',
    dashboardAccess: { id: userADaId },
  };

  // User B
  const userBId = 'user-b';
  const userBDaId = 'da-b';
  const userBCanvasId = 'canvas-b';
  const userBCanvas = {
    id: userBCanvasId,
    name: 'User B Canvas',
    dashboardAccessId: userBDaId,
    userId: userBId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  /** Helper: set up auth mock so User A is authenticated */
  function authAsUserA() {
    mockPrisma.user.findUnique.mockResolvedValue({ ...userA });
  }

  // ─── User A cannot GET User B's canvas ───
  it('User A GET /canvas/:userBCanvasId returns 403', async () => {
    authAsUserA();
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      ...userBCanvas,
      transcripts: [],
      questions: [],
      memos: [],
      codings: [],
      nodePositions: [],
      cases: [],
      relations: [],
      computedNodes: [],
    });

    const res = await request(app)
      .get(`/api/canvas/${userBCanvasId}`)
      .set('Authorization', `Bearer ${userAJwt}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── User A cannot POST transcripts to User B's canvas ───
  it('User A POST /canvas/:userBCanvasId/transcripts returns 403', async () => {
    authAsUserA();
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...userBCanvas });

    const res = await request(app)
      .post(`/api/canvas/${userBCanvasId}/transcripts`)
      .set('Authorization', `Bearer ${userAJwt}`)
      .send({ title: 'Intruder Transcript', content: 'Should not be allowed' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── User A cannot POST questions to User B's canvas ───
  it('User A POST /canvas/:userBCanvasId/questions returns 403', async () => {
    authAsUserA();
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...userBCanvas });

    const res = await request(app)
      .post(`/api/canvas/${userBCanvasId}/questions`)
      .set('Authorization', `Bearer ${userAJwt}`)
      .send({ text: 'Intruder question?' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── User A cannot DELETE User B's canvas ───
  it('User A DELETE /canvas/:userBCanvasId returns 403', async () => {
    authAsUserA();
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...userBCanvas });

    const res = await request(app)
      .delete(`/api/canvas/${userBCanvasId}`)
      .set('Authorization', `Bearer ${userAJwt}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── User A cannot PUT layout on User B's canvas ───
  it('User A PUT /canvas/:userBCanvasId/layout returns 403', async () => {
    authAsUserA();
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...userBCanvas });

    const res = await request(app)
      .put(`/api/canvas/${userBCanvasId}/layout`)
      .set('Authorization', `Bearer ${userAJwt}`)
      .send({
        positions: [{ nodeId: 'n1', nodeType: 'transcript', x: 0, y: 0 }],
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── No auth header → 401 ───
  it('POST /canvas with no auth header returns 401', async () => {
    const res = await request(app)
      .post('/api/canvas')
      .send({ name: 'No Auth Canvas' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ─── Invalid JWT → 401 ───
  it('POST /canvas with invalid JWT returns 401', async () => {
    // verifyToken returns null for garbage tokens; auth middleware falls back to raw access code
    mockPrisma.dashboardAccess.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', 'Bearer totally.invalid.token')
      .send({ name: 'Bad Token Canvas' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ─── Malformed JWT → 401 ───
  it('POST /canvas with malformed JWT returns 401', async () => {
    mockPrisma.dashboardAccess.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjF9.invalid')
      .send({ name: 'Expired-like Token' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ─── GET without auth → 401 ───
  it('GET /canvas without auth returns 401', async () => {
    const res = await request(app)
      .get('/api/canvas');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ─── User A cannot update User B's canvas ───
  it('User A PUT /canvas/:userBCanvasId returns 403', async () => {
    authAsUserA();
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...userBCanvas });

    const res = await request(app)
      .put(`/api/canvas/${userBCanvasId}`)
      .set('Authorization', `Bearer ${userAJwt}`)
      .send({ name: 'Hijacked Canvas' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
