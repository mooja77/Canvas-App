import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * §3.4 item 6 of the 2026-08-23 full-user audit: posting the SAME coder twice
 * returned `{"alpha":1,"nCoders":1,"nUnits":0,"nObservations":0}` — a perfect
 * score over zero comparable units, which the panel renders as
 * "1.000 / Almost Perfect Agreement" with an Export Report button.
 *
 * Mechanism: buildSegmentCodeObservations keys coders by id, so [X, X]
 * collapsed to one Map entry, every unit dropped to m_u = 1, expected
 * disagreement D_e went to 0 and alpha fell out as 1. The zod schema's .min(2)
 * counts array ENTRIES, not distinct coders, so it never caught it.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    codingCanvas: { findUnique: vi.fn() },
    canvasCollaborator: { findUnique: vi.fn() },
    canvasTranscript: { findUnique: vi.fn() },
    canvasTextCoding: { findMany: vi.fn() },
    $disconnect: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
// The agreement endpoint is Team-only; the gate is not what is under test here.
vi.mock('../middleware/planLimits.js', () => ({
  checkCodeLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAutoCode: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCaseAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkIntercoderAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../middleware/auth.js';
import { codingRoutes } from './codingRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { signUserToken } from '../utils/jwt.js';

const canvasId = 'canvas-ic-1';
const transcriptId = 'transcript-ic-1';
const owner = {
  id: 'user-ic-owner',
  email: 'owner@example.com',
  name: 'Owner',
  role: 'researcher',
  plan: 'team',
  sessionsInvalidAt: null,
  trialEndsAt: null,
  dashboardAccess: { id: 'da-ic-owner' },
};
const second = { id: 'user-ic-second' };

// Two paragraphs -> two coding units.
const content = 'First paragraph of the interview.\n\nSecond paragraph of the interview.';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, codingRoutes);
  app.use(errorHandler);
  return app;
}

describe('POST /canvas/:id/intercoder/agreement', () => {
  let app: express.Express;
  let jwt: string;

  beforeAll(() => {
    jwt = signUserToken(owner.id, 'researcher', 'team');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...owner });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      id: canvasId,
      name: 'IC Canvas',
      dashboardAccessId: owner.dashboardAccess.id,
      userId: owner.id,
      deletedAt: null,
    });
    mockPrisma.canvasTranscript.findUnique.mockResolvedValue({ id: transcriptId, canvasId, content });
    // The owner coded paragraph 1; the second coder coded paragraph 2. Enough
    // attribution that neither coder trips the "coded nothing" guard.
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([
      {
        id: 'tc-1',
        canvasId,
        transcriptId,
        questionId: 'q1',
        startOffset: 0,
        endOffset: 33,
        coderUserId: owner.id,
      },
      {
        id: 'tc-2',
        canvasId,
        transcriptId,
        questionId: 'q1',
        startOffset: 35,
        endOffset: 69,
        coderUserId: second.id,
      },
    ]);
  });

  const compute = (userIds: string[]) =>
    request(app)
      .post(`/api/canvas/${canvasId}/intercoder/agreement`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ transcriptId, userIds });

  it('refuses the same coder selected twice instead of returning alpha = 1', async () => {
    const res = await compute([owner.id, owner.id]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least two different coders/i);
    // The bug's signature, which must never be served again.
    expect(res.body.data?.alpha).toBeUndefined();
  });

  it('refuses three entries that are all the same coder', async () => {
    const res = await compute([second.id, second.id, second.id]);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least two different coders/i);
  });

  it('collapses a duplicate down to the genuine two-coder result', async () => {
    const both = await compute([owner.id, second.id]);
    const dupe = await compute([owner.id, second.id, owner.id]);

    expect(both.status).toBe(200);
    expect(dupe.status).toBe(200);
    // A repeated id must not change the statistic, and must not inflate nCoders.
    expect(dupe.body.data.alpha).toBe(both.body.data.alpha);
    expect(dupe.body.data.nCoders).toBe(2);
  });

  it('still computes a real two-coder agreement', async () => {
    const res = await compute([owner.id, second.id]);
    expect(res.status).toBe(200);
    expect(res.body.data.nCoders).toBe(2);
    expect(res.body.data.nUnits).toBeGreaterThan(0);
    expect(res.body.data.alpha).not.toBe(1);
  });
});
