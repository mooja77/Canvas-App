import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthUserId } from '../utils/routeHelpers.js';
import { getPlanLimits } from '../config/plans.js';
import { validate, validateParams } from '../middleware/validation.js';
import { teamIdParam, createTeamSchema, inviteMemberSchema, teamIdUserIdParams } from '../middleware/validation.js';
import { sendTeamInviteEmail } from '../lib/email.js';
import { notifyTeamInvite } from '../utils/notifications.js';

export const teamRoutes = Router();

// Prisma client delegates for Team/TeamMember models
// These are typed as any until `prisma generate` is re-run after schema update.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaTeam = (prisma as any).team;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaTeamMember = (prisma as any).teamMember;

/** Require email-authenticated user with Team plan */
function requireTeamPlan(req: import('express').Request): string {
  const userId = getAuthUserId(req);
  if (!userId) {
    throw new AppError('Email authentication required for team features', 401);
  }
  const plan = req.userPlan || 'free';
  const limits = getPlanLimits(plan);
  if (!limits.intercoderEnabled) {
    throw new AppError(
      `Team features require a Team plan (current: ${plan})`,
      403,
    );
  }
  return userId;
}

// ─── POST /api/teams — Create a team ───
teamRoutes.post('/teams', validate(createTeamSchema), async (req, res, next) => {
  try {
    const userId = requireTeamPlan(req);
    const { name } = req.body;

    const team = await prismaTeam.create({
      data: {
        name,
        ownerId: userId,
        members: {
          create: { userId, role: 'owner' },
        },
      },
      include: { members: true },
    });

    res.status(201).json({ success: true, data: team });
  } catch (err) { next(err); }
});

// ─── GET /api/teams — List user's teams ───
teamRoutes.get('/teams', async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) throw new AppError('Email authentication required', 401);

    const memberships = await prismaTeamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teams = memberships.map((m: any) => ({
      ...m.team,
      myRole: m.role,
      memberCount: m.team._count.members,
    }));

    res.json({ success: true, data: teams });
  } catch (err) { next(err); }
});

// ─── GET /api/teams/:teamId — Get team details + members ───
teamRoutes.get('/teams/:teamId', validateParams(teamIdParam), async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) throw new AppError('Email authentication required', 401);

    const team = await prismaTeam.findUnique({
      where: { id: req.params.teamId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!team) throw new AppError('Team not found', 404);

    // Must be a member to view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isMember = team.members.some((m: any) => m.userId === userId);
    if (!isMember) throw new AppError('Access denied', 403);

    res.json({ success: true, data: team });
  } catch (err) { next(err); }
});

// ─── POST /api/teams/:teamId/members — Invite member by email ───
teamRoutes.post('/teams/:teamId/members', validateParams(teamIdParam), validate(inviteMemberSchema), async (req, res, next) => {
  try {
    const userId = requireTeamPlan(req);
    const { teamId } = req.params;
    const { email, role } = req.body;

    // Verify team exists and user is owner or admin
    const team = await prismaTeam.findUnique({
      where: { id: teamId },
      include: { members: true },
    });
    if (!team) throw new AppError('Team not found', 404);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callerMembership = team.members.find((m: any) => m.userId === userId);
    if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
      throw new AppError('Only team owners and admins can invite members', 403);
    }

    // Find user by email
    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      throw new AppError('No user found with that email address', 404);
    }

    if (targetUser.id === userId) {
      throw new AppError('Cannot invite yourself', 400);
    }

    // Check if already a member
    const existing = await prismaTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUser.id } },
    });
    if (existing) {
      throw new AppError('User is already a member of this team', 409);
    }

    const validRoles = ['admin', 'member'];
    const assignedRole = validRoles.includes(role) ? role : 'member';

    const member = await prismaTeamMember.create({
      data: {
        teamId,
        userId: targetUser.id,
        role: assignedRole,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Send invitation email (best effort)
    const appUrl = process.env.APP_URL || 'http://localhost:5174';
    await sendTeamInviteEmail(email, team.name, `${appUrl}/login`).catch((err: unknown) => {
      console.error('[TeamRoutes] Failed to send invite email:', err);
    });

    // Create in-app notification for the invited user
    const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await notifyTeamInvite(targetUser.id, inviter?.name || 'Someone', teamId, team.name).catch(() => {});

    res.status(201).json({ success: true, data: member });
  } catch (err) { next(err); }
});

// ─── DELETE /api/teams/:teamId/members/:userId — Remove member ───
teamRoutes.delete('/teams/:teamId/members/:userId', validateParams(teamIdUserIdParams), async (req, res, next) => {
  try {
    const callerId = getAuthUserId(req);
    if (!callerId) throw new AppError('Email authentication required', 401);

    const { teamId, userId: targetUserId } = req.params;

    const team = await prismaTeam.findUnique({
      where: { id: teamId },
      include: { members: true },
    });
    if (!team) throw new AppError('Team not found', 404);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callerMembership = team.members.find((m: any) => m.userId === callerId);
    const isSelfRemoval = callerId === targetUserId;
    const isOwnerOrAdmin = callerMembership && ['owner', 'admin'].includes(callerMembership.role);

    if (!isSelfRemoval && !isOwnerOrAdmin) {
      throw new AppError('Only team owners and admins can remove members', 403);
    }

    // Cannot remove the team owner
    if (targetUserId === team.ownerId) {
      throw new AppError('Cannot remove the team owner', 400);
    }

    const deleted = await prismaTeamMember.deleteMany({
      where: { teamId, userId: targetUserId },
    });

    if (deleted.count === 0) {
      throw new AppError('Member not found in this team', 404);
    }

    res.json({ success: true, message: 'Member removed' });
  } catch (err) { next(err); }
});

// ─── DELETE /api/teams/:teamId — Delete team (owner only) ───
teamRoutes.delete('/teams/:teamId', validateParams(teamIdParam), async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) throw new AppError('Email authentication required', 401);

    const team = await prismaTeam.findUnique({ where: { id: req.params.teamId } });
    if (!team) throw new AppError('Team not found', 404);

    if (team.ownerId !== userId) {
      throw new AppError('Only the team owner can delete the team', 403);
    }

    await prismaTeam.delete({ where: { id: team.id } });

    res.json({ success: true, message: 'Team deleted' });
  } catch (err) { next(err); }
});
