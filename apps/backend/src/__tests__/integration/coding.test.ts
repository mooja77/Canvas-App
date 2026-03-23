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
    canvasShare: { count: vi.fn() },
    canvasCase: { findMany: vi.fn() },
    canvasComputedNode: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

describe('Coding integration tests', () => {
  let app: express.Express;
  const userId = 'user-coding-1';
  const dashboardAccessId = 'da-coding-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'coding@example.com',
    name: 'Coding Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-c1';
  const mockCanvas = {
    id: canvasId,
    name: 'Coding Test Canvas',
    description: 'A canvas for coding tests',
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

  // ─── 1. POST /canvas/:id/questions — creates question ───
  it('POST /canvas/:id/questions creates a question', async () => {
    const questionId = 'question-c1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasQuestion.count.mockResolvedValue(0);
    mockPrisma.canvasQuestion.create.mockResolvedValue({
      id: questionId,
      canvasId,
      text: 'What patterns emerge?',
      sortOrder: 0,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/questions`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ text: 'What patterns emerge?' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(questionId);
    expect(res.body.data.text).toBe('What patterns emerge?');
  });

  // ─── 2. POST /canvas/:id/questions — validates text required ───
  it('POST /canvas/:id/questions validates text is required', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/questions`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 3. PUT /canvas/:id/questions/:qid — updates text/color ───
  it('PUT /canvas/:id/questions/:qid updates text and color', async () => {
    const questionId = 'question-c1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasQuestion.update.mockResolvedValue({
      id: questionId,
      canvasId,
      text: 'Updated question?',
      color: '#FF0000',
      sortOrder: 0,
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/questions/${questionId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ text: 'Updated question?', color: '#FF0000' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.text).toBe('Updated question?');
    expect(res.body.data.color).toBe('#FF0000');
  });

  // ─── 4. DELETE /canvas/:id/questions/:qid — deletes question ───
  it('DELETE /canvas/:id/questions/:qid deletes a question', async () => {
    const questionId = 'question-c1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasQuestion.delete.mockResolvedValue({ id: questionId });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/questions/${questionId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── 5. POST /canvas/:id/codings — creates text coding ───
  it('POST /canvas/:id/codings creates a text coding', async () => {
    const codingId = 'coding-c1';
    const transcriptId = 'transcript-c1';
    const questionId = 'question-c1';

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
      endOffset: 15,
      codedText: 'patterns emerge',
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/codings`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        transcriptId,
        questionId,
        startOffset: 0,
        endOffset: 15,
        codedText: 'patterns emerge',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(codingId);
    expect(res.body.data.codedText).toBe('patterns emerge');
  });

  // ─── 6. POST /canvas/:id/codings — validates startOffset < endOffset ───
  it('POST /canvas/:id/codings validates endOffset must be >= 1', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/codings`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        transcriptId: 'transcript-c1',
        questionId: 'question-c1',
        startOffset: 10,
        endOffset: 0,
        codedText: 'text',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 7. DELETE /canvas/:id/codings/:cid — deletes coding ───
  it('DELETE /canvas/:id/codings/:cid deletes a coding', async () => {
    const codingId = 'coding-c1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTextCoding.findUnique.mockResolvedValue({
      id: codingId,
      canvasId,
      codedText: 'text',
      questionId: 'q1',
    });
    mockPrisma.canvasTextCoding.delete.mockResolvedValue({ id: codingId });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/codings/${codingId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── 8. PUT /canvas/:id/codings/:cid/reassign — reassigns coding ───
  it('PUT /canvas/:id/codings/:cid/reassign reassigns coding to new question', async () => {
    const codingId = 'coding-c1';
    const newQuestionId = 'question-c2';

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasQuestion.findUnique.mockResolvedValue({
      id: newQuestionId,
      canvasId,
    });
    mockPrisma.canvasTextCoding.findUnique.mockResolvedValue({
      id: codingId,
      canvasId,
      questionId: 'question-c1',
    });
    mockPrisma.canvasTextCoding.update.mockResolvedValue({
      id: codingId,
      canvasId,
      questionId: newQuestionId,
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/codings/${codingId}/reassign`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ newQuestionId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.questionId).toBe(newQuestionId);
  });

  // ─── 9. POST /canvas/:id/memos — creates memo ───
  it('POST /canvas/:id/memos creates a memo', async () => {
    const memoId = 'memo-c1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasMemo.create.mockResolvedValue({
      id: memoId,
      canvasId,
      title: 'Analysis Note',
      content: 'This is an analytical memo.',
      color: '#00FF00',
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/memos`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ content: 'This is an analytical memo.', title: 'Analysis Note', color: '#00FF00' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(memoId);
    expect(res.body.data.content).toBe('This is an analytical memo.');
  });

  // ─── 10. PUT /canvas/:id/memos/:mid — updates memo ───
  it('PUT /canvas/:id/memos/:mid updates a memo', async () => {
    const memoId = 'memo-c1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasMemo.update.mockResolvedValue({
      id: memoId,
      canvasId,
      title: 'Updated Note',
      content: 'Updated memo content.',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/memos/${memoId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ title: 'Updated Note', content: 'Updated memo content.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated Note');
  });

  // ─── 11. DELETE /canvas/:id/memos/:mid — deletes memo ───
  it('DELETE /canvas/:id/memos/:mid deletes a memo', async () => {
    const memoId = 'memo-c1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasMemo.delete.mockResolvedValue({ id: memoId });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/memos/${memoId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── 12. POST /canvas/:id/questions/merge — merges two questions ───
  it('POST /canvas/:id/questions/merge merges two questions', async () => {
    const sourceId = 'question-src';
    const targetId = 'question-tgt';

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasQuestion.findUnique
      .mockResolvedValueOnce({ id: sourceId, canvasId, text: 'Source Q' })
      .mockResolvedValueOnce({ id: targetId, canvasId, text: 'Target Q' });
    mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);
    mockPrisma.canvasTextCoding.count.mockResolvedValue(5);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/questions/merge`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ sourceId, targetId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.targetId).toBe(targetId);
    expect(res.body.data.codingCount).toBe(5);
  });

  // ─── 13. POST /canvas/:id/auto-code — auto-codes with keyword pattern ───
  it('POST /canvas/:id/auto-code auto-codes with keyword pattern', async () => {
    const questionId = 'question-ac';

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasQuestion.findUnique.mockResolvedValue({
      id: questionId,
      canvasId,
      text: 'Auto-code question',
    });
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([
      { id: 'tr-1', title: 'Transcript 1', content: 'The theme of resilience emerged in the data. Resilience was a key finding.' },
    ]);
    mockPrisma.$transaction.mockResolvedValue([
      { id: 'ac-1', canvasId, transcriptId: 'tr-1', questionId, startOffset: 13, endOffset: 23, codedText: 'resilience' },
      { id: 'ac-2', canvasId, transcriptId: 'tr-1', questionId, startOffset: 44, endOffset: 54, codedText: 'Resilience' },
    ]);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/auto-code`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ questionId, pattern: 'resilience', mode: 'keyword' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.codings).toHaveLength(2);
  });

  // ─── 14. POST /canvas/:id/auto-code — validates pattern required ───
  it('POST /canvas/:id/auto-code validates pattern is required', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/auto-code`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ questionId: 'q1', mode: 'keyword' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 15. All routes return 403 for non-owner ───
  it('POST /canvas/:id/questions returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-c';
    const otherDaId = 'da-other-c';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'otherc@example.com',
      name: 'Other Coder',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/questions`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ text: 'Unauthorized question?' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('POST /canvas/:id/memos returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-c2';
    const otherDaId = 'da-other-c2';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'otherc2@example.com',
      name: 'Other Coder 2',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/memos`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ content: 'Unauthorized memo' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
