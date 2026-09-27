/**
 * How did you hear about us: GET/POST /user/hdyhau. Asked once per account;
 * only the six canonical keys are accepted; the answer or the skip is stored
 * server-side and a second answer is a no-op that forwards nothing.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockPrisma, mockForward } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
  mockForward: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../lib/hdyhau.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/hdyhau.js')>();
  return { ...actual, forwardHdyhau: mockForward };
});

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { acquisitionRoutes } from '../../routes/acquisitionRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', auth, acquisitionRoutes);
  app.use(errorHandler);
  return app;
}

describe('/user/hdyhau', () => {
  let app: express.Express;
  const userId = 'user-hdyhau-1';
  let jwt: string;

  const authUser = {
    id: userId,
    email: 'maria.rossi@unibo.it',
    name: 'Maria',
    role: 'researcher',
    plan: 'free',
    emailVerified: true,
    sessionsInvalidAt: null,
    trialEndsAt: null,
    dashboardAccess: null,
  };

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'free');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  /** First findUnique is the auth middleware; the rest are the route's own reads. */
  function routeReads(...rows: object[]) {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...authUser });
    for (const row of rows) mockPrisma.user.findUnique.mockResolvedValueOnce(row);
  }

  const get = () => request(app).get('/api/user/hdyhau').set('Authorization', `Bearer ${jwt}`);
  const post = (body: object) => request(app).post('/api/user/hdyhau').set('Authorization', `Bearer ${jwt}`).send(body);

  describe('GET', () => {
    it('asks a new account that has not answered', async () => {
      routeReads({ email: authUser.email, createdAt: new Date('2026-09-28T10:00:00Z'), acquisitionRespondedAt: null });
      const res = await get();
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ ask: true });
    });

    it('does not ask again once answered or skipped', async () => {
      routeReads({
        email: authUser.email,
        createdAt: new Date('2026-09-28T10:00:00Z'),
        acquisitionRespondedAt: new Date(),
      });
      const res = await get();
      expect(res.body.data).toEqual({ ask: false });
    });

    it('does not ask accounts that signed up before the question existed', async () => {
      routeReads({ email: authUser.email, createdAt: new Date('2026-03-01T10:00:00Z'), acquisitionRespondedAt: null });
      const res = await get();
      expect(res.body.data).toEqual({ ask: false });
    });

    it('does not ask fixture accounts such as the production activation canary', async () => {
      routeReads({
        email: 'activation-journey-123@example.com',
        createdAt: new Date('2026-09-28T10:00:00Z'),
        acquisitionRespondedAt: null,
      });
      const res = await get();
      expect(res.body.data).toEqual({ ask: false });
    });

    it('does not ask on the hermetic E2E stack', async () => {
      vi.stubEnv('E2E_TEST', 'true');
      try {
        routeReads({
          email: authUser.email,
          createdAt: new Date('2026-09-28T10:00:00Z'),
          acquisitionRespondedAt: null,
        });
        const res = await get();
        expect(res.body.data).toEqual({ ask: false });
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe('POST', () => {
    it('rejects a non-canonical channel and writes nothing', async () => {
      for (const channel of ['shopify_app_store', 'Google search', 'youtube', '']) {
        routeReads();
        const res = await post({ channel });
        expect(res.status).toBe(400);
      }
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
      expect(mockForward).not.toHaveBeenCalled();
    });

    it('rejects a body with neither or both of channel and skipped', async () => {
      routeReads();
      expect((await post({})).status).toBe(400);
      routeReads();
      expect((await post({ channel: 'google', skipped: true })).status).toBe(400);
      routeReads();
      expect((await post({ channel: 'other', otherText: 'x'.repeat(501) })).status).toBe(400);
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('persists the answer once and forwards it with the account email', async () => {
      mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
      routeReads({ email: 'maria.rossi@unibo.it' });
      const res = await post({ channel: 'trade_group' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ recorded: true });
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: userId, acquisitionRespondedAt: null },
        data: expect.objectContaining({
          acquisitionChannel: 'trade_group',
          acquisitionOtherText: null,
          acquisitionRespondedAt: expect.any(Date),
        }),
      });
      expect(mockForward).toHaveBeenCalledWith('maria.rossi@unibo.it', 'trade_group', null);
    });

    it('keeps free text only for "other"', async () => {
      mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
      routeReads({ email: 'maria.rossi@unibo.it' });
      await post({ channel: 'other', otherText: '  A methods seminar  ' });
      expect(mockPrisma.user.updateMany.mock.calls[0][0].data.acquisitionOtherText).toBe('A methods seminar');
      expect(mockForward).toHaveBeenCalledWith('maria.rossi@unibo.it', 'other', 'A methods seminar');

      mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
      routeReads({ email: 'maria.rossi@unibo.it' });
      await post({ channel: 'google', otherText: 'ignored' });
      expect(mockPrisma.user.updateMany.mock.calls[1][0].data.acquisitionOtherText).toBeNull();
    });

    it('a second answer is a no-op and forwards nothing', async () => {
      mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
      routeReads();
      const res = await post({ channel: 'google' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ recorded: false });
      expect(mockForward).not.toHaveBeenCalled();
    });

    it('a skip is persisted and not forwarded', async () => {
      mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
      routeReads();
      const res = await post({ skipped: true });
      expect(res.status).toBe(200);
      expect(mockPrisma.user.updateMany.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ acquisitionChannel: null, acquisitionRespondedAt: expect.any(Date) }),
      );
      expect(mockForward).not.toHaveBeenCalled();
    });
  });
});
