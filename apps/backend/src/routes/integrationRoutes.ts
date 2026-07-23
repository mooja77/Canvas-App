import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { checkIntegrationsAccess } from '../middleware/planLimits.js';
import { validateParams, integrationIdParam } from '../middleware/validation.js';

export const integrationRoutes = Router();

// All integration routes require integration access
integrationRoutes.use('/integrations', checkIntegrationsAccess());

// GET /api/integrations — List user's integrations
integrationRoutes.get('/integrations', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);

    const integrations = await prisma.integration.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        provider: true,
        metadata: true,
        expiresAt: true,
        createdAt: true,
        // Do NOT return accessToken or refreshToken
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, integrations });
  } catch (err) {
    next(err);
  }
});

// POST /api/integrations/connect — intentionally unavailable until each
// provider has a real server-side OAuth callback. Accepting arbitrary bearer
// tokens from the browser creates a credential-exfiltration surface and gives
// users the false impression that a functional integration exists.
integrationRoutes.post('/integrations/connect', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);
    throw new AppError('External integrations are not available yet', 501);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/integrations/:id — Disconnect integration
integrationRoutes.delete('/integrations/:id', validateParams(integrationIdParam), async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);

    const integration = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!integration) throw new AppError('Integration not found', 404);
    if (integration.userId !== userId) throw new AppError('Access denied', 403);

    await prisma.integration.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
