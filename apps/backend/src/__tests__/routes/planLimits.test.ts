import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Use vi.hoisted so mock objects are available in vi.mock factories ───
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
      count: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Mock hashing
vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

// Mock audit log
vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { checkCanvasLimit } from '../../middleware/planLimits.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

/**
 * Build a minimal app with:
 * - auth middleware (validates JWT, sets req.userId/userPlan)
 * - checkCanvasLimit middleware
 * - a dummy POST /api/canvas that returns 201
 */
function createApp() {
  const app = express();
  app.use(express.json());

  app.post('/api/canvas', auth, checkCanvasLimit(), (_req: Request, res: Response) => {
    res.status(201).json({ success: true, data: { id: 'new-canvas' } });
  });

  app.use(errorHandler);
  return app;
}

describe('Plan limits — canvas creation', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('allows a free user to create their first canvas', async () => {
    const jwt = signUserToken('user-1', 'researcher', 'free');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'free',
      role: 'researcher',
      dashboardAccess: null,
    });

    // checkCanvasLimit counts existing canvases — user has 0
    mockPrisma.codingCanvas.count.mockResolvedValue(0);

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'My Canvas' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('blocks a free user from creating a 3rd canvas (limit: 2 after Sprint C)', async () => {
    const jwt = signUserToken('user-1', 'researcher', 'free');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'free',
      role: 'researcher',
      dashboardAccess: null,
    });

    // User already has 2 canvases (at free cap)
    mockPrisma.codingCanvas.count.mockResolvedValue(2);

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Third Canvas' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('maxCanvases');
    expect(res.body.current).toBe(2);
    expect(res.body.max).toBe(2);
    expect(res.body.upgrade).toBe(true);
  });

  it('returns correct error structure for plan limit response', async () => {
    const jwt = signUserToken('user-1', 'researcher', 'free');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'free',
      role: 'researcher',
      dashboardAccess: null,
    });

    mockPrisma.codingCanvas.count.mockResolvedValue(2);

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Blocked Canvas' });

    // Verify the full error shape
    expect(res.body).toMatchObject({
      success: false,
      error: expect.stringContaining('plan allows'),
      code: 'PLAN_LIMIT_EXCEEDED',
      limit: 'maxCanvases',
      current: expect.any(Number),
      max: expect.any(Number),
      upgrade: true,
    });
  });

  it('allows a pro user to create multiple canvases', async () => {
    const jwt = signUserToken('user-2', 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      plan: 'pro',
      role: 'researcher',
      dashboardAccess: null,
    });

    // Pro has Infinity canvases — count doesn't matter
    mockPrisma.codingCanvas.count.mockResolvedValue(50);

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Another Canvas' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
