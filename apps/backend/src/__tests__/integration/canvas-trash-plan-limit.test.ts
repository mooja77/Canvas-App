import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * Soft-deleted canvases must not count against maxCanvases.
 *
 * A Free user (cap 2) who fills their two slots and then deletes one is left
 * with a single active canvas and a trashed one. Both the checkCanvasLimit
 * middleware and the post-create race guard in canvasRoutes counted rows
 * without filtering `deletedAt`, so the trash permanently consumed a slot and
 * nothing in the product ever purges it.
 */
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    dashboardAccess: { findUnique: vi.fn(), findFirst: vi.fn() },
    codingCanvas: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    canvasShare: { count: vi.fn() },
    $queryRawUnsafe: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../lib/jms-events.js', () => ({ trackJmsEvent: vi.fn() }));
vi.mock('../../utils/fileCleanup.js', () => ({ deleteStoredUploads: vi.fn().mockResolvedValue(0) }));
vi.mock('nanoid', () => ({ nanoid: vi.fn().mockReturnValue('mock12nanoid') }));

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

const userId = 'user-trash-1';
const dashboardAccessId = 'da-trash-1';

/** 1 live canvas, 2 in the trash. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const countByTrashState = (args: any) => Promise.resolve(args?.where?.deletedAt === null ? 1 : 3);

describe('Free-plan canvas cap ignores the trash', () => {
  let app: express.Express;
  let jwt: string;

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'free');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      plan: 'free',
      role: 'researcher',
      emailVerified: true,
      trialEndsAt: null,
      dashboardAccess: { id: dashboardAccessId },
    });
    mockPrisma.codingCanvas.count.mockImplementation(countByTrashState);
    mockPrisma.codingCanvas.create.mockResolvedValue({
      id: 'canvas-new',
      name: 'Third try',
      dashboardAccessId,
      userId,
      deletedAt: null,
    });
  });

  it('lets a Free user create a canvas after emptying a slot into the trash', async () => {
    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Third try' });

    expect(res.status).toBe(201);
    expect(mockPrisma.codingCanvas.create).toHaveBeenCalled();
  });

  it('never re-deletes the new canvas through the post-create race guard', async () => {
    await request(app).post('/api/canvas').set('Authorization', `Bearer ${jwt}`).send({ name: 'Third try' });

    expect(mockPrisma.codingCanvas.delete).not.toHaveBeenCalled();
  });

  it('excludes soft-deleted rows from every cap count it runs', async () => {
    await request(app).post('/api/canvas').set('Authorization', `Bearer ${jwt}`).send({ name: 'Third try' });

    // The first-value analytics count is not a cap check, so only assert the
    // two that gate creation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wheres = mockPrisma.codingCanvas.count.mock.calls.map((call: any[]) => call[0]?.where);
    // The two cap counts are the owner-scoped ones (OR of userId /
    // dashboardAccessId); the third call is the first-value analytics tracker.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gating = wheres.filter((where: any) => Array.isArray(where?.OR));
    expect(gating).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const where of gating) expect((where as any).deletedAt).toBeNull();
  });

  it('still blocks a Free user whose LIVE canvases are already at the cap', async () => {
    mockPrisma.codingCanvas.count.mockResolvedValue(2);

    const res = await request(app)
      .post('/api/canvas')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: 'Third try' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe('maxCanvases');
  });
});
