import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthUserId } from '../utils/routeHelpers.js';
import { validate, validateParams } from '../middleware/validation.js';
import { generateReport } from '../utils/reportGenerator.js';
import { z } from 'zod';

export const reportRoutes = Router();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaReportSchedule = (prisma as any).reportSchedule;

const scheduleIdParam = z.object({ id: z.string().min(1).max(64) });

const createScheduleSchema = z.object({
  canvasId: z.string().max(64).optional(),
  teamId: z.string().max(64).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
});

function requireUserId(req: import('express').Request): string {
  const userId = getAuthUserId(req);
  if (!userId) throw new AppError('Email authentication required', 401);
  return userId;
}

// ─── POST /api/reports/schedule — Create scheduled report config ───
reportRoutes.post('/reports/schedule', validate(createScheduleSchema), async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { canvasId, teamId, frequency, dayOfWeek } = req.body;

    const schedule = await prismaReportSchedule.create({
      data: {
        userId,
        canvasId: canvasId || null,
        teamId: teamId || null,
        frequency,
        dayOfWeek: dayOfWeek ?? (frequency === 'weekly' ? 1 : null),
        enabled: true,
      },
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (err) { next(err); }
});

// ─── GET /api/reports/schedules — List user's report schedules ───
reportRoutes.get('/reports/schedules', async (req, res, next) => {
  try {
    const userId = requireUserId(req);

    const schedules = await prismaReportSchedule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: schedules });
  } catch (err) { next(err); }
});

// ─── DELETE /api/reports/schedules/:id — Cancel/delete a schedule ───
reportRoutes.delete('/reports/schedules/:id', validateParams(scheduleIdParam), async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.params;

    const schedule = await prismaReportSchedule.findUnique({ where: { id } });
    if (!schedule) throw new AppError('Schedule not found', 404);
    if (schedule.userId !== userId) throw new AppError('Access denied', 403);

    await prismaReportSchedule.delete({ where: { id } });

    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) { next(err); }
});

// ─── PUT /api/reports/schedules/:id — Update schedule (enable/disable, frequency) ───
reportRoutes.put('/reports/schedules/:id', validateParams(scheduleIdParam), async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.params;

    const schedule = await prismaReportSchedule.findUnique({ where: { id } });
    if (!schedule) throw new AppError('Schedule not found', 404);
    if (schedule.userId !== userId) throw new AppError('Access denied', 403);

    const updates: Record<string, unknown> = {};
    if (req.body.frequency !== undefined) updates.frequency = req.body.frequency;
    if (req.body.dayOfWeek !== undefined) updates.dayOfWeek = req.body.dayOfWeek;
    if (req.body.enabled !== undefined) updates.enabled = Boolean(req.body.enabled);

    const updated = await prismaReportSchedule.update({
      where: { id },
      data: updates,
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── POST /api/reports/generate — Generate report on-demand ───
reportRoutes.post('/reports/generate', async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const canvasId = req.body.canvasId || null;

    const { html, subject } = await generateReport(userId, canvasId);

    res.json({ success: true, data: { html, subject } });
  } catch (err) { next(err); }
});
