import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthUserId } from '../utils/routeHelpers.js';
import { safeJsonParse } from '../utils/routeHelpers.js';
import { validateParams } from '../middleware/validation.js';
import { z } from 'zod';

export const notificationRoutes = Router();

const prismaNotification = prisma.notification;

const notificationIdParam = z.object({ id: z.string().min(1).max(64) });

function requireUserId(req: import('express').Request): string {
  const userId = getAuthUserId(req);
  if (!userId) throw new AppError('Email authentication required', 401);
  return userId;
}

// ─── GET /api/notifications — List user's notifications (paginated) ───
notificationRoutes.get('/notifications', async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === 'true';

    const where = {
      userId,
      ...(unreadOnly ? { read: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prismaNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prismaNotification.count({ where }),
      prismaNotification.count({ where: { userId, read: false } }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = notifications.map((n: any) => ({
      ...n,
      metadata: safeJsonParse(n.metadata, {}),
    }));

    res.json({
      success: true,
      data: parsed,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      unreadCount,
    });
  } catch (err) { next(err); }
});

// ─── PUT /api/notifications/:id/read — Mark single notification as read ───
notificationRoutes.put('/notifications/:id/read', validateParams(notificationIdParam), async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.params;

    const notification = await prismaNotification.findUnique({ where: { id } });
    if (!notification) throw new AppError('Notification not found', 404);
    if (notification.userId !== userId) throw new AppError('Access denied', 403);

    await prismaNotification.update({
      where: { id },
      data: { read: true },
    });

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) { next(err); }
});

// ─── PUT /api/notifications/read-all — Mark all notifications as read ───
notificationRoutes.put('/notifications/read-all', async (req, res, next) => {
  try {
    const userId = requireUserId(req);

    await prismaNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

// ─── DELETE /api/notifications/:id — Delete a notification ───
notificationRoutes.delete('/notifications/:id', validateParams(notificationIdParam), async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    const { id } = req.params;

    const notification = await prismaNotification.findUnique({ where: { id } });
    if (!notification) throw new AppError('Notification not found', 404);
    if (notification.userId !== userId) throw new AppError('Access denied', 403);

    await prismaNotification.delete({ where: { id } });

    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) { next(err); }
});
