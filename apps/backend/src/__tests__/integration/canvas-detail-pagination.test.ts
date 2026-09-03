/**
 * L2 (bug hunt 2026-09-02): GET /canvas/:id detail paging parsed
 * `detailPage` / `detailPageSize` with parseInt + clamp. Nonsense became page
 * 0 silently, and `detailPage=99999999999999999999` reached Prisma as a `skip`
 * the driver cannot encode -> 500. The query is now schema-validated: 400 on
 * anything outside int 0..1_000_000 / 50..1000, and the accepted values reach
 * Prisma unchanged.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findUnique: vi.fn() },
    codingCanvas: { findUnique: vi.fn() },
    canvasCollaborator: { findUnique: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../middleware/planLimits.js', () => {
  const passthrough = () => (_req: Request, _res: Response, next: NextFunction) => next();
  return {
    checkCanvasLimit: passthrough,
    checkTranscriptLimit: passthrough,
    checkWordLimit: passthrough,
    checkCodeLimit: passthrough,
    checkAutoCode: passthrough,
    checkIntercoderAccess: passthrough,
    checkCaseAccess: passthrough,
    checkShareLimit: passthrough,
    checkAnalysisType: passthrough,
    checkAnalysisTypeOnRun: passthrough,
  };
});
vi.mock('../../lib/jms-events.js', () => ({ trackJmsEvent: vi.fn() }));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { canvasRoutes } from '../../routes/canvasRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', auth, canvasRoutes);
  app.use(errorHandler);
  return app;
}

describe('GET /canvas/:id detail pagination query validation (L2)', () => {
  let app: express.Express;
  const userId = 'user-detail-1';
  const dashboardAccessId = 'da-detail-1';
  const canvasId = 'canvas-detail-1';
  let jwt: string;

  const canvasRow = {
    id: canvasId,
    dashboardAccessId,
    userId,
    name: 'Paged canvas',
    deletedAt: null,
    transcripts: [],
    questions: [],
    memos: [],
    codings: [],
    nodePositions: [],
    cases: [],
    relations: [],
    computedNodes: [],
  };

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'detail@example.com',
      plan: 'pro',
      role: 'researcher',
      emailVerified: true,
      sessionsInvalidAt: null,
      trialEndsAt: null,
      dashboardAccess: { id: dashboardAccessId },
    });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...canvasRow });
  });

  const get = (query: string) =>
    request(app).get(`/api/canvas/${canvasId}${query}`).set('Authorization', `Bearer ${jwt}`);

  it.each([
    ['an overflowing page', '?detailPage=99999999999999999999'],
    ['a page above the ceiling', '?detailPage=1000001'],
    ['a negative page', '?detailPage=-1'],
    ['a non-numeric page', '?detailPage=abc'],
    ['a fractional page', '?detailPage=1.5'],
    ['a repeated page param', '?detailPage=1&detailPage=2'],
    ['a page size below the floor', '?detailPageSize=10'],
    ['a page size above the ceiling', '?detailPageSize=5000'],
    ['a non-numeric page size', '?detailPageSize=lots'],
  ])('returns 400, never 500, for %s', async (_label, query) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/detailPage/);
    // Rejected before any paged query is issued (the auth lookup and the
    // ownership check are the only Prisma calls made).
    expect(mockPrisma.codingCanvas.findUnique).toHaveBeenCalledTimes(1);
  });

  it('passes valid paging through to Prisma unchanged', async () => {
    const res = await get('?detailPage=3&detailPageSize=200');
    expect(res.status).toBe(200);
    expect(res.body.detailPagination).toEqual({
      page: 3,
      pageSize: 200,
      hasMore: expect.any(Object),
    });
    const pagedCall = mockPrisma.codingCanvas.findUnique.mock.calls[1][0];
    expect(pagedCall.include.transcripts).toMatchObject({ skip: 600, take: 201 });
    expect(pagedCall.include.codings).toMatchObject({ skip: 600, take: 201 });
  });

  it('defaults to page 0 of 500 when the query is absent or empty', async () => {
    for (const query of ['', '?detailPage=&detailPageSize=']) {
      mockPrisma.codingCanvas.findUnique.mockClear();
      const res = await get(query);
      expect(res.status).toBe(200);
      expect(res.body.detailPagination.page).toBe(0);
      expect(res.body.detailPagination.pageSize).toBe(500);
      const pagedCall = mockPrisma.codingCanvas.findUnique.mock.calls[1][0];
      expect(pagedCall.include.questions).toMatchObject({ skip: 0, take: 501 });
    }
  });

  it('accepts the boundaries (page 1000000, size 50 and 1000)', async () => {
    expect((await get('?detailPage=1000000&detailPageSize=1000')).status).toBe(200);
    expect((await get('?detailPage=0&detailPageSize=50')).status).toBe(200);
  });
});
