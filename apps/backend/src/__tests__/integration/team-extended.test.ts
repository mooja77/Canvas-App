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
      update: vi.fn(),
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

vi.mock('../../middleware/authLimiter.js', () => ({
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

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
  checkRepositoryAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkIntegrationsAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkFileUploadAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkExportFormat: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock12nanoid'),
}));

vi.mock('../../lib/stripe.js', () => ({
  getStripe: vi.fn().mockReturnValue({
    subscriptions: { cancel: vi.fn() },
  }),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(),
  },
}));

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

describe('Team extended integration tests', () => {
  let app: express.Express;
  const userId = 'user-team-ext-1';
  const dashboardAccessId = 'da-team-ext-1';
  const teamId = 'team-ext-1';

  const mockUser = {
    id: userId,
    email: 'teamowner@example.com',
    name: 'Team Owner',
    role: 'researcher',
    plan: 'team',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  let teamJwt: string;
  let freeJwt: string;
  const freeUserId = 'user-free-ext-1';

  const mockFreeUser = {
    id: freeUserId,
    email: 'freeuser@example.com',
    name: 'Free User',
    role: 'researcher',
    plan: 'free',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: 'da-free-ext-1' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    teamJwt = signUserToken(userId, 'researcher', 'team');
    freeJwt = signUserToken(freeUserId, 'researcher', 'free');
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
  });

  // ─── 1. POST /teams rejects duplicate name (Prisma unique constraint) ───
  it('POST /api/teams rejects duplicate team name', async () => {
    const prismaError = new Error('Unique constraint failed on the fields: (`name`)');
    (prismaError as any).code = 'P2002';
    mockPrisma.team.create.mockRejectedValue(prismaError);

    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${teamJwt}`)
      .send({ name: 'Existing Team' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // ─── 2. POST /teams rejects empty name (validation) ───
  it('POST /api/teams rejects empty name', async () => {
    const res = await request(app).post('/api/teams').set('Authorization', `Bearer ${teamJwt}`).send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 3. GET /teams/:id returns team with members ───
  it('GET /api/teams/:teamId returns team with members', async () => {
    const teamDetail = {
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      owner: { id: userId, name: 'Team Owner', email: 'teamowner@example.com' },
      members: [
        { userId, role: 'owner', user: { id: userId, name: 'Team Owner', email: 'teamowner@example.com' } },
        { userId: 'user-m2', role: 'member', user: { id: 'user-m2', name: 'Member 2', email: 'm2@example.com' } },
      ],
    };
    mockPrisma.team.findUnique.mockResolvedValue(teamDetail);

    const res = await request(app).get(`/api/teams/${teamId}`).set('Authorization', `Bearer ${teamJwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(teamId);
    expect(res.body.data.members).toHaveLength(2);
  });

  // ─── 4. GET /teams/:id returns 404 for unknown team ───
  it('GET /api/teams/:teamId returns 404 for unknown team', async () => {
    mockPrisma.team.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/teams/nonexistent').set('Authorization', `Bearer ${teamJwt}`);

    expect(res.status).toBe(404);
  });

  // ─── 5. GET /teams/:id returns 403 for non-member ───
  it('GET /api/teams/:teamId returns 403 for non-member', async () => {
    const nonMemberUserId = 'user-nonmember';
    const nonMemberJwt = signUserToken(nonMemberUserId, 'researcher', 'team');
    const nonMemberUser = {
      id: nonMemberUserId,
      email: 'nonmember@example.com',
      name: 'Non Member',
      role: 'researcher',
      plan: 'team',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: 'da-nonmember' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(nonMemberUser);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      owner: { id: userId, name: 'Team Owner', email: 'teamowner@example.com' },
      members: [{ userId, role: 'owner', user: { id: userId, name: 'Team Owner', email: 'teamowner@example.com' } }],
    });

    const res = await request(app).get(`/api/teams/${teamId}`).set('Authorization', `Bearer ${nonMemberJwt}`);

    expect(res.status).toBe(403);
  });

  // ─── 6. POST /teams/:id/members rejects duplicate invite ───
  it('POST /api/teams/:id/members rejects already-member invite', async () => {
    const targetUser = { id: 'user-dup', email: 'dup@example.com', name: 'Dup User' };

    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      members: [{ userId, role: 'owner' }],
    });

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser }) // auth middleware
      .mockResolvedValueOnce(targetUser); // find target user

    // Simulate the unique-violation Prisma throws when the team+user pair
    // already exists. The route catches P2002 and maps it to 409. This is
    // atomic — prior implementation had a findUnique + create race that
    // could surface as a 500 under concurrent invites.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p2002: any = new Error('Unique constraint violation');
    p2002.code = 'P2002';
    mockPrisma.teamMember.create.mockRejectedValue(p2002);

    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${teamJwt}`)
      .send({ email: 'dup@example.com', role: 'member' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  // ─── 7. POST /teams/:id/members rejects non-owner/admin ───
  it('POST /api/teams/:id/members rejects non-owner/admin', async () => {
    const memberUserId = 'user-regular-member';
    const memberJwt = signUserToken(memberUserId, 'researcher', 'team');
    const memberUser = {
      id: memberUserId,
      email: 'member@example.com',
      name: 'Regular Member',
      role: 'researcher',
      plan: 'team',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: 'da-member' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(memberUser);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      members: [
        { userId, role: 'owner' },
        { userId: memberUserId, role: 'member' },
      ],
    });

    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${memberJwt}`)
      .send({ email: 'new@example.com', role: 'member' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── 8. POST /teams/:id/members rejects self-invite ───
  it('POST /api/teams/:id/members rejects self-invite', async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      members: [{ userId, role: 'owner' }],
    });

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser }) // auth middleware
      .mockResolvedValueOnce({ ...mockUser }); // target user is same user

    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${teamJwt}`)
      .send({ email: 'teamowner@example.com', role: 'member' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 9. POST /teams/:id/members invite with invalid email ───
  it('POST /api/teams/:id/members rejects invalid email', async () => {
    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${teamJwt}`)
      .send({ email: 'not-an-email', role: 'member' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 10. POST /teams/:id/members returns 404 for unknown user email ───
  it('POST /api/teams/:id/members returns 404 for unknown email', async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      members: [{ userId, role: 'owner' }],
    });

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser }) // auth middleware
      .mockResolvedValueOnce(null); // target user not found

    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${teamJwt}`)
      .send({ email: 'unknown@example.com', role: 'member' });

    expect(res.status).toBe(404);
  });

  // ─── 11. DELETE /teams/:id/members/:userId cannot remove owner ───
  it('DELETE /api/teams/:id/members/:userId cannot remove owner', async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      members: [
        { userId, role: 'owner' },
        { userId: 'user-m2', role: 'member' },
      ],
    });

    const res = await request(app)
      .delete(`/api/teams/${teamId}/members/${userId}`)
      .set('Authorization', `Bearer ${teamJwt}`);

    expect(res.status).toBe(400);
    expect(mockPrisma.teamMember.deleteMany).not.toHaveBeenCalled();
  });

  // ─── 12. DELETE /teams/:id/members/:userId non-admin cannot remove others ───
  it('DELETE /api/teams/:id/members/:userId non-admin cannot remove others', async () => {
    const memberUserId = 'user-regular-2';
    const memberJwt = signUserToken(memberUserId, 'researcher', 'team');
    const memberUser = {
      id: memberUserId,
      email: 'regular2@example.com',
      name: 'Regular Member',
      role: 'researcher',
      plan: 'team',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: 'da-regular-2' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(memberUser);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      members: [
        { userId, role: 'owner' },
        { userId: memberUserId, role: 'member' },
        { userId: 'user-target', role: 'member' },
      ],
    });

    const res = await request(app)
      .delete(`/api/teams/${teamId}/members/user-target`)
      .set('Authorization', `Bearer ${memberJwt}`);

    expect(res.status).toBe(403);
    expect(mockPrisma.teamMember.deleteMany).not.toHaveBeenCalled();
  });

  // ─── 13. Member can self-remove from team ───
  it('DELETE /api/teams/:id/members/:userId allows self-removal', async () => {
    const memberUserId = 'user-self-remove';
    const memberJwt = signUserToken(memberUserId, 'researcher', 'team');
    const memberUser = {
      id: memberUserId,
      email: 'selfremove@example.com',
      name: 'Self Remover',
      role: 'researcher',
      plan: 'team',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: 'da-self-remove' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(memberUser);

    mockPrisma.team.findUnique.mockResolvedValue({
      id: teamId,
      name: 'Research Lab',
      ownerId: userId,
      members: [
        { userId, role: 'owner' },
        { userId: memberUserId, role: 'member' },
      ],
    });
    mockPrisma.teamMember.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete(`/api/teams/${teamId}/members/${memberUserId}`)
      .set('Authorization', `Bearer ${memberJwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── 14. Free plan user cannot list teams (GET /teams still works but POST blocked) ───
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

  // ─── 15. Free plan user cannot invite members ───
  it('POST /api/teams/:id/members by free-plan user returns 403', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockFreeUser });

    const res = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${freeJwt}`)
      .send({ email: 'invite@example.com', role: 'member' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
