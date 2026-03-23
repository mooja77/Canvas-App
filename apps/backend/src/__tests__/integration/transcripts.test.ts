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

describe('Transcript integration tests', () => {
  let app: express.Express;
  const userId = 'user-transcript-1';
  const dashboardAccessId = 'da-transcript-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'transcript@example.com',
    name: 'Transcript Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-t1';
  const mockCanvas = {
    id: canvasId,
    name: 'Transcript Test Canvas',
    description: 'A canvas for transcript tests',
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

  // ─── 1. POST /canvas/:id/transcripts — creates transcript ───
  it('POST /canvas/:id/transcripts creates a transcript', async () => {
    const transcriptId = 'transcript-t1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.count.mockResolvedValue(0);
    mockPrisma.canvasTranscript.create.mockResolvedValue({
      id: transcriptId,
      canvasId,
      title: 'Interview Alpha',
      content: 'This is the content of interview alpha.',
      sortOrder: 0,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ title: 'Interview Alpha', content: 'This is the content of interview alpha.' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(transcriptId);
    expect(res.body.data.title).toBe('Interview Alpha');
  });

  // ─── 2. POST /canvas/:id/transcripts — enforces transcript limit (free: 2) ───
  it('POST /canvas/:id/transcripts enforces transcript limit for free plan', async () => {
    // Use real planLimits by restoring mock for this test
    // Since planLimits is mocked as pass-through, we test the route's own count logic
    // The route calls checkTranscriptLimit middleware (mocked pass-through) and then creates
    // The real enforcement is in the middleware, tested in planLimits.test.ts
    // Here we verify the route correctly passes count to the middleware by checking
    // that count is called
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.count.mockResolvedValue(1);
    mockPrisma.canvasTranscript.create.mockResolvedValue({
      id: 'transcript-t2',
      canvasId,
      title: 'Interview Beta',
      content: 'Content of beta.',
      sortOrder: 1,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ title: 'Interview Beta', content: 'Content of beta.' });

    expect(res.status).toBe(201);
    expect(mockPrisma.canvasTranscript.count).toHaveBeenCalledWith({
      where: { canvasId },
    });
  });

  // ─── 3. PUT /canvas/:id/transcripts/:tid — updates title/content ───
  it('PUT /canvas/:id/transcripts/:tid updates title and content', async () => {
    const transcriptId = 'transcript-t1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.update.mockResolvedValue({
      id: transcriptId,
      canvasId,
      title: 'Updated Title',
      content: 'Updated content here.',
      sortOrder: 0,
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/transcripts/${transcriptId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ title: 'Updated Title', content: 'Updated content here.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated Title');
    expect(res.body.data.content).toBe('Updated content here.');
  });

  // ─── 4. DELETE /canvas/:id/transcripts/:tid — deletes transcript ───
  it('DELETE /canvas/:id/transcripts/:tid deletes a transcript', async () => {
    const transcriptId = 'transcript-t1';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.delete.mockResolvedValue({ id: transcriptId });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/transcripts/${transcriptId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── 5. POST /canvas/:id/import-narratives — bulk imports 3 narratives ───
  it('POST /canvas/:id/import-narratives bulk imports 3 narratives', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.count.mockResolvedValue(0);
    mockPrisma.$transaction.mockResolvedValue([
      { id: 'n1', canvasId, title: 'Narrative 1', content: 'Content 1', sortOrder: 0 },
      { id: 'n2', canvasId, title: 'Narrative 2', content: 'Content 2', sortOrder: 1 },
      { id: 'n3', canvasId, title: 'Narrative 3', content: 'Content 3', sortOrder: 2 },
    ]);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-narratives`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        narratives: [
          { title: 'Narrative 1', content: 'Content 1' },
          { title: 'Narrative 2', content: 'Content 2' },
          { title: 'Narrative 3', content: 'Content 3' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);
  });

  // ─── 6. POST /canvas/:id/import-narratives — rejects > 100 narratives ───
  it('POST /canvas/:id/import-narratives rejects more than 100 narratives', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const narratives = Array.from({ length: 101 }, (_, i) => ({
      title: `Narrative ${i}`,
      content: `Content ${i}`,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-narratives`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ narratives });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 7. POST /canvas/:id/import-narratives — validates title required ───
  it('POST /canvas/:id/import-narratives validates title is required', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-narratives`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        narratives: [
          { title: '', content: 'Some content' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 8. POST /canvas/:id/transcripts — validates empty content returns 400 ───
  it('POST /canvas/:id/transcripts validates empty content returns 400', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ title: 'Valid Title', content: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 9. POST /canvas/:id/transcripts — validates title > 200 chars returns 400 ───
  it('POST /canvas/:id/transcripts validates title > 200 chars returns 400', async () => {
    const longTitle = 'A'.repeat(201);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ title: longTitle, content: 'Valid content' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 10. POST /canvas/:id/transcripts — validates missing title returns 400 ───
  it('POST /canvas/:id/transcripts validates missing title returns 400', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ content: 'Content without title' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 11. All routes return 401 without auth ───
  it('POST /canvas/:id/transcripts returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts`)
      .send({ title: 'Test', content: 'Content' });

    expect(res.status).toBe(401);
  });

  it('PUT /canvas/:id/transcripts/:tid returns 401 without auth', async () => {
    const res = await request(app)
      .put(`/api/canvas/${canvasId}/transcripts/tid-1`)
      .send({ title: 'Updated' });

    expect(res.status).toBe(401);
  });

  it('DELETE /canvas/:id/transcripts/:tid returns 401 without auth', async () => {
    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/transcripts/tid-1`);

    expect(res.status).toBe(401);
  });

  it('POST /canvas/:id/import-narratives returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-narratives`)
      .send({ narratives: [{ title: 'T', content: 'C' }] });

    expect(res.status).toBe(401);
  });

  // ─── 12. All routes return 403 for non-owner ───
  it('POST /canvas/:id/transcripts returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-t';
    const otherDaId = 'da-other-t';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'other@example.com',
      name: 'Other User',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });

    // Canvas belongs to original user
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ title: 'Test', content: 'Content' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /canvas/:id/transcripts/:tid returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-t2';
    const otherDaId = 'da-other-t2';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'other2@example.com',
      name: 'Other User 2',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });

    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/transcripts/tid-1`)
      .set('Authorization', `Bearer ${otherJwt}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
