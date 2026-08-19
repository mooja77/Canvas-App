import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * Bulk narrative import must gate on the canvas OWNER's plan, like every other
 * transcript route (they all go through resolveRequestPlan). It read
 * req.userPlan — the REQUESTER's plan — so a Free collaborator invited onto a
 * Pro canvas was held to Free caps on someone else's paid canvas.
 */
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    dashboardAccess: { findUnique: vi.fn(), findFirst: vi.fn() },
    codingCanvas: { findUnique: vi.fn(), count: vi.fn() },
    canvasCollaborator: { findUnique: vi.fn() },
    canvasTranscript: { count: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
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

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { transcriptRoutes } from '../../routes/transcriptRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use('/api', auth, transcriptRoutes);
  app.use(errorHandler);
  return app;
}

const collaboratorId = 'user-collab-free';
const ownerId = 'user-owner-pro';
const canvasId = 'canvas-shared-1';

const narrative = (title: string, words = 10) => ({
  title,
  content: Array.from({ length: words }, (_, i) => `w${i}`).join(' '),
});

describe('POST /canvas/:id/import-narratives plan gating', () => {
  let app: express.Express;
  let collaboratorJwt: string;

  beforeAll(() => {
    collaboratorJwt = signUserToken(collaboratorId, 'researcher', 'free');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: collaboratorId,
      plan: 'free',
      role: 'researcher',
      emailVerified: true,
      trialEndsAt: null,
      dashboardAccess: { id: 'da-collab' },
    });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      id: canvasId,
      userId: ownerId,
      dashboardAccessId: 'da-owner',
      deletedAt: null,
      user: { plan: 'pro', emailVerified: true, trialEndsAt: null },
      dashboardAccess: null,
      collaborators: [{ id: 'collab-row-1' }],
    });
    mockPrisma.canvasCollaborator.findUnique.mockResolvedValue({ id: 'collab-row-1' });
    mockPrisma.canvasTranscript.count.mockResolvedValue(4);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (ops: any[]) => ops.map((_, i) => ({ id: `t-${i}` })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.canvasTranscript.create.mockImplementation((args: any) => args);
  });

  it("lets a Free collaborator import past the Free cap on a Pro owner's canvas", async () => {
    // Owner is Pro (unlimited transcripts). 4 existing + 3 imported would blow
    // the Free cap of 5, which is the requester's plan, not the owner's.
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-narratives`)
      .set('Authorization', `Bearer ${collaboratorJwt}`)
      .send({ narratives: [narrative('One'), narrative('Two'), narrative('Three')] });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(3);
  });

  it("applies the owner's word cap, not the requester's", async () => {
    // 20,000 words: over Free's 10,000 per transcript, under Pro's 50,000.
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-narratives`)
      .set('Authorization', `Bearer ${collaboratorJwt}`)
      .send({ narratives: [narrative('Long one', 20000)] });

    expect(res.status).toBe(201);
  });

  it('still enforces the cap when the owner really is on Free', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      id: canvasId,
      userId: ownerId,
      dashboardAccessId: 'da-owner',
      deletedAt: null,
      user: { plan: 'free', emailVerified: true, trialEndsAt: null },
      dashboardAccess: null,
      collaborators: [{ id: 'collab-row-1' }],
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import-narratives`)
      .set('Authorization', `Bearer ${collaboratorJwt}`)
      .send({ narratives: [narrative('One'), narrative('Two'), narrative('Three')] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/transcript limit/i);
  });
});
