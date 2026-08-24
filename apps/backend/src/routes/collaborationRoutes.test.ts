import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

/**
 * Regressions from §3.4 of the 2026-08-23 full-user audit:
 *
 *   item 3 (security) — an unrecognised `role` value failed OPEN: the route did
 *     `validRoles.includes(role) ? role : 'editor'`, so 'coder' / 'admin' /
 *     'viewer_readonly' all persisted `editor` and returned 201 as though the
 *     requested role had been honoured.
 *   item 2 — at the collaborator plan cap the owner could not change an
 *     existing collaborator's role, because the seat count ran before the
 *     upsert and did not exclude the target. This POST is the only role-change
 *     path in the product.
 */

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    codingCanvas: { findUnique: vi.fn() },
    canvasCollaborator: {
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/socket.js', () => ({ revokeCanvasAccess: vi.fn() }));
vi.mock('../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../middleware/auth.js';
import { collaborationRoutes } from './collaborationRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { signUserToken } from '../utils/jwt.js';

const canvasId = 'canvas-collab-role';
const owner = {
  id: 'user-owner',
  email: 'owner@example.com',
  name: 'Owner',
  role: 'researcher',
  plan: 'pro',
  sessionsInvalidAt: null,
  trialEndsAt: null,
  dashboardAccess: { id: 'da-owner' },
};
const target = {
  id: 'user-target',
  email: 'target@example.com',
  name: 'Target',
  role: 'researcher',
  plan: 'pro',
  sessionsInvalidAt: null,
  trialEndsAt: null,
  dashboardAccess: { id: 'da-target' },
};
const allUsers = [owner, target];

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, collaborationRoutes);
  app.use(errorHandler);
  return app;
}

/** No existing collaborator row for the target unless a test says otherwise. */
function targetIsNotYetACollaborator() {
  mockPrisma.canvasCollaborator.findUnique.mockResolvedValue(null);
}

function targetIsAlreadyACollaborator(role = 'editor') {
  mockPrisma.canvasCollaborator.findUnique.mockResolvedValue({
    id: 'cc-existing',
    canvasId,
    userId: target.id,
    role,
  });
}

/** Happy-path Prisma wiring: owner owns the canvas, target has no seat yet. */
function wireDefaults() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
    const found =
      (args?.where?.id && allUsers.find((u) => u.id === args.where.id)) ||
      (args?.where?.email && allUsers.find((u) => u.email === args.where.email));
    return found ? { ...found } : null;
  });
  mockPrisma.codingCanvas.findUnique.mockResolvedValue({
    id: canvasId,
    name: 'Collab Canvas',
    dashboardAccessId: owner.dashboardAccess.id,
    userId: owner.id,
    deletedAt: null,
  });
  mockPrisma.canvasCollaborator.count.mockResolvedValue(0);
  mockPrisma.canvasCollaborator.upsert.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (args: any) => ({ id: 'cc-new', canvasId, userId: target.id, role: args.create.role }),
  );
  targetIsNotYetACollaborator();
}

describe('POST /canvas/:id/collaborators', () => {
  let app: express.Express;
  let ownerJwt: string;

  beforeAll(() => {
    ownerJwt = signUserToken(owner.id, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    wireDefaults();
  });

  const invite = (body: Record<string, unknown>) =>
    request(app).post(`/api/canvas/${canvasId}/collaborators`).set('Authorization', `Bearer ${ownerJwt}`).send(body);

  // ─── §3.4 item 3: fail closed on an unknown role ───

  it.each(['coder', 'owner', 'admin', 'viewer_readonly', 'Editor', ''])(
    'rejects the unrecognised role %j instead of silently granting editor',
    async (role) => {
      const res = await invite({ email: target.email, role });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid role/i);
      expect(mockPrisma.canvasCollaborator.upsert).not.toHaveBeenCalled();
    },
  );

  it('accepts the two roles the product actually has', async () => {
    for (const role of ['editor', 'viewer']) {
      vi.clearAllMocks();
      wireDefaults();
      const res = await invite({ email: target.email, role });
      expect(res.status).toBe(201);
      expect(mockPrisma.canvasCollaborator.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ role }), update: { role } }),
      );
    }
  });

  it('still defaults an omitted role to editor (documented API default)', async () => {
    const res = await invite({ email: target.email });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('editor');
  });

  // ─── §3.4 item 2: a role change is not a new seat ───

  it('lets the owner change an existing collaborator role while AT the plan cap', async () => {
    targetIsAlreadyACollaborator('editor');
    mockPrisma.canvasCollaborator.count.mockResolvedValue(3); // pro maxCollaborators = 3

    const res = await invite({ email: target.email, role: 'viewer' });

    expect(res.status).toBe(201);
    expect(mockPrisma.canvasCollaborator.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { role: 'viewer' } }),
    );
    // The seat count must not even be consulted for an existing collaborator.
    expect(mockPrisma.canvasCollaborator.count).not.toHaveBeenCalled();
  });

  it('still refuses a genuinely NEW collaborator at the cap, with a remedy', async () => {
    targetIsNotYetACollaborator();
    mockPrisma.canvasCollaborator.count.mockResolvedValue(3);

    const res = await invite({ email: target.email, role: 'editor' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.error).toMatch(/remove a collaborator/i);
    expect(res.body.error).toMatch(/Team allow(s)? unlimited/);
    expect(mockPrisma.canvasCollaborator.upsert).not.toHaveBeenCalled();
  });
});
