import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * Provider connections (Zoom/Slack/Qualtrics) were never a real OAuth flow and
 * are retired. Retiring them must not strand credentials that earlier builds
 * already encrypted into the Integration table: a user has to keep being able
 * to see what is held and delete it.
 *
 * The gate that matters here is that list and delete are NOT plan-gated.
 * Integrations used to sit behind checkIntegrationsAccess(), which is now false
 * on every plan — leaving those routes gated would lock users out of their own
 * stored credentials with no way to revoke them.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    integration: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));

vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { integrationRoutes } from '../../routes/integrationRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, integrationRoutes);
  app.use(errorHandler);
  return app;
}

describe('Integration credential routes (provider connections retired)', () => {
  let app: express.Express;
  const userId = 'user-int-1';
  const dashboardAccessId = 'da-int-1';
  // Deliberately a FREE user: stored credentials must stay reachable on the
  // plan with the fewest entitlements.
  let jwt: string;

  const storedIntegration = {
    id: 'ckintegration0000000001',
    userId,
    provider: 'zoom',
    metadata: '{}',
    expiresAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    jwt = signUserToken(userId, 'researcher', 'free');
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'free@example.com',
      role: 'researcher',
      plan: 'free',
      dashboardAccess: { id: dashboardAccessId },
    });
  });

  it('lets a free-plan user list credentials still held for them', async () => {
    mockPrisma.integration.findMany.mockResolvedValue([storedIntegration]);

    const res = await request(app).get('/api/integrations').set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.integrations).toHaveLength(1);
    expect(res.body.integrations[0].provider).toBe('zoom');
  });

  it('never returns token material in the listing', async () => {
    mockPrisma.integration.findMany.mockResolvedValue([storedIntegration]);

    await request(app).get('/api/integrations').set('Authorization', `Bearer ${jwt}`);

    const select = mockPrisma.integration.findMany.mock.calls[0][0].select;
    expect(select.accessToken).toBeUndefined();
    expect(select.refreshToken).toBeUndefined();
  });

  it('lets a free-plan user delete their own stored credential', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue(storedIntegration);
    mockPrisma.integration.delete.mockResolvedValue(storedIntegration);

    const res = await request(app)
      .delete(`/api/integrations/${storedIntegration.id}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(mockPrisma.integration.delete).toHaveBeenCalledWith({ where: { id: storedIntegration.id } });
  });

  it("refuses to delete another user's credential", async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({ ...storedIntegration, userId: 'someone-else' });

    const res = await request(app)
      .delete(`/api/integrations/${storedIntegration.id}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(403);
    expect(mockPrisma.integration.delete).not.toHaveBeenCalled();
  });

  it('no longer accepts new provider connections', async () => {
    const res = await request(app)
      .post('/api/integrations/connect')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ provider: 'zoom', accessToken: 'attacker-supplied-token' });

    // 410 Gone: the capability existed and has been withdrawn.
    expect(res.status).toBe(410);
  });

  it('stores nothing when a connection attempt is made', async () => {
    await request(app)
      .post('/api/integrations/connect')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ provider: 'slack', accessToken: 'attacker-supplied-token' });

    // The retired endpoint must not be a way to write arbitrary secrets.
    expect(mockPrisma.integration.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.integration.delete).not.toHaveBeenCalled();
  });
});
