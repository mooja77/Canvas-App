import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    canvasTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    codingCanvas: {
      create: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    canvasQuestion: {
      create: vi.fn(),
    },
    canvasTranscript: {
      create: vi.fn(),
    },
    canvasMemo: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/planLimits.js', () => ({
  checkCanvasLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../lib/jms-events.js', () => ({
  trackJmsEvent: vi.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { templateRoutes } from '../../routes/templateRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, templateRoutes);
  app.use(errorHandler);
  return app;
}

describe('Template + onboarding routes', () => {
  let app: express.Express;
  const userId = 'user-tmpl-1';
  const dashboardAccessId = 'da-tmpl-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'tmpl@example.com',
    name: 'Template Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: 'x',
    dashboardAccess: { id: dashboardAccessId },
    onboardingState: '{}',
    onboardingCompletedAt: null,
  };

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
    // Default no-op transaction wrapper that just runs the callback against
    // the mock tx (which is the same object as prisma here).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
  });

  it('GET /canvas/templates returns public + user templates', async () => {
    mockPrisma.canvasTemplate.findMany.mockResolvedValue([
      {
        id: 't1',
        name: 'Braun & Clarke',
        description: null,
        category: 'methodology',
        method: 'interviews',
        sampleQuestions: JSON.stringify([{ text: 'Pain', color: '#EF4444' }]),
        sampleTranscript: 'Interviewer: Hello',
        sampleMemos: null,
        isPublic: true,
        createdBy: null,
      },
    ]);

    const res = await request(app).get('/api/canvas/templates').set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sampleQuestions).toEqual([{ text: 'Pain', color: '#EF4444' }]);
  });

  it('POST /canvas/templates/:id/instantiate creates a canvas + seeds codes/transcripts', async () => {
    const templateId = 'tmpl-1';
    const newCanvasId = 'canvas-from-tmpl';
    mockPrisma.canvasTemplate.findUnique.mockResolvedValue({
      id: templateId,
      name: 'UXR Pain-Points',
      description: 'UXR',
      category: 'ux',
      method: 'interviews',
      sampleQuestions: JSON.stringify([
        { text: 'Pain', color: '#EF4444' },
        { text: 'Goal', color: '#10B981' },
      ]),
      sampleTranscript: 'sample',
      sampleMemos: null,
      isPublic: true,
      createdBy: null,
    });
    mockPrisma.codingCanvas.create.mockResolvedValue({ id: newCanvasId, name: 'UXR Pain-Points' });
    mockPrisma.codingCanvas.count.mockResolvedValue(1);

    const res = await request(app)
      .post(`/api/canvas/templates/${templateId}/instantiate`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ includeSampleData: true });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(newCanvasId);
    expect(mockPrisma.canvasQuestion.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.canvasTranscript.create).toHaveBeenCalledTimes(1);
  });

  it('POST /canvas/templates/:id/instantiate skips sample transcript when includeSampleData=false', async () => {
    const templateId = 'tmpl-blank-sample';
    mockPrisma.canvasTemplate.findUnique.mockResolvedValue({
      id: templateId,
      name: 'Grounded Theory',
      description: null,
      category: 'methodology',
      method: 'interviews',
      sampleQuestions: JSON.stringify([{ text: 'Open code', color: '#3B82F6' }]),
      sampleTranscript: 'sample',
      sampleMemos: JSON.stringify([{ title: 'memo', content: 'note' }]),
      isPublic: true,
      createdBy: null,
    });
    mockPrisma.codingCanvas.create.mockResolvedValue({ id: 'c2', name: 'Grounded Theory' });
    mockPrisma.codingCanvas.count.mockResolvedValue(1);

    const res = await request(app)
      .post(`/api/canvas/templates/${templateId}/instantiate`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ includeSampleData: false });

    expect(res.status).toBe(201);
    expect(mockPrisma.canvasQuestion.create).toHaveBeenCalledTimes(1);
    // includeSampleData=false ⇒ no transcript + no memos
    expect(mockPrisma.canvasTranscript.create).not.toHaveBeenCalled();
    expect(mockPrisma.canvasMemo.create).not.toHaveBeenCalled();
  });

  it('POST /canvas/templates/:id/instantiate 404s for unknown template', async () => {
    mockPrisma.canvasTemplate.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/canvas/templates/nope/instantiate')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('POST /canvas/templates/:id/instantiate 403s when template is private and not owned', async () => {
    mockPrisma.canvasTemplate.findUnique.mockResolvedValue({
      id: 'priv',
      name: 'Private',
      description: null,
      category: 'methodology',
      method: 'interviews',
      sampleQuestions: '[]',
      sampleTranscript: '',
      sampleMemos: null,
      isPublic: false,
      createdBy: 'someone-else',
    });
    const res = await request(app)
      .post('/api/canvas/templates/priv/instantiate')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('GET /user/onboarding returns parsed state for email users', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      onboardingState: JSON.stringify({ currentStep: 2 }),
      onboardingCompletedAt: null,
    });

    const res = await request(app).get('/api/user/onboarding').set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.data.state).toEqual({ currentStep: 2 });
    expect(res.body.data.legacy).toBe(false);
  });

  it('PATCH /user/onboarding merges state shallowly', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser })
      .mockResolvedValueOnce({ ...mockUser, onboardingState: JSON.stringify({ currentStep: 1 }) });
    mockPrisma.user.update.mockResolvedValue({ ...mockUser });

    const res = await request(app)
      .patch('/api/user/onboarding')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ state: { currentStep: 2 } });

    expect(res.status).toBe(200);
    expect(res.body.data.state.currentStep).toBe(2);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { onboardingState: expect.stringContaining('"currentStep":2') },
    });
  });

  it('POST /user/onboarding/complete sets onboardingCompletedAt once', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser })
      .mockResolvedValueOnce({ ...mockUser, onboardingCompletedAt: null });
    mockPrisma.user.update.mockResolvedValue({ ...mockUser, onboardingCompletedAt: new Date() });

    const res = await request(app).post('/api/user/onboarding/complete').set('Authorization', `Bearer ${jwt}`).send({});

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
  });
});
