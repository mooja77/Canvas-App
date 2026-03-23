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
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasQuestion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasTextCoding: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasMemo: {
      create: vi.fn(),
      count: vi.fn(),
    },
    canvasShare: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasCase: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    canvasRelation: {
      create: vi.fn(),
    },
    canvasComputedNode: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    canvasNodePosition: {
      upsert: vi.fn(),
    },
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
  nanoid: vi.fn().mockReturnValue('ABCD1234'),
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
import { canvasRoutes, canvasPublicRoutes } from '../../routes/canvasRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  // Public routes (no auth)
  app.use('/api', canvasPublicRoutes);
  // Protected routes
  app.use('/api', auth, canvasRoutes);
  app.use(errorHandler);
  return app;
}

describe('Sharing integration tests', () => {
  let app: express.Express;
  const userId = 'user-share-1';
  const dashboardAccessId = 'da-share-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'sharing@example.com',
    name: 'Share Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-s1';
  const mockCanvas = {
    id: canvasId,
    name: 'Sharing Test Canvas',
    description: 'A canvas for sharing tests',
    dashboardAccessId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
  });

  // ─── 1. POST /canvas/:id/share — creates share code ───
  it('POST /canvas/:id/share creates a share code', async () => {
    const shareId = 'share-s1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasShare.create.mockResolvedValue({
      id: shareId,
      canvasId,
      shareCode: 'SHARE-ABCD1234',
      createdBy: dashboardAccessId,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/share`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shareCode).toMatch(/^SHARE-/);
    expect(res.body.data.canvasId).toBe(canvasId);
  });

  // ─── 2. GET /canvas/:id/shares — lists shares ───
  it('GET /canvas/:id/shares lists all share codes', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasShare.findMany.mockResolvedValue([
      { id: 'share-1', canvasId, shareCode: 'SHARE-CODE1', createdAt: new Date() },
      { id: 'share-2', canvasId, shareCode: 'SHARE-CODE2', createdAt: new Date() },
    ]);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/shares`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  // ─── 3. DELETE /canvas/:id/share/:shareId — revokes share ───
  it('DELETE /canvas/:id/share/:shareId revokes a share', async () => {
    const shareId = 'share-s1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: shareId,
      canvasId,
      shareCode: 'SHARE-CODE1',
    });
    mockPrisma.canvasShare.delete.mockResolvedValue({ id: shareId });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/share/${shareId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── 4. DELETE /canvas/:id/share/:shareId — returns 404 for wrong share ───
  it('DELETE /canvas/:id/share/:shareId returns 404 when share not found', async () => {
    const shareId = 'share-nonexistent';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasShare.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/share/${shareId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ─── 5. POST /canvas/clone/:code — clones canvas from valid code ───
  it('POST /canvas/clone/:code clones canvas from valid share code', async () => {
    const shareCode = 'SHARE-VALID1';

    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: 'share-clone1',
      canvasId,
      shareCode,
      expiresAt: null,
    });

    const sourceCanvas = {
      ...mockCanvas,
      transcripts: [
        { id: 'tr-src', title: 'Source Transcript', content: 'Hello world', sortOrder: 0, caseId: null },
      ],
      questions: [
        { id: 'q-src', text: 'Source Question', color: '#000000', sortOrder: 0, parentQuestionId: null },
      ],
      memos: [],
      codings: [],
      cases: [],
      relations: [],
      computedNodes: [],
    };

    // findUnique is called twice: once for source canvas (with include), once for unique name check
    mockPrisma.codingCanvas.findUnique
      .mockResolvedValueOnce(sourceCanvas) // source canvas lookup
      .mockResolvedValueOnce(null); // unique name check (no conflict)

    const clonedCanvas = {
      id: 'canvas-cloned',
      name: 'Sharing Test Canvas (Clone)',
      description: mockCanvas.description,
      dashboardAccessId,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        codingCanvas: { create: vi.fn().mockResolvedValue(clonedCanvas) },
        canvasTranscript: { create: vi.fn().mockResolvedValue({ id: 'tr-new' }) },
        canvasQuestion: { create: vi.fn().mockResolvedValue({ id: 'q-new' }), update: vi.fn() },
        canvasMemo: { create: vi.fn() },
        canvasTextCoding: { create: vi.fn() },
        canvasCase: { create: vi.fn() },
        canvasRelation: { create: vi.fn() },
        canvasComputedNode: { create: vi.fn() },
        canvasShare: { update: vi.fn() },
      };
      return fn(tx);
    });

    const res = await request(app)
      .post(`/api/canvas/clone/${shareCode}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  // ─── 6. POST /canvas/clone/:code — rejects expired share code ───
  it('POST /canvas/clone/:code rejects expired share code', async () => {
    const shareCode = 'SHARE-EXPIRED';
    const pastDate = new Date('2020-01-01');

    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: 'share-expired',
      canvasId,
      shareCode,
      expiresAt: pastDate,
    });

    const res = await request(app)
      .post(`/api/canvas/clone/${shareCode}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
  });

  // ─── 7. POST /canvas/clone/:code — returns 404 for invalid code ───
  it('POST /canvas/clone/:code returns 404 for invalid share code', async () => {
    mockPrisma.canvasShare.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/canvas/clone/INVALID-CODE')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ─── 8. GET /canvas/shared/:code — returns canvas data (no auth needed) ───
  it('GET /canvas/shared/:code returns shared canvas data without auth', async () => {
    const shareCode = 'SHARE-PUBLIC1';

    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: 'share-public1',
      canvasId,
      shareCode,
      expiresAt: null,
    });

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      ...mockCanvas,
      transcripts: [{ id: 'tr-1', title: 'Transcript', content: 'content' }],
      questions: [{ id: 'q-1', text: 'Question' }],
      memos: [],
      codings: [],
      cases: [{ id: 'case-1', name: 'Case 1', attributes: '{}' }],
      relations: [],
      computedNodes: [{ id: 'cn-1', nodeType: 'stats', config: '{}', result: '{}' }],
    });

    const res = await request(app)
      .get(`/api/canvas/shared/${shareCode}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transcripts).toHaveLength(1);
    expect(res.body.data.questions).toHaveLength(1);
  });

  // ─── 9. GET /canvas/shared/:code — returns 404 for invalid code ───
  it('GET /canvas/shared/:code returns 404 for invalid share code', async () => {
    mockPrisma.canvasShare.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/canvas/shared/NONEXISTENT');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ─── 10. POST /canvas/:id/share — validates canvas ownership ───
  it('POST /canvas/:id/share returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-s';
    const otherDaId = 'da-other-s';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'others@example.com',
      name: 'Other Sharer',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/share`)
      .set('Authorization', `Bearer ${otherJwt}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── 11. GET /canvas/shared/:code — returns 410 for expired share ───
  it('GET /canvas/shared/:code returns 410 for expired share code', async () => {
    const shareCode = 'SHARE-EXPIRED2';
    const pastDate = new Date('2020-01-01');

    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: 'share-expired2',
      canvasId,
      shareCode,
      expiresAt: pastDate,
    });

    const res = await request(app)
      .get(`/api/canvas/shared/${shareCode}`);

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
  });
});
