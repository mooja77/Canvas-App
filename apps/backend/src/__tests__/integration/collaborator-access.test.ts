import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    dashboardAccess: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    codingCanvas: {
      findUnique: vi.fn(),
    },
    canvasShare: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasCollaborator: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../middleware/planLimits.js', () => ({
  checkShareLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCanvasLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('UNIQ1234'),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { shareRoutes, canvasPublicRoutes } from '../../routes/shareRoutes.js';
import { collaborationRoutes } from '../../routes/collaborationRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';
import { getOwnedCanvas } from '../../utils/routeHelpers.js';
import { AppError } from '../../middleware/errorHandler.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', canvasPublicRoutes);
  app.use('/api', auth, shareRoutes, collaborationRoutes);
  app.use(errorHandler);
  return app;
}

const canvasId = 'canvas-collab-1';
const owner = {
  id: 'user-owner-1',
  email: 'owner@example.com',
  name: 'Owner',
  role: 'researcher',
  plan: 'pro',
  sessionsInvalidAt: null,
  trialEndsAt: null,
  dashboardAccess: { id: 'da-owner-1' },
};
const collaborator = {
  id: 'user-collab-1',
  email: 'collab@example.com',
  name: 'Collaborator',
  role: 'researcher',
  plan: 'pro',
  sessionsInvalidAt: null,
  trialEndsAt: null,
  dashboardAccess: { id: 'da-collab-1' },
};
const stranger = {
  id: 'user-stranger-1',
  email: 'stranger@example.com',
  name: 'Stranger',
  role: 'researcher',
  plan: 'pro',
  sessionsInvalidAt: null,
  trialEndsAt: null,
  dashboardAccess: { id: 'da-stranger-1' },
};
const allUsers = [owner, collaborator, stranger];

const mockCanvas = {
  id: canvasId,
  name: 'Collab Canvas',
  dashboardAccessId: owner.dashboardAccess.id,
  userId: owner.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

// user.findUnique is hit by BOTH the auth middleware (where.id, include
// dashboardAccess) and the invite route (where.email / where.id) — resolve
// from the fixture set either way.
function wireUserLookup() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
    const byId = args?.where?.id ? allUsers.find((u) => u.id === args.where.id) : undefined;
    const byEmail = args?.where?.email ? allUsers.find((u) => u.email === args.where.email) : undefined;
    const found = byId || byEmail;
    return found ? { ...found } : null;
  });
}

// Collaborator membership: only `collaborator` is on the canvas.
function wireCollaboratorLookup() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockPrisma.canvasCollaborator.findUnique.mockImplementation(async (args: any) => {
    const key = args?.where?.canvasId_userId;
    if (key && key.canvasId === canvasId && key.userId === collaborator.id) {
      return { id: 'cc-1', canvasId, userId: collaborator.id, role: 'editor' };
    }
    return null;
  });
}

describe('Collaborator access integration', () => {
  let app: express.Express;
  let ownerJwt: string;
  let collabJwt: string;
  let strangerJwt: string;

  beforeAll(() => {
    ownerJwt = signUserToken(owner.id, 'researcher', 'pro');
    collabJwt = signUserToken(collaborator.id, 'researcher', 'pro');
    strangerJwt = signUserToken(stranger.id, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    wireUserLookup();
    wireCollaboratorLookup();
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasCollaborator.count.mockResolvedValue(0);
  });

  // ─── getOwnedCanvas access matrix ───
  describe('getOwnedCanvas', () => {
    it('allows the owner', async () => {
      const canvas = await getOwnedCanvas(canvasId, owner.dashboardAccess.id, owner.id);
      expect(canvas.id).toBe(canvasId);
    });

    it('allows an invited collaborator', async () => {
      const canvas = await getOwnedCanvas(canvasId, collaborator.dashboardAccess.id, collaborator.id);
      expect(canvas.id).toBe(canvasId);
    });

    it('rejects a collaborator for owner-only operations with a clear message', async () => {
      await expect(
        getOwnedCanvas(canvasId, collaborator.dashboardAccess.id, collaborator.id, { requireOwner: true }),
      ).rejects.toThrow('Only the canvas owner can do this');
    });

    it('still rejects strangers', async () => {
      await expect(getOwnedCanvas(canvasId, stranger.dashboardAccess.id, stranger.id)).rejects.toThrow(AppError);
      await expect(getOwnedCanvas(canvasId, stranger.dashboardAccess.id, stranger.id)).rejects.toThrow('Access denied');
    });
  });

  // ─── Invite by email ───
  describe('POST /canvas/:id/collaborators', () => {
    it('owner invites a coder by email', async () => {
      mockPrisma.canvasCollaborator.upsert.mockResolvedValue({
        id: 'cc-new',
        canvasId,
        userId: collaborator.id,
        role: 'editor',
      });

      const res = await request(app)
        .post(`/api/canvas/${canvasId}/collaborators`)
        .set('Authorization', `Bearer ${ownerJwt}`)
        .send({ email: 'collab@example.com' });

      expect(res.status).toBe(201);
      expect(mockPrisma.canvasCollaborator.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ userId: collaborator.id, role: 'editor' }),
        }),
      );
    });

    it('invite normalizes the email case', async () => {
      mockPrisma.canvasCollaborator.upsert.mockResolvedValue({ id: 'cc-new', canvasId, userId: collaborator.id });

      const res = await request(app)
        .post(`/api/canvas/${canvasId}/collaborators`)
        .set('Authorization', `Bearer ${ownerJwt}`)
        .send({ email: '  Collab@Example.com ' });

      expect(res.status).toBe(201);
    });

    it('returns a friendly 404 for an email with no account', async () => {
      const res = await request(app)
        .post(`/api/canvas/${canvasId}/collaborators`)
        .set('Authorization', `Bearer ${ownerJwt}`)
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No QualCanvas account found/i);
    });

    it('a collaborator cannot invite others (owner-only)', async () => {
      const res = await request(app)
        .post(`/api/canvas/${canvasId}/collaborators`)
        .set('Authorization', `Bearer ${collabJwt}`)
        .send({ email: 'stranger@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/owner/i);
    });
  });

  // ─── Collaborator management permissions ───
  it('a collaborator cannot remove other collaborators', async () => {
    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/collaborators/${collaborator.id}`)
      .set('Authorization', `Bearer ${collabJwt}`);

    expect(res.status).toBe(403);
  });

  it('a collaborator CAN view the coder list (needed for intercoder agreement)', async () => {
    mockPrisma.canvasCollaborator.findMany.mockResolvedValue([
      { id: 'cc-1', canvasId, userId: collaborator.id, role: 'editor', createdAt: new Date() },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: collaborator.id, name: collaborator.name, email: collaborator.email },
    ]);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/collaborators`)
      .set('Authorization', `Bearer ${collabJwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].userEmail).toBe(collaborator.email);
  });

  // ─── Share-code management is owner-only ───
  it('a collaborator cannot create share codes', async () => {
    const res = await request(app).post(`/api/canvas/${canvasId}/share`).set('Authorization', `Bearer ${collabJwt}`);

    expect(res.status).toBe(403);
  });

  it('a stranger still gets 403 on collaborator list', async () => {
    const res = await request(app)
      .get(`/api/canvas/${canvasId}/collaborators`)
      .set('Authorization', `Bearer ${strangerJwt}`);

    expect(res.status).toBe(403);
  });
});
