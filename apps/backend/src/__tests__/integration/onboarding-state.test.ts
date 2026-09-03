/**
 * L4 (bug hunt 2026-09-02): PATCH /user/onboarding had no schema. It stored
 * unknown ids, arrays for scalars and a `__proto__` key verbatim, a client
 * could regress completion, and a second device that hydrated earlier erased
 * the server's checklist ticks by replacing the array. The body is now
 * strictly validated and `checklistComplete` is a union with the stored set.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../middleware/planLimits.js', () => ({
  checkCanvasLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../lib/jms-events.js', () => ({ trackJmsEvent: vi.fn().mockResolvedValue(undefined) }));

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

describe('PATCH /user/onboarding validation and merge (L4)', () => {
  let app: express.Express;
  const userId = 'user-onb-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'onb@example.com',
    name: 'Onboarding Tester',
    role: 'researcher',
    plan: 'pro',
    emailVerified: true,
    sessionsInvalidAt: null,
    trialEndsAt: null,
    dashboardAccess: null,
    onboardingState: '{}',
    onboardingCompletedAt: null,
  };

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.update.mockResolvedValue({ ...mockUser });
  });

  function withStored(state: unknown) {
    // First lookup is the auth middleware, second is the route's own read.
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser })
      .mockResolvedValueOnce({ ...mockUser, onboardingState: JSON.stringify(state) });
  }

  const patch = (body: object) =>
    request(app).patch('/api/user/onboarding').set('Authorization', `Bearer ${jwt}`).send(body);

  function storedState(): Record<string, unknown> {
    const call = mockPrisma.user.update.mock.calls[0][0] as { data: { onboardingState: string } };
    return JSON.parse(call.data.onboardingState);
  }

  it.each([
    ['an unknown state key', { state: { favouriteColour: 'blue' } }],
    ['an unknown top-level key', { state: { currentStep: 1 }, extra: 1 }],
    ['a __proto__ key', '{"state":{"__proto__":{"polluted":true}}}'],
    ['a checklist id that is not a task', { state: { checklistComplete: ['made-up-task'] } }],
    ['a checklist that is not an array', { state: { checklistComplete: 'export-csv' } }],
    ['a non-integer step', { state: { currentStep: 'two' } }],
    ['a step above 50', { state: { currentStep: 51 } }],
    ['an unknown completion mode', { state: { completionMode: 'abandoned' } }],
    ['too many dismissed tooltips', { state: { dismissedTooltips: Array.from({ length: 101 }, (_, i) => `t${i}`) } }],
    ['a missing state', {}],
    ['a non-object state', { state: 'done' }],
  ])('returns 400 and stores nothing for %s', async (_label, body) => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
    const res =
      typeof body === 'string'
        ? await request(app)
            .patch('/api/user/onboarding')
            .set('Authorization', `Bearer ${jwt}`)
            .set('Content-Type', 'application/json')
            .send(body)
        : await patch(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('unions checklistComplete with the stored set so completion never goes backwards', async () => {
    withStored({ currentStep: 3, checklistComplete: ['first-transcript', 'export-csv'] });

    const res = await patch({ state: { checklistComplete: ['run-analysis'] } });

    expect(res.status).toBe(200);
    expect(storedState().checklistComplete).toEqual(['first-transcript', 'export-csv', 'run-analysis']);
    expect(res.body.data.state.checklistComplete).toEqual(['first-transcript', 'export-csv', 'run-analysis']);
    expect(storedState().currentStep).toBe(3);
  });

  it('keeps server ticks when a second device sends an empty checklist', async () => {
    withStored({ checklistComplete: ['export-csv', 'dismissed'] });

    const res = await patch({ state: { checklistComplete: [] } });

    expect(res.status).toBe(200);
    expect(storedState().checklistComplete).toEqual(['export-csv', 'dismissed']);
  });

  it('deduplicates ids already stored', async () => {
    withStored({ checklistComplete: ['export-csv'] });

    await patch({ state: { checklistComplete: ['export-csv', 'create-theme'] } });

    expect(storedState().checklistComplete).toEqual(['export-csv', 'create-theme']);
  });

  it('leaves checklistComplete alone when the patch does not mention it', async () => {
    withStored({ checklistComplete: ['export-csv'] });

    await patch({ state: { currentStep: 4 } });

    expect(storedState()).toEqual({ checklistComplete: ['export-csv'], currentStep: 4 });
  });

  it('accepts the complete payload the frontend sends across the flow', async () => {
    withStored({});

    const res = await patch({
      state: {
        currentStep: 2,
        startedAt: '2026-09-02T10:00:00.000Z',
        dismissedTooltips: ['quick-code', 'auto-arrange'],
        checklistComplete: ['first-transcript'],
        completionMode: 'completed',
        completedAtClient: '2026-09-02T10:05:00.000Z',
        templateChoice: { id: 'tmpl-interviews', name: 'Interview study' },
        personalization: { researchTopic: 'burnout', method: 'interviews', solo: true },
      },
    });

    expect(res.status).toBe(200);
    expect(storedState()).toMatchObject({
      currentStep: 2,
      completionMode: 'completed',
      checklistComplete: ['first-transcript'],
    });
  });
});
