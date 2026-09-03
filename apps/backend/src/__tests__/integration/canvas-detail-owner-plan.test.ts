/**
 * M6 (bug hunt 2026-09-02): the server gates every canvas-scoped plan limit on
 * the canvas OWNER's plan (planLimits.ts resolveRequestPlan), but the canvas UI
 * gated on the VIEWER's plan from /auth/me. A Free collaborator on a Team
 * canvas saw red caps and hidden tools the server would allow; a Pro
 * collaborator on a Free canvas got 403s the UI never warned about.
 *
 * GET /canvas/:id now carries `ownerPlan: { effectivePlan, limits }` so the
 * client can gate on the plan the server actually enforces.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import { PLAN_LIMITS } from '../../config/plans.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', auth, canvasRoutes);
  app.use(errorHandler);
  return app;
}

describe('GET /canvas/:id reports the OWNER plan (M6)', () => {
  let app: express.Express;
  const ownerId = 'user-owner';
  const ownerAccessId = 'da-owner';
  const viewerId = 'user-viewer';
  const viewerAccessId = 'da-viewer';
  const canvasId = 'canvas-owner-plan';

  const emptyRelations = {
    transcripts: [],
    questions: [],
    memos: [],
    codings: [],
    nodePositions: [],
    cases: [],
    relations: [],
    computedNodes: [],
  };

  const canvasOwnedBy = (plan: string) => ({
    id: canvasId,
    dashboardAccessId: ownerAccessId,
    userId: ownerId,
    name: 'Shared canvas',
    deletedAt: null,
    user: { plan, emailVerified: true, trialEndsAt: null },
    dashboardAccess: null,
    ...emptyRelations,
  });

  const signedInAs = (userId: string, plan: string, dashboardAccessId: string) => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: `${userId}@example.com`,
      plan,
      role: 'researcher',
      emailVerified: true,
      sessionsInvalidAt: null,
      trialEndsAt: null,
      dashboardAccess: { id: dashboardAccessId },
    });
    return signUserToken(userId, 'researcher', plan);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    // getOwnedCanvas admits the viewer as an invited collaborator; the detail
    // handler then reads their role.
    mockPrisma.canvasCollaborator.findUnique.mockResolvedValue({ id: 'collab-1', role: 'editor' });
  });

  it('a Free collaborator on a Team canvas sees Team limits', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(canvasOwnedBy('team'));
    const jwt = signedInAs(viewerId, 'free', viewerAccessId);

    const res = await request(app).get(`/api/canvas/${canvasId}`).set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data.myRole).toBe('editor');
    expect(res.body.data.ownerPlan.effectivePlan).toBe('team');
    expect(res.body.data.ownerPlan.limits.intercoderEnabled).toBe(true);
    expect(res.body.data.ownerPlan.limits.allowedAnalysisTypes).toEqual(PLAN_LIMITS.team.allowedAnalysisTypes);
    // Uncapped numbers travel as null, not as a dropped key.
    expect(res.body.data.ownerPlan.limits).toHaveProperty('maxCodes', null);
  });

  it('a Pro collaborator on a Free canvas sees Free limits', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(canvasOwnedBy('free'));
    const jwt = signedInAs(viewerId, 'pro', viewerAccessId);

    const res = await request(app).get(`/api/canvas/${canvasId}`).set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ownerPlan.effectivePlan).toBe('free');
    expect(res.body.data.ownerPlan.limits.maxCodes).toBe(PLAN_LIMITS.free.maxCodes);
    expect(res.body.data.ownerPlan.limits.allowedExportFormats).toEqual(PLAN_LIMITS.free.allowedExportFormats);
  });

  it('does not leak the owner record itself into the response', async () => {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(canvasOwnedBy('team'));
    const jwt = signedInAs(viewerId, 'free', viewerAccessId);

    const res = await request(app).get(`/api/canvas/${canvasId}`).set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('user');
    expect(res.body.data).not.toHaveProperty('dashboardAccess');
  });

  it('the owner sees their own plan, trial overlay included', async () => {
    const inTrial = {
      ...canvasOwnedBy('free'),
      user: { plan: 'free', emailVerified: true, trialEndsAt: new Date(Date.now() + 86_400_000) },
    };
    mockPrisma.codingCanvas.findUnique.mockResolvedValue(inTrial);
    const jwt = signedInAs(ownerId, 'free', ownerAccessId);

    const res = await request(app).get(`/api/canvas/${canvasId}`).set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data.myRole).toBe('owner');
    expect(res.body.data.ownerPlan.effectivePlan).toBe('pro');
  });
});
