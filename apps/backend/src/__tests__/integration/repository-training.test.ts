import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    codingCanvas: {
      findUnique: vi.fn(),
    },
    researchRepository: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    repositoryInsight: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    canvasTranscript: {
      findUnique: vi.fn(),
    },
    trainingDocument: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    trainingAttempt: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
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

// Plan limits — pass through by default; one test will override
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
  checkRepositoryAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkIntegrationsAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkFileUploadAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkExportFormat: () => (_req: Request, _res: Response, next: NextFunction) => next(),
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

// Mock intercoder kappa computation
vi.mock('../../utils/intercoder.js', () => ({
  computeKappa: vi.fn().mockReturnValue(0.85),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { repositoryRoutes } from '../../routes/repositoryRoutes.js';
import { trainingRoutes } from '../../routes/trainingRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, repositoryRoutes);
  app.use('/api', auth, trainingRoutes);
  app.use(errorHandler);
  return app;
}

describe('Repository and Training integration tests', () => {
  let app: express.Express;
  const userId = 'user-repo-1';
  const dashboardAccessId = 'da-repo-1';
  const canvasId = 'canvas-repo-1';
  const repoId = 'repo-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'researcher@example.com',
    name: 'Researcher',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const mockCanvas = {
    id: canvasId,
    name: 'Test Canvas',
    dashboardAccessId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    jwt = signUserToken(userId, 'researcher', 'pro');
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
  });

  // ═══════════════════════════════════════
  // Repository Routes
  // ═══════════════════════════════════════

  // ─── 1. GET /repositories lists user repositories ───
  it('GET /api/repositories lists user repositories', async () => {
    mockPrisma.researchRepository.findMany.mockResolvedValue([
      { id: repoId, userId, name: 'My Repo', _count: { insights: 3 } },
    ]);

    const res = await request(app)
      .get('/api/repositories')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.repositories).toHaveLength(1);
    expect(res.body.repositories[0].name).toBe('My Repo');
  });

  // ─── 2. POST /repositories creates repository ───
  it('POST /api/repositories creates a repository', async () => {
    mockPrisma.researchRepository.create.mockResolvedValue({
      id: repoId,
      userId,
      name: 'New Repo',
      description: 'A research repository',
    });

    const res = await request(app)
      .post('/api/repositories')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'New Repo', description: 'A research repository' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.repository.name).toBe('New Repo');
  });

  // ─── 3. POST /repositories rejects empty name ───
  it('POST /api/repositories rejects empty name', async () => {
    const res = await request(app)
      .post('/api/repositories')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });

  // ─── 4. POST /repositories rejects missing name ───
  it('POST /api/repositories rejects missing name', async () => {
    const res = await request(app)
      .post('/api/repositories')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ description: 'no name provided' });

    expect(res.status).toBe(400);
  });

  // ─── 5. DELETE /repositories/:id deletes repository ───
  it('DELETE /api/repositories/:id deletes a repository', async () => {
    mockPrisma.researchRepository.findUnique.mockResolvedValue({
      id: repoId,
      userId,
      name: 'My Repo',
    });
    mockPrisma.researchRepository.delete.mockResolvedValue({ id: repoId });

    const res = await request(app)
      .delete(`/api/repositories/${repoId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPrisma.researchRepository.delete).toHaveBeenCalledWith({ where: { id: repoId } });
  });

  // ─── 6. DELETE /repositories/:id non-owner returns 403 ───
  it('DELETE /api/repositories/:id non-owner returns 403', async () => {
    const otherUserId = 'user-other-repo';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');
    const otherUser = {
      id: otherUserId,
      email: 'other@example.com',
      name: 'Other User',
      role: 'researcher',
      plan: 'pro',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: 'da-other-repo' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(otherUser);

    mockPrisma.researchRepository.findUnique.mockResolvedValue({
      id: repoId,
      userId, // belongs to original user
      name: 'My Repo',
    });

    const res = await request(app)
      .delete(`/api/repositories/${repoId}`)
      .set('Authorization', `Bearer ${otherJwt}`);

    expect(res.status).toBe(403);
    expect(mockPrisma.researchRepository.delete).not.toHaveBeenCalled();
  });

  // ─── 7. POST /repositories/:id/insights creates insight ───
  it('POST /api/repositories/:id/insights creates insight with tags', async () => {
    mockPrisma.researchRepository.findUnique.mockResolvedValue({
      id: repoId,
      userId,
      name: 'My Repo',
    });
    mockPrisma.repositoryInsight.create.mockResolvedValue({
      id: 'insight-1',
      repositoryId: repoId,
      title: 'Key Finding',
      content: 'Participants reported...',
      tags: JSON.stringify(['theme1', 'theme2']),
    });

    const res = await request(app)
      .post(`/api/repositories/${repoId}/insights`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ title: 'Key Finding', content: 'Participants reported...', tags: ['theme1', 'theme2'] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.insight.title).toBe('Key Finding');
  });

  // ─── 8. GET /repositories/:id/insights lists insights ───
  it('GET /api/repositories/:id/insights lists insights', async () => {
    mockPrisma.researchRepository.findUnique.mockResolvedValue({
      id: repoId,
      userId,
      name: 'My Repo',
    });
    mockPrisma.repositoryInsight.findMany.mockResolvedValue([
      { id: 'insight-1', repositoryId: repoId, title: 'Finding 1', content: 'text' },
      { id: 'insight-2', repositoryId: repoId, title: 'Finding 2', content: 'text' },
    ]);

    const res = await request(app)
      .get(`/api/repositories/${repoId}/insights`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.insights).toHaveLength(2);
  });

  // ─── 9. DELETE /repositories/:repoId/insights/:insightId removes insight ───
  it('DELETE /api/repositories/:repoId/insights/:insightId removes insight', async () => {
    const insightId = 'insight-1';
    mockPrisma.researchRepository.findUnique.mockResolvedValue({
      id: repoId,
      userId,
      name: 'My Repo',
    });
    mockPrisma.repositoryInsight.findUnique.mockResolvedValue({
      id: insightId,
      repositoryId: repoId,
    });
    mockPrisma.repositoryInsight.delete.mockResolvedValue({ id: insightId });

    const res = await request(app)
      .delete(`/api/repositories/${repoId}/insights/${insightId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ═══════════════════════════════════════
  // Training Routes
  // ═══════════════════════════════════════

  // ─── 10. POST /canvas/:id/training creates training document ───
  it('POST /api/canvas/:id/training creates training document', async () => {
    const transcriptId = 'transcript-1';
    mockPrisma.canvasTranscript.findUnique.mockResolvedValue({
      id: transcriptId,
      canvasId,
      content: 'Some transcript text',
    });

    const goldCodings = [
      { startOffset: 0, endOffset: 10, questionId: 'q1' },
      { startOffset: 15, endOffset: 25, questionId: 'q2' },
    ];

    mockPrisma.trainingDocument.create.mockResolvedValue({
      id: 'tdoc-1',
      canvasId,
      transcriptId,
      name: 'Training Set 1',
      instructions: 'Code the themes',
      goldCodings: JSON.stringify(goldCodings),
      passThreshold: 0.7,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/training`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ transcriptId, name: 'Training Set 1', instructions: 'Code the themes', goldCodings, passThreshold: 0.7 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Training Set 1');
    expect(res.body.data.goldCodings).toHaveLength(2);
  });

  // ─── 11. POST /canvas/:id/training rejects missing fields ───
  it('POST /api/canvas/:id/training rejects missing name', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/training`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ transcriptId: 'transcript-1', goldCodings: [{ startOffset: 0, endOffset: 10 }] });

    expect(res.status).toBe(400);
  });

  // ─── 12. POST /canvas/:id/training/:docId/attempt records attempt with kappa score ───
  it('POST /api/canvas/:id/training/:docId/attempt records attempt', async () => {
    const docId = 'tdoc-1';
    const transcriptId = 'transcript-1';
    const goldCodings = [{ startOffset: 0, endOffset: 10, questionId: 'q1' }];

    mockPrisma.trainingDocument.findUnique.mockResolvedValue({
      id: docId,
      canvasId,
      transcriptId,
      goldCodings: JSON.stringify(goldCodings),
      passThreshold: 0.7,
    });

    mockPrisma.canvasTranscript.findUnique.mockResolvedValue({
      id: transcriptId,
      canvasId,
      content: 'Some transcript text here for testing.',
    });

    mockPrisma.trainingAttempt.create.mockResolvedValue({
      id: 'attempt-1',
      trainingDocumentId: docId,
      userId,
      codings: JSON.stringify([{ startOffset: 0, endOffset: 10, questionId: 'q1' }]),
      kappaScore: 0.85,
      passed: true,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/training/${docId}/attempt`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ codings: [{ startOffset: 0, endOffset: 10, questionId: 'q1' }] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.kappaScore).toBe(0.85);
    expect(res.body.data.passed).toBe(true);
  });

  // ─── 13. GET /canvas/:id/training lists training documents ───
  it('GET /api/canvas/:id/training lists training documents', async () => {
    mockPrisma.trainingDocument.findMany.mockResolvedValue([
      {
        id: 'tdoc-1',
        canvasId,
        name: 'Training Set 1',
        goldCodings: JSON.stringify([]),
        _count: { attempts: 3 },
      },
      {
        id: 'tdoc-2',
        canvasId,
        name: 'Training Set 2',
        goldCodings: JSON.stringify([]),
        _count: { attempts: 0 },
      },
    ]);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/training`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  // ─── 14. POST /canvas/:id/training/:docId/attempt rejects non-array codings ───
  it('POST /api/canvas/:id/training/:docId/attempt rejects non-array codings', async () => {
    const docId = 'tdoc-1';
    mockPrisma.trainingDocument.findUnique.mockResolvedValue({
      id: docId,
      canvasId,
      transcriptId: 'transcript-1',
      goldCodings: JSON.stringify([]),
      passThreshold: 0.7,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/training/${docId}/attempt`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ codings: 'not-an-array' });

    expect(res.status).toBe(400);
  });

  // ─── 15. Training doc for transcript not in canvas returns 400 ───
  it('POST /api/canvas/:id/training rejects transcript not in canvas', async () => {
    mockPrisma.canvasTranscript.findUnique.mockResolvedValue({
      id: 'transcript-other',
      canvasId: 'other-canvas', // different canvas
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/training`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        transcriptId: 'transcript-other',
        name: 'Bad Training',
        goldCodings: [{ startOffset: 0, endOffset: 10 }],
      });

    expect(res.status).toBe(400);
  });
});
