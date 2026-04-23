import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthUserId } from '../utils/routeHelpers.js';
import { validate, validateParams } from '../middleware/validation.js';
import { mutationLimiter } from '../middleware/rateLimiters.js';
import { z } from 'zod';
import ical, { ICalCalendarMethod, ICalEventTransparency } from 'ical-generator';

export const calendarRoutes = Router();

// Prisma client delegate (typed as any until prisma generate)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaCalendarEvent = (prisma as any).calendarEvent;

// ─── Validation schemas ───

const createCalendarEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), 'Invalid start date'),
  endDate: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), 'Invalid end date')
    .optional(),
  allDay: z.boolean().optional().default(false),
  type: z.enum(['milestone', 'deadline', 'session', 'review']).optional().default('milestone'),
  color: z.string().max(20).optional(),
  reminder: z.number().int().min(0).max(10080).optional(), // max 1 week
  canvasId: z.string().max(64).optional(),
  teamId: z.string().max(64).optional(),
});

const updateCalendarEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  startDate: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), 'Invalid start date')
    .optional(),
  endDate: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), 'Invalid end date')
    .optional()
    .nullable(),
  allDay: z.boolean().optional(),
  type: z.enum(['milestone', 'deadline', 'session', 'review']).optional(),
  color: z.string().max(20).optional().nullable(),
  reminder: z.number().int().min(0).max(10080).optional().nullable(),
  canvasId: z.string().max(64).optional().nullable(),
  teamId: z.string().max(64).optional().nullable(),
});

const eventIdParam = z.object({ id: z.string().min(1).max(64) });

/** Require email-authenticated user */
function requireUser(req: import('express').Request): string {
  const userId = getAuthUserId(req);
  if (!userId) {
    throw new AppError('Email authentication required for calendar features', 401);
  }
  return userId;
}

// ─── GET /api/calendar/events — list events ───
calendarRoutes.get('/calendar/events', async (req, res, next) => {
  try {
    const userId = requireUser(req);

    const { from, to, type, canvasId } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId };

    if (from || to) {
      where.startDate = {};
      if (from) where.startDate.gte = new Date(from as string);
      if (to) where.startDate.lte = new Date(to as string);
    }

    if (type) where.type = type as string;
    if (canvasId) where.canvasId = canvasId as string;

    const events = await prismaCalendarEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
      take: 200,
    });

    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/calendar/events — create event ───
calendarRoutes.post(
  '/calendar/events',
  mutationLimiter,
  validate(createCalendarEventSchema),
  async (req, res, next) => {
    try {
      const userId = requireUser(req);
      const { title, description, startDate, endDate, allDay, type, color, reminder, canvasId, teamId } = req.body;

      const event = await prismaCalendarEvent.create({
        data: {
          userId,
          title,
          description: description || null,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          allDay: allDay || false,
          type: type || 'milestone',
          color: color || null,
          reminder: reminder ?? null,
          canvasId: canvasId || null,
          teamId: teamId || null,
        },
      });

      res.status(201).json({ success: true, data: event });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PUT /api/calendar/events/:id — update event ───
calendarRoutes.put(
  '/calendar/events/:id',
  mutationLimiter,
  validateParams(eventIdParam),
  validate(updateCalendarEventSchema),
  async (req, res, next) => {
    try {
      const userId = requireUser(req);
      const { id } = req.params;

      const existing = await prismaCalendarEvent.findUnique({ where: { id } });
      if (!existing) throw new AppError('Event not found', 404);
      if (existing.userId !== userId) throw new AppError('Access denied', 403);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {};
      const { title, description, startDate, endDate, allDay, type, color, reminder, canvasId, teamId } = req.body;

      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (startDate !== undefined) data.startDate = new Date(startDate);
      if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
      if (allDay !== undefined) data.allDay = allDay;
      if (type !== undefined) data.type = type;
      if (color !== undefined) data.color = color;
      if (reminder !== undefined) data.reminder = reminder;
      if (canvasId !== undefined) data.canvasId = canvasId;
      if (teamId !== undefined) data.teamId = teamId;

      const updated = await prismaCalendarEvent.update({
        where: { id },
        data,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /api/calendar/events/:id — delete event ───
calendarRoutes.delete('/calendar/events/:id', mutationLimiter, validateParams(eventIdParam), async (req, res, next) => {
  try {
    const userId = requireUser(req);
    const { id } = req.params;

    const existing = await prismaCalendarEvent.findUnique({ where: { id } });
    if (!existing) throw new AppError('Event not found', 404);
    if (existing.userId !== userId) throw new AppError('Access denied', 403);

    await prismaCalendarEvent.delete({ where: { id } });

    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/calendar/export.ics — export iCal file ───
calendarRoutes.get('/calendar/export.ics', async (req, res, next) => {
  try {
    const userId = requireUser(req);

    const events = await prismaCalendarEvent.findMany({
      where: { userId },
      orderBy: { startDate: 'asc' },
    });

    const calendar = ical({
      name: 'QualCanvas Research Calendar',
      prodId: { company: 'QualCanvas', product: 'Research Calendar', language: 'EN' },
      method: ICalCalendarMethod.PUBLISH,
      timezone: 'UTC',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const evt of events as any[]) {
      const calEvent = calendar.createEvent({
        id: evt.id,
        start: evt.startDate,
        end: evt.endDate || evt.startDate,
        allDay: evt.allDay,
        summary: evt.title,
        description: evt.description || undefined,
        transparency: ICalEventTransparency.OPAQUE,
        stamp: evt.createdAt,
      });

      // Add alarm/reminder if set
      if (evt.reminder && evt.reminder > 0) {
        calEvent.createAlarm({
          type: 'display' as import('ical-generator').ICalAlarmType,
          trigger: evt.reminder * 60, // seconds before
          description: `Reminder: ${evt.title}`,
        });
      }
    }

    const icsString = calendar.toString();

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="qualcanvas-calendar.ics"');
    res.send(icsString);
  } catch (err) {
    next(err);
  }
});
