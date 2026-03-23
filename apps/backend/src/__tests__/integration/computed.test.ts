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
      count: vi.fn(),
    },
    canvasQuestion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    canvasTextCoding: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasComputedNode: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    canvasCase: {
      findMany: vi.fn(),
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

describe('Computed node integration tests', () => {
  let app: express.Express;
  const userId = 'user-computed-1';
  const dashboardAccessId = 'da-computed-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'computed@example.com',
    name: 'Computed Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-cp1';
  const mockCanvas = {
    id: canvasId,
    name: 'Computed Test Canvas',
    description: 'A canvas for computed node tests',
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

  // ─── 1. POST /canvas/:id/computed — creates computed node ───
  it('POST /canvas/:id/computed creates a computed node', async () => {
    const nodeId = 'node-cp1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasComputedNode.create.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'stats',
      label: 'My Stats',
      config: '{}',
      result: '{}',
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ nodeType: 'stats', label: 'My Stats' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(nodeId);
    expect(res.body.data.nodeType).toBe('stats');
    expect(res.body.data.label).toBe('My Stats');
  });

  // ─── 2. POST /canvas/:id/computed — validates nodeType enum ───
  it('POST /canvas/:id/computed validates nodeType enum', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ nodeType: 'invalidType', label: 'Bad Node' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 3. POST /canvas/:id/computed/:nodeId/run — executes search analysis ───
  it('POST /canvas/:id/computed/:nodeId/run executes search analysis', async () => {
    const nodeId = 'node-search1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'search',
      config: JSON.stringify({ pattern: 'resilience', mode: 'keyword' }),
      result: '{}',
    });
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([
      { id: 'tr-1', title: 'Transcript 1', content: 'The theme of resilience emerged here.', caseId: null },
    ]);
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([]);
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([]);
    mockPrisma.canvasCase.findMany.mockResolvedValue([]);
    mockPrisma.canvasComputedNode.update.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'search',
      config: JSON.stringify({ pattern: 'resilience', mode: 'keyword' }),
      result: JSON.stringify({ matches: [{ transcriptId: 'tr-1', offset: 13, matchText: 'resilience' }] }),
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.result.matches).toBeDefined();
    expect(res.body.data.result.matches.length).toBeGreaterThanOrEqual(1);
  });

  // ─── 4. POST /canvas/:id/computed/:nodeId/run — executes stats analysis ───
  it('POST /canvas/:id/computed/:nodeId/run executes stats analysis', async () => {
    const nodeId = 'node-stats1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'stats',
      config: JSON.stringify({ groupBy: 'question' }),
      result: '{}',
    });
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([
      { id: 'tr-1', title: 'Transcript 1', content: 'Content here.', caseId: null },
    ]);
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([
      { id: 'q-1', text: 'Theme?', color: '#FF0000', parentQuestionId: null },
    ]);
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([
      { id: 'c-1', transcriptId: 'tr-1', questionId: 'q-1', startOffset: 0, endOffset: 7, codedText: 'Content' },
    ]);
    mockPrisma.canvasCase.findMany.mockResolvedValue([]);

    const statsResult = { groups: [{ label: 'Theme?', count: 1, percentage: 100 }] };
    mockPrisma.canvasComputedNode.update.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'stats',
      config: JSON.stringify({ groupBy: 'question' }),
      result: JSON.stringify(statsResult),
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── 5. POST /canvas/:id/computed/:nodeId/run — executes wordcloud analysis ───
  it('POST /canvas/:id/computed/:nodeId/run executes wordcloud analysis', async () => {
    const nodeId = 'node-wc1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'wordcloud',
      config: JSON.stringify({ maxWords: 50 }),
      result: '{}',
    });
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([
      { id: 'tr-1', title: 'Transcript 1', content: 'Many words here repeated words.', caseId: null },
    ]);
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([]);
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([
      { id: 'c-1', transcriptId: 'tr-1', questionId: 'q-1', startOffset: 0, endOffset: 10, codedText: 'Many words here repeated words' },
    ]);
    mockPrisma.canvasCase.findMany.mockResolvedValue([]);

    mockPrisma.canvasComputedNode.update.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'wordcloud',
      config: JSON.stringify({ maxWords: 50 }),
      result: JSON.stringify({ words: [{ text: 'words', count: 2 }] }),
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── 6. PUT /canvas/:id/computed/:nodeId — updates config ───
  it('PUT /canvas/:id/computed/:nodeId updates config', async () => {
    const nodeId = 'node-cp1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasComputedNode.update.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'stats',
      label: 'Updated Stats',
      config: JSON.stringify({ groupBy: 'transcript' }),
      result: '{}',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/computed/${nodeId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ label: 'Updated Stats', config: { groupBy: 'transcript' } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.label).toBe('Updated Stats');
    expect(res.body.data.config.groupBy).toBe('transcript');
  });

  // ─── 7. DELETE /canvas/:id/computed/:nodeId — deletes node ───
  it('DELETE /canvas/:id/computed/:nodeId deletes a computed node', async () => {
    const nodeId = 'node-cp1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasComputedNode.delete.mockResolvedValue({ id: nodeId });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/computed/${nodeId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── 8. POST /canvas/:id/computed/:nodeId/run — returns 404 for non-existent node ───
  it('POST /canvas/:id/computed/:nodeId/run returns 404 for non-existent node', async () => {
    const nodeId = 'node-nonexistent';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ─── 9. POST /canvas/:id/computed/:nodeId/run — returns 404 for node in wrong canvas ───
  it('POST /canvas/:id/computed/:nodeId/run returns 404 for node in wrong canvas', async () => {
    const nodeId = 'node-wrong-canvas';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId: 'other-canvas-id',
      nodeType: 'stats',
      config: '{}',
      result: '{}',
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ─── 10. All routes validate canvas ownership ───
  it('POST /canvas/:id/computed returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-cp';
    const otherDaId = 'da-other-cp';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'othercp@example.com',
      name: 'Other Computed User',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ nodeType: 'stats', label: 'Unauthorized' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /canvas/:id/computed/:nodeId returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-cp2';
    const otherDaId = 'da-other-cp2';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'othercp2@example.com',
      name: 'Other Computed User 2',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/computed/node-cp1`)
      .set('Authorization', `Bearer ${otherJwt}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── 11. POST /canvas/:id/computed — validates label required ───
  it('POST /canvas/:id/computed validates label is required', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ nodeType: 'stats' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
