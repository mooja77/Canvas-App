import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    // Team/TeamMember are accessed via (prisma as any).team / .teamMember
    team: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    teamMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Mock rate limiter to be a pass-through
vi.mock('../../middleware/authLimiter.js', () => ({
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Mock audit logging
vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Mock hashing utils
vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

// Mock plan limits — pass through for integration tests
vi.mock('../../middleware/planLimits.js', () => ({
  checkCanvasLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkTranscriptLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkWordLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCodeLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAutoCode: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCaseAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkShareLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAnalysisType: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAnalysisTypeOnRun: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock12nanoid'),
}));

// Mock stripe
vi.mock('../../lib/stripe.js', () => ({
  getStripe: vi.fn().mockReturnValue({
    subscriptions: { cancel: vi.fn() },
  }),
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(),
  },
}));

// Mock email
vi.mock('../../lib/email.js', () => ({
  sendTeamInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { teamRoutes } from '../../routes/teamRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, teamRoutes);
  app.use(errorHandler);
  return app;
}

describe('Team routes integration tests', () => {
  let app: express.Express;
  const userId = 'user-team-1';
  const dashboardAccessId = 'da-team-1';
  const teamId = 'team-1';

  const mockUser = {
    id: userId,
    email: 'teamowner@example.com',
    name: 'Team Owner',
    role: 'researcher',
    plan: 'team',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  // JWT for a team-plan user
  let teamJwt: string;
  // JWT for a free-plan user
  let freeJwt: string;
  const freeUserId = 'user-free-1';

  const mockFreeUser = {
    id: freeUserId,
    email: 'freeuser@example.com',
    name: 'Free User',
    role: 'researcher',
    plan: 'free',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: 'da-free-1' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    teamJwt = signUserToken(userId, 'researcher', 'team');
    freeJwt = signUserToken(freeUserId, 'researcher', 'free');
    app = createApp();
    // Default: auth middleware finds the team user
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
  });

  // ─── 1. POST /api/teams creates team ───
  it('POST /api/teams creates a team', async () => {
    const createdTeam = {
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      members: [{ userId, role: 'owner' }],
    };
    mockPrisma.team.create.mockResolvedValue(createdTeam);

    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${teamJwt}`)
      .send({ name: 'Research Lab' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Research Lab');
    expect(res.body.data.ownerId).toBe(userId);
    expect(mockPrisma.team.create).toHaveBeenCalledOnce();
  });

  // ─── 2. GET /api/teams lists teams for user ───
  it('GET /api/teams lists teams for user', async () => {
    const memberships = [
      {
        userId,
        role: 'owner',
        joinedAt: new Date(),
        team: {
          id: teamId,
          name: 'Research Lab',
          ownerId: userId,
          owner: { id: userId, name: 'Team Owner', email: 'teamowner@example.com' },
          _count: { members: 2 },
        },
      },
    ];
    mockPrisma.teamMember.findMany.mockResolvedValue(memberships);

    const res = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${teamJwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Research Lab');
    expect(res.body.data[0].myRole).toBe('owner');
  });

  // ─── 3. POST /api/teams/:id/members invites member by email ───
  it('POST /api/teams/:id/members invites a member by email', async () => {
    const targetUser = {
      id: 'user-invited-1',
      email: 'invited@example.com',
      name: 'Invited User',
    };

    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      members: [{ userId, role: 'owner' }],
    });

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser }) // auth middleware
      .mockResolvedValueOnce(targetUser); // find target user by email

    mockPrisma.teamMember.findUnique.mockResolvedValue(null); // not already a member

    const createdMember = {
      teamId,
      userId: targetUser.id,
      role: 'member',
      user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
    };
    mockPrisma.teamMember.create.mockResolvedValue(createdMember);

    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${teamJwt}`)
      .send({ email: 'invited@example.com', role: 'member' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(targetUser.id);
  });

  // ─── 4. DELETE /api/teams/:id/members/:userId removes member ───
  it('DELETE /api/teams/:id/members/:userId removes a member', async () => {
    const targetUserId = 'user-to-remove';

    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      members: [
        { userId, role: 'owner' },
        { userId: targetUserId, role: 'member' },
      ],
    });

    mockPrisma.teamMember.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete(`/api/teams/${teamId}/members/${targetUserId}`)
      .set('Authorization', `Bearer ${teamJwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Member removed');
  });

  // ─── 5. DELETE /api/teams/:id deletes team (owner only) ───
  it('DELETE /api/teams/:id deletes the team', async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
    });
    mockPrisma.team.delete.mockResolvedValue({ id: teamId });

    const res = await request(app)
      .delete(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${teamJwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Team deleted');
    expect(mockPrisma.team.delete).toHaveBeenCalledWith({ where: { id: teamId } });
  });

  // ─── 6. Non-owner cannot delete team → 403 ───
  it('DELETE /api/teams/:id by non-owner returns 403', async () => {
    const nonOwnerUserId = 'user-member-1';
    const nonOwnerJwt = signUserToken(nonOwnerUserId, 'researcher', 'team');

    const nonOwnerUser = {
      id: nonOwnerUserId,
      email: 'member@example.com',
      name: 'Team Member',
      role: 'researcher',
      plan: 'team',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: 'da-member-1' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(nonOwnerUser);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId, // different from nonOwnerUserId
    });

    const res = await request(app)
      .delete(`/api/teams/${teamId}`)
      .set('Authorization', `Bearer ${nonOwnerJwt}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(mockPrisma.team.delete).not.toHaveBeenCalled();
  });

  // ─── 7. Non-Team-plan user cannot create team → 403 ───
  it('POST /api/teams by free-plan user returns 403', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockFreeUser });

    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${freeJwt}`)
      .send({ name: 'My Team' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(mockPrisma.team.create).not.toHaveBeenCalled();
  });
});
