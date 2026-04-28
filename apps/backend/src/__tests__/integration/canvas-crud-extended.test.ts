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
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasTextCoding: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasMemo: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasNodePosition: {
      upsert: vi.fn(),
    },
    canvasCase: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    canvasRelation: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    canvasComputedNode: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    canvasShare: { count: vi.fn() },
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

describe('Canvas CRUD extended tests', () => {
  let app: express.Express;
  const userId = 'user-crud-ext-1';
  const dashboardAccessId = 'da-crud-ext-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'crudext@example.com',
    name: 'CRUD Extended Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-ext-1';
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

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
  });

  // ─── Canvas Update (PUT /canvas/:canvasId) ───

  it('PUT /canvas/:canvasId updates description only', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.codingCanvas.update.mockResolvedValue({
      ...mockCanvas,
      description: 'New description',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ description: 'New description' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.description).toBe('New description');
  });

  it('PUT /canvas/:canvasId updates both name and description', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.codingCanvas.update.mockResolvedValue({
      ...mockCanvas,
      name: 'Renamed Canvas',
      description: 'Renamed description',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Renamed Canvas', description: 'Renamed description' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Canvas');
    expect(res.body.data.description).toBe('Renamed description');
  });

  it('PUT /canvas/:canvasId returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-ext';
    const otherDaId = 'da-other-ext';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'other-ext@example.com',
      name: 'Other',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('PUT /canvas/:canvasId returns 404 for non-existent canvas', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/canvas/nonexistent-id')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('PUT /canvas/:canvasId rejects empty name string', async () => {
    const res = await request(app)
      .put(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('PUT /canvas/:canvasId rejects name > 200 chars', async () => {
    const res = await request(app)
      .put(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'A'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('PUT /canvas/:canvasId returns 409 on duplicate name', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    const prismaError = new Error('Unique constraint failed');
    (prismaError as Error & { code?: string }).code = 'P2002';
    mockPrisma.codingCanvas.update.mockRejectedValue(prismaError);

    const res = await request(app)
      .put(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Duplicate Name' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  // ─── Canvas Layout (PUT /canvas/:id/layout) ───

  it('PUT /canvas/:id/layout rejects invalid positions (missing nodeId)', async () => {
    const res = await request(app)
      .put(`/api/canvas/${canvasId}/layout`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        positions: [{ nodeType: 'transcript', x: 100, y: 200 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('PUT /canvas/:id/layout rejects empty positions array', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.$transaction.mockResolvedValue([]);

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/layout`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ positions: [] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /canvas/:id/layout saves multiple positions with optional fields', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/layout`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        positions: [
          { nodeId: 'n1', nodeType: 'transcript', x: 100, y: 200, width: 300, height: 150, collapsed: true },
          { nodeId: 'n2', nodeType: 'question', x: 400, y: 500 },
          { nodeId: 'n3', nodeType: 'memo', x: -50, y: -100 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /canvas/:id/layout returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-layout';
    const otherDaId = 'da-other-layout';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'otherlayout@example.com',
      name: 'Other Layout',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/layout`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({
        positions: [{ nodeId: 'n1', nodeType: 'transcript', x: 100, y: 200 }],
      });

    expect(res.status).toBe(403);
  });

  // ─── Canvas List (GET /canvas) with pagination ───

  it('GET /canvas returns paginated results with limit and offset', async () => {
    const canvases = Array.from({ length: 3 }, (_, i) => ({
      id: `canvas-page-${i}`,
      name: `Canvas ${i}`,
      dashboardAccessId,
      userId,
      deletedAt: null,
      _count: { transcripts: i, questions: i, codings: i },
    }));
    mockPrisma.codingCanvas.findMany.mockResolvedValue(canvases);
    mockPrisma.codingCanvas.count.mockResolvedValue(10);

    const res = await request(app).get('/api/canvas?limit=3&offset=2').set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.total).toBe(10);
    expect(res.body.limit).toBe(3);
    expect(res.body.offset).toBe(2);
    expect(mockPrisma.codingCanvas.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3, skip: 2 }));
  });

  it('GET /canvas caps limit at 200', async () => {
    mockPrisma.codingCanvas.findMany.mockResolvedValue([]);
    mockPrisma.codingCanvas.count.mockResolvedValue(0);

    const res = await request(app).get('/api/canvas?limit=500').set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(200);
    expect(mockPrisma.codingCanvas.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
  });

  it('GET /canvas defaults limit=50 and offset=0', async () => {
    mockPrisma.codingCanvas.findMany.mockResolvedValue([]);
    mockPrisma.codingCanvas.count.mockResolvedValue(0);

    const res = await request(app).get('/api/canvas').set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(50);
    expect(res.body.offset).toBe(0);
  });

  // ─── Canvas Restore edge cases ───

  it('POST /canvas/:id/restore returns 404 for non-existent canvas', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(null);

    const res = await request(app).post(`/api/canvas/nonexistent/restore`).set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
  });

  it('POST /canvas/:id/restore returns restored canvas data', async () => {
    const trashedCanvas = { ...mockCanvas, deletedAt: new Date('2025-01-15T00:00:00Z') };
    const restoredCanvas = { ...mockCanvas, deletedAt: null };

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...trashedCanvas });
    mockPrisma.codingCanvas.update.mockResolvedValue({ ...restoredCanvas });

    const res = await request(app).post(`/api/canvas/${canvasId}/restore`).set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(canvasId);
    expect(res.body.data.deletedAt).toBeNull();
  });

  // ─── Permanent delete edge cases ───

  it('DELETE /canvas/:id/permanent returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-perm';
    const otherDaId = 'da-other-perm';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'otherperm@example.com',
      name: 'Other Perm',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      ...mockCanvas,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/permanent`)
      .set('Authorization', `Bearer ${otherJwt}`);

    expect(res.status).toBe(403);
  });

  it('DELETE /canvas/:id/permanent returns 404 for non-existent canvas', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(null);

    const res = await request(app).delete('/api/canvas/nonexistent/permanent').set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
  });

  // ─── POST /canvas — create canvas edge cases ───

  it('POST /canvas rejects missing name', async () => {
    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ description: 'No name' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /canvas returns 409 on duplicate name', async () => {
    const prismaError = new Error('Unique constraint failed');
    (prismaError as Error & { code?: string }).code = 'P2002';
    mockPrisma.codingCanvas.create.mockRejectedValue(prismaError);

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Duplicate Canvas' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('POST /canvas creates canvas with only name (description optional)', async () => {
    mockPrisma.codingCanvas.create.mockResolvedValue({
      id: 'canvas-no-desc',
      name: 'Minimal Canvas',
      dashboardAccessId,
      userId,
    });

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Minimal Canvas' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Minimal Canvas');
  });

  // ─── Transcript import from canvas ───

  it('POST /canvas/:id/import-from-canvas copies transcripts from source canvas', async () => {
    const sourceCanvasId = 'canvas-source-1';
    mockPrisma.codingCanvas.findUnique
      .mockResolvedValueOnce({ ...mockCanvas }) // getOwnedCanvas
      .mockResolvedValueOnce({ id: sourceCanvasId, dashboardAccessId }); // source canvas lookup

    mockPrisma.canvasTranscript.findMany.mockResolvedValue([
      { id: 'src-t1', canvasId: sourceCanvasId, title: 'Source T1', content: 'Content one.' },
      { id: 'src-t2', canvasId: sourceCanvasId, title: 'Source T2', content: 'Content two.' },
    ]);
    mockPrisma.canvasTranscript.count.mockResolvedValue(1);
    mockPrisma.canvasTranscript.create
      .mockResolvedValueOnce({ id: 'new-t1', canvasId, title: 'Source T1', content: 'Content one.', sortOrder: 1 })
      .mockResolvedValueOnce({ id: 'new-t2', canvasId, title: 'Source T2', content: 'Content two.', sortOrder: 2 });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-from-canvas`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ sourceCanvasId, transcriptIds: ['src-t1', 'src-t2'] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('POST /canvas/:id/import-from-canvas returns 404 for non-existent source canvas', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValueOnce({ ...mockCanvas }).mockResolvedValueOnce(null);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-from-canvas`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ sourceCanvasId: 'nonexistent', transcriptIds: ['t1'] });

    expect(res.status).toBe(404);
  });

  it('POST /canvas/:id/import-from-canvas returns 403 for unowned source canvas', async () => {
    const otherDaId = 'da-other-src';
    mockPrisma.codingCanvas.findUnique
      .mockResolvedValueOnce({ ...mockCanvas })
      .mockResolvedValueOnce({ id: 'canvas-other', dashboardAccessId: otherDaId });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-from-canvas`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ sourceCanvasId: 'canvas-other', transcriptIds: ['t1'] });

    expect(res.status).toBe(403);
  });

  it('POST /canvas/:id/import-from-canvas returns empty array for no matching transcripts', async () => {
    const sourceCanvasId = 'canvas-source-empty';
    mockPrisma.codingCanvas.findUnique
      .mockResolvedValueOnce({ ...mockCanvas })
      .mockResolvedValueOnce({ id: sourceCanvasId, dashboardAccessId });
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-from-canvas`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ sourceCanvasId, transcriptIds: ['nonexistent-t1'] });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('POST /canvas/:id/import-from-canvas validates transcriptIds required', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-from-canvas`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ sourceCanvasId: 'canvas-source' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── Transcript update (PUT) edge cases ───

  it('PUT /canvas/:id/transcripts/:tid assigns caseId to transcript', async () => {
    const transcriptId = 'transcript-case-1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.findUnique.mockResolvedValue({ id: transcriptId, canvasId });
    mockPrisma.canvasTranscript.update.mockResolvedValue({
      id: transcriptId,
      canvasId,
      title: 'Interview',
      content: 'Content',
      caseId: 'case-1',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/transcripts/${transcriptId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ caseId: 'case-1' });

    expect(res.status).toBe(200);
    expect(res.body.data.caseId).toBe('case-1');
  });

  it('PUT /canvas/:id/transcripts/:tid removes caseId with null', async () => {
    const transcriptId = 'transcript-case-2';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.findUnique.mockResolvedValue({ id: transcriptId, canvasId });
    mockPrisma.canvasTranscript.update.mockResolvedValue({
      id: transcriptId,
      canvasId,
      title: 'Interview',
      content: 'Content',
      caseId: null,
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/transcripts/${transcriptId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ caseId: null });

    expect(res.status).toBe(200);
    expect(res.body.data.caseId).toBeNull();
  });
});
