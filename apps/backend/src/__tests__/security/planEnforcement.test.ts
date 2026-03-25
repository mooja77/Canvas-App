import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    dashboardAccess: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    codingCanvas: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    canvasTranscript: {
      count: vi.fn(),
    },
    canvasQuestion: {
      count: vi.fn(),
    },
    canvasShare: {
      count: vi.fn(),
    },
    canvasComputedNode: {
      findUnique: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import {
  checkCanvasLimit,
  checkTranscriptLimit,
  checkCodeLimit,
  checkShareLimit,
  checkAutoCode,
  checkEthicsAccess,
  checkAnalysisType,
  checkAnalysisTypeOnRun,
} from '../../middleware/planLimits.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken, signResearcherToken } from '../../utils/jwt.js';

/** Build a minimal Express app with auth + a specific plan-limit middleware */
function createApp(
  method: 'post' | 'get',
  path: string,
  ...middlewares: ((req: Request, res: Response, next: NextFunction) => void)[]
) {
  const app = express();
  app.use(express.json());
  app[method](
    path,
    auth,
    ...middlewares,
    (_req: Request, res: Response) => {
      res.status(201).json({ success: true });
    },
  );
  app.use(errorHandler);
  return app;
}

function mockUser(id: string, plan: string) {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    role: 'researcher',
    plan,
    dashboardAccess: null,
  };
}

describe('Plan enforcement — comprehensive limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── FREE PLAN: Canvas limit (max 1) ───

  it('Free plan user cannot create a 2nd canvas (limit: 1)', async () => {
    const jwt = signUserToken('u1', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));
    mockPrisma.codingCanvas.count.mockResolvedValue(1);

    const app = createApp('post', '/api/canvas', checkCanvasLimit());
    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('maxCanvases');
    expect(res.body.max).toBe(1);
  });

  // ─── FREE PLAN: Transcript limit (max 2 per canvas) ───

  it('Free plan user cannot add a 3rd transcript (limit: 2)', async () => {
    const jwt = signUserToken('u1', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));
    mockPrisma.canvasTranscript.count.mockResolvedValue(2);

    const app = createApp('post', '/api/canvas/:id/transcripts', checkTranscriptLimit());
    const res = await request(app)
      .post('/api/canvas/canvas-1/transcripts')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('maxTranscriptsPerCanvas');
    expect(res.body.max).toBe(2);
  });

  // ─── FREE PLAN: Code limit (max 5) ───

  it('Free plan user cannot add a 6th code (limit: 5)', async () => {
    const jwt = signUserToken('u1', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));
    mockPrisma.canvasQuestion.count.mockResolvedValue(5);

    const app = createApp('post', '/api/canvas/:id/questions', checkCodeLimit());
    const res = await request(app)
      .post('/api/canvas/canvas-1/questions')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('maxCodes');
    expect(res.body.max).toBe(5);
  });

  // ─── FREE PLAN: Share limit (max 0) ───

  it('Free plan user cannot create share codes (limit: 0)', async () => {
    const jwt = signUserToken('u1', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));
    mockPrisma.canvasShare.count.mockResolvedValue(0);

    const app = createApp('post', '/api/canvas/:id/share', checkShareLimit());
    const res = await request(app)
      .post('/api/canvas/canvas-1/share')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('maxShares');
    expect(res.body.max).toBe(0);
  });

  // ─── FREE PLAN: Ethics panel blocked ───

  it('Free plan user cannot access the ethics panel', async () => {
    const jwt = signUserToken('u1', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));

    const app = createApp('get', '/api/canvas/:canvasId/ethics', checkEthicsAccess());
    const res = await request(app)
      .get('/api/canvas/canvas-1/ethics')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('ethicsEnabled');
  });

  // ─── FREE PLAN: Auto-code blocked ───

  it('Free plan user cannot use auto-code', async () => {
    const jwt = signUserToken('u1', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));

    const app = createApp('post', '/api/canvas/:id/auto-code', checkAutoCode());
    const res = await request(app)
      .post('/api/canvas/canvas-1/auto-code')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('autoCodeEnabled');
  });

  // ─── FREE PLAN: Analysis types restricted to stats + wordcloud ───

  it('Free plan user cannot create co-occurrence analysis node', async () => {
    const jwt = signUserToken('u1', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));

    const app = createApp('post', '/api/canvas/:id/computed', checkAnalysisType());
    const res = await request(app)
      .post('/api/canvas/canvas-1/computed')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ nodeType: 'cooccurrence', label: 'Co-occurrence' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('allowedAnalysisTypes');
  });

  it('Free plan user cannot create sentiment analysis node', async () => {
    const jwt = signUserToken('u1', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));

    const app = createApp('post', '/api/canvas/:id/computed', checkAnalysisType());
    const res = await request(app)
      .post('/api/canvas/canvas-1/computed')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ nodeType: 'sentiment', label: 'Sentiment' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
  });

  it('Free plan user CAN create stats analysis node', async () => {
    const jwt = signUserToken('u1', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));

    const app = createApp('post', '/api/canvas/:id/computed', checkAnalysisType());
    const res = await request(app)
      .post('/api/canvas/canvas-1/computed')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ nodeType: 'stats', label: 'Stats' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('Free plan user CAN create wordcloud analysis node', async () => {
    const jwt = signUserToken('u1', 'researcher', 'free');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));

    const app = createApp('post', '/api/canvas/:id/computed', checkAnalysisType());
    const res = await request(app)
      .post('/api/canvas/canvas-1/computed')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ nodeType: 'wordcloud', label: 'Wordcloud' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  // ─── PRO PLAN: Unlimited canvases ───

  it('Pro plan user can create unlimited canvases', async () => {
    const jwt = signUserToken('u2', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u2', 'pro'));
    mockPrisma.codingCanvas.count.mockResolvedValue(100);

    const app = createApp('post', '/api/canvas', checkCanvasLimit());
    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  // ─── PRO PLAN: Share limit (max 5) ───

  it('Pro plan user limited to 5 share codes', async () => {
    const jwt = signUserToken('u2', 'researcher', 'pro');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u2', 'pro'));
    mockPrisma.canvasShare.count.mockResolvedValue(5);

    const app = createApp('post', '/api/canvas/:id/share', checkShareLimit());
    const res = await request(app)
      .post('/api/canvas/canvas-1/share')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('maxShares');
    expect(res.body.max).toBe(5);
  });

  // ─── TEAM PLAN: Unlimited shares ───

  it('Team plan user has unlimited shares', async () => {
    const jwt = signUserToken('u3', 'researcher', 'team');
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u3', 'team'));

    const app = createApp('post', '/api/canvas/:id/share', checkShareLimit());
    const res = await request(app)
      .post('/api/canvas/canvas-1/share')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  // ─── TEAM PLAN: Intercoder / Kappa via team route requireTeamPlan ───

  it('Team plan user can access team features (intercoder enabled)', async () => {
    // Team plan has intercoderEnabled: true — verify the plan config directly
    const { getPlanLimits } = await import('../../config/plans.js');
    const teamLimits = getPlanLimits('team');
    expect(teamLimits.intercoderEnabled).toBe(true);

    const proLimits = getPlanLimits('pro');
    expect(proLimits.intercoderEnabled).toBe(false);

    const freeLimits = getPlanLimits('free');
    expect(freeLimits.intercoderEnabled).toBe(false);
  });

  // ─── PLAN UPGRADE MID-SESSION ───

  it('Plan upgrade mid-session updates limits immediately (auth reads from DB)', async () => {
    // The auth middleware reads user.plan from DB on every request,
    // so upgrading the plan in the DB takes effect immediately.
    const jwt = signUserToken('u1', 'researcher', 'free');

    // First request: user is free, has 1 canvas → blocked
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'free'));
    mockPrisma.codingCanvas.count.mockResolvedValue(1);

    const app = createApp('post', '/api/canvas', checkCanvasLimit());
    const res1 = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res1.status).toBe(403);

    // Simulate plan upgrade in DB — now user is pro
    mockPrisma.user.findUnique.mockResolvedValue(mockUser('u1', 'pro'));
    mockPrisma.codingCanvas.count.mockResolvedValue(1);

    const res2 = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    // Auth middleware reads current plan from DB, so upgraded plan takes effect
    expect(res2.status).toBe(201);
    expect(res2.body.success).toBe(true);
  });

  // ─── LEGACY ACCESS-CODE USERS GET PRO LIMITS ───

  it('Legacy access-code users get Pro plan limits', async () => {
    const legacyJwt = signResearcherToken('da-legacy', 'researcher');

    // Auth middleware finds the dashboardAccess by accountId
    mockPrisma.dashboardAccess.findFirst.mockResolvedValue({
      id: 'da-legacy',
      accessCode: 'sha256hash',
      accessCodeHash: '$2a$12$hash',
      expiresAt: new Date(Date.now() + 86400000),
    });

    // Legacy users are grandfathered to pro — so unlimited canvases
    // Even with 50 canvases, should be allowed
    mockPrisma.codingCanvas.count.mockResolvedValue(50);

    const app = createApp('post', '/api/canvas', checkCanvasLimit());
    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${legacyJwt}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
