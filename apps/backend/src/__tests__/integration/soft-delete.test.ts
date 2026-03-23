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

// Mock rate limiter to be a pass-through
vi.mock('../../middleware/authLimiter.js', () => ({
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Mock audit logging
vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Mock hashing utils
vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

// Mock plan limits — pass through for integration tests
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

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock12nanoid'),
}));

// Mock stripe
vi.mock('../../lib/stripe.js', () => ({
  getStripe: vi.fn().mockReturnValue({
    subscriptions: { cancel: vi.fn() },
  }),
}));

// Mock bcrypt
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

describe('Soft delete integration tests', () => {
  let app: express.Express;
  const userId = 'user-softdel-1';
  const dashboardAccessId = 'da-softdel-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'softdel@example.com',
    name: 'Soft Delete Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-sd-1';
  const mockCanvas = {
    id: canvasId,
    name: 'Test Canvas',
    description: 'A test canvas',
    dashboardAccessId,
    userId,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const trashedCanvas = {
    ...mockCanvas,
    deletedAt: new Date('2025-01-15T00:00:00Z'),
  };

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
  });

  // ─── 1. DELETE /canvas/:id sets deletedAt (not hard delete) ───
  it('DELETE /canvas/:id soft-deletes by setting deletedAt', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.codingCanvas.update.mockResolvedValue({ ...mockCanvas, deletedAt: new Date() });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Verify update was called (not delete)
    expect(mockPrisma.codingCanvas.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: canvasId },
        data: { deletedAt: expect.any(Date) },
      })
    );
    // Hard delete should NOT have been called
    expect(mockPrisma.codingCanvas.delete).not.toHaveBeenCalled();
  });

  // ─── 2. GET /canvas excludes soft-deleted canvases ───
  it('GET /canvas excludes soft-deleted canvases', async () => {
    const activeCanvas = {
      ...mockCanvas,
      deletedAt: null,
      _count: { transcripts: 0, questions: 0, codings: 0 },
    };
    mockPrisma.codingCanvas.findMany.mockResolvedValue([activeCanvas]);
    mockPrisma.codingCanvas.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    // Verify that findMany was called with deletedAt: null filter
    expect(mockPrisma.codingCanvas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
  });

  // ─── 3. GET /canvas/trash returns only soft-deleted canvases ───
  it('GET /canvas/trash returns only soft-deleted canvases', async () => {
    const trashedItem = {
      ...trashedCanvas,
      _count: { transcripts: 1, questions: 2, codings: 3 },
    };
    mockPrisma.codingCanvas.findMany.mockResolvedValue([trashedItem]);

    const res = await request(app)
      .get('/api/canvas/trash')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(canvasId);
    // Verify that findMany was called with deletedAt: { not: null } filter
    expect(mockPrisma.codingCanvas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: { not: null } }),
      })
    );
  });

  // ─── 4. POST /canvas/:id/restore clears deletedAt ───
  it('POST /canvas/:id/restore clears deletedAt', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...trashedCanvas });
    mockPrisma.codingCanvas.update.mockResolvedValue({ ...mockCanvas, deletedAt: null });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/restore`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPrisma.codingCanvas.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: canvasId },
        data: { deletedAt: null },
      })
    );
  });

  // ─── 5. DELETE /canvas/:id/permanent actually deletes ───
  it('DELETE /canvas/:id/permanent hard-deletes a trashed canvas', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...trashedCanvas });
    mockPrisma.codingCanvas.delete.mockResolvedValue({ ...trashedCanvas });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/permanent`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPrisma.codingCanvas.delete).toHaveBeenCalledWith({ where: { id: canvasId } });
  });

  // ─── 6. Permanent delete on non-trashed canvas → 400 ───
  it('DELETE /canvas/:id/permanent on non-trashed canvas returns 400', async () => {
    // Canvas is NOT in trash (deletedAt is null)
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas, deletedAt: null });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/permanent`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/trash/i);
    expect(mockPrisma.codingCanvas.delete).not.toHaveBeenCalled();
  });

  // ─── Additional: POST /canvas/:id/restore on non-trashed canvas → 400 ───
  it('POST /canvas/:id/restore on non-trashed canvas returns 400', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas, deletedAt: null });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/restore`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not in trash/i);
  });
});
