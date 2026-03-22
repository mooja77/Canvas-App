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

describe('Canvas lifecycle integration tests', () => {
  let app: express.Express;
  const userId = 'user-lifecycle-1';
  const dashboardAccessId = 'da-lifecycle-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'lifecycle@example.com',
    name: 'Lifecycle Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-1';
  const mockCanvas = {
    id: canvasId,
    name: 'Test Canvas',
    description: 'A test canvas',
    dashboardAccessId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    // Default: auth middleware finds the user
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
  });

  // ─── POST /canvas — create canvas ───
  it('POST /canvas creates a canvas and returns id', async () => {
    mockPrisma.codingCanvas.create.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Test Canvas', description: 'A test canvas' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(canvasId);
    expect(res.body.data.name).toBe('Test Canvas');
  });

  // ─── GET /canvas — list canvases ───
  it('GET /canvas lists canvases including the created one', async () => {
    mockPrisma.codingCanvas.findMany.mockResolvedValue([{ ...mockCanvas, _count: { transcripts: 0, questions: 0, codings: 0 } }]);
    mockPrisma.codingCanvas.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(canvasId);
  });

  // ─── GET /canvas/:canvasId — full detail ───
  it('GET /canvas/:canvasId returns full canvas detail', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      ...mockCanvas,
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
      .get(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(canvasId);
  });

  // ─── POST /canvas/:id/transcripts — add transcript ───
  it('POST /canvas/:id/transcripts adds a transcript', async () => {
    const transcriptId = 'transcript-1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.count.mockResolvedValue(0);
    mockPrisma.canvasTranscript.create.mockResolvedValue({
      id: transcriptId,
      canvasId,
      title: 'Interview 1',
      content: 'Some interview content here.',
      sortOrder: 0,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ title: 'Interview 1', content: 'Some interview content here.' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(transcriptId);
  });

  // ─── POST /canvas/:id/questions — add question/code ───
  it('POST /canvas/:id/questions adds a question', async () => {
    const questionId = 'question-1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasQuestion.count.mockResolvedValue(0);
    mockPrisma.canvasQuestion.create.mockResolvedValue({
      id: questionId,
      canvasId,
      text: 'What themes emerge?',
      sortOrder: 0,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/questions`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ text: 'What themes emerge?' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(questionId);
  });

  // ─── POST /canvas/:id/codings — create text coding ───
  it('POST /canvas/:id/codings creates a text coding', async () => {
    const codingId = 'coding-1';
    const transcriptId = 'transcript-1';
    const questionId = 'question-1';

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.findUnique.mockResolvedValue({
      id: transcriptId,
      canvasId,
    });
    mockPrisma.canvasQuestion.findUnique.mockResolvedValue({
      id: questionId,
      canvasId,
    });
    mockPrisma.canvasTextCoding.create.mockResolvedValue({
      id: codingId,
      canvasId,
      transcriptId,
      questionId,
      startOffset: 0,
      endOffset: 10,
      codedText: 'Some inter',
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/codings`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        transcriptId,
        questionId,
        startOffset: 0,
        endOffset: 10,
        codedText: 'Some inter',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(codingId);
  });

  // ─── GET /canvas/:canvasId — verify data in response ───
  it('GET /canvas/:canvasId includes transcript, question, and coding', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      ...mockCanvas,
      transcripts: [{ id: 'transcript-1', title: 'Interview 1', content: 'content', canvasId }],
      questions: [{ id: 'question-1', text: 'What themes emerge?', canvasId }],
      codings: [{ id: 'coding-1', transcriptId: 'transcript-1', questionId: 'question-1', canvasId }],
      memos: [],
      nodePositions: [],
      cases: [],
      relations: [],
      computedNodes: [],
    });

    const res = await request(app)
      .get(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data.transcripts).toHaveLength(1);
    expect(res.body.data.questions).toHaveLength(1);
    expect(res.body.data.codings).toHaveLength(1);
  });

  // ─── PUT /canvas/:id/layout — save node positions ───
  it('PUT /canvas/:id/layout saves node positions', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.$transaction.mockResolvedValue([{}]);

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/layout`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        positions: [
          { nodeId: 'transcript-1', nodeType: 'transcript', x: 100, y: 200 },
          { nodeId: 'question-1', nodeType: 'question', x: 300, y: 400 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── PUT /canvas/:canvasId — update canvas ───
  it('PUT /canvas/:canvasId updates canvas name', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.codingCanvas.update.mockResolvedValue({ ...mockCanvas, name: 'Updated Canvas' });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Updated Canvas' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Canvas');
  });

  // ─── DELETE /canvas/:id/codings/:cid — delete coding ───
  it('DELETE /canvas/:id/codings/:cid deletes a coding', async () => {
    const codingId = 'coding-1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTextCoding.findUnique.mockResolvedValue({ id: codingId, canvasId });
    mockPrisma.canvasTextCoding.delete.mockResolvedValue({ id: codingId });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/codings/${codingId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── DELETE /canvas/:canvasId — delete canvas ───
  it('DELETE /canvas/:canvasId deletes the canvas', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.codingCanvas.delete.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── GET /canvas/:canvasId after delete — 404 ───
  it('GET /canvas/:canvasId after delete returns 404', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ─── GET /canvas/:canvasId with wrong user — 403 ───
  it('GET /canvas/:canvasId with wrong user returns 403', async () => {
    const otherUserId = 'user-other';
    const otherDaId = 'da-other';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    const otherUser = {
      id: otherUserId,
      email: 'other@example.com',
      name: 'Other User',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    };

    // Auth middleware resolves the other user
    mockPrisma.user.findUnique.mockResolvedValue(otherUser);

    // Canvas belongs to original user, not the other user
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      ...mockCanvas,
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
      .get(`/api/canvas/${canvasId}`)
      .set('Authorization', `Bearer ${otherJwt}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── POST /canvas/:id/codings with invalid transcript ───
  it('POST /canvas/:id/codings rejects transcript not in canvas', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.findUnique.mockResolvedValue({
      id: 'transcript-other',
      canvasId: 'other-canvas',
    });
    mockPrisma.canvasQuestion.findUnique.mockResolvedValue({
      id: 'question-1',
      canvasId,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/codings`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        transcriptId: 'transcript-other',
        questionId: 'question-1',
        startOffset: 0,
        endOffset: 10,
        codedText: 'text',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/transcript not found/i);
  });

  // ─── POST /canvas/:id/codings with invalid question ───
  it('POST /canvas/:id/codings rejects question not in canvas', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.findUnique.mockResolvedValue({
      id: 'transcript-1',
      canvasId,
    });
    mockPrisma.canvasQuestion.findUnique.mockResolvedValue({
      id: 'question-other',
      canvasId: 'other-canvas',
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/codings`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        transcriptId: 'transcript-1',
        questionId: 'question-other',
        startOffset: 0,
        endOffset: 10,
        codedText: 'text',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/question not found/i);
  });
});
