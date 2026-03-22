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

// POST /api/integrations/connect — Connect integration (OAuth skeleton)
integrationRoutes.post('/integrations/connect', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);

    const { provider, accessToken, refreshToken, metadata, expiresAt } = req.body;
    if (!provider || !accessToken) {
      throw new AppError('Provider and accessToken are required', 400);
    }

    const validProviders = ['zoom', 'slack', 'qualtrics'];
    if (!validProviders.includes(provider)) {
      throw new AppError(`Invalid provider. Must be one of: ${validProviders.join(', ')}`, 400);
    }

    const integration = await prisma.integration.upsert({
      where: { userId_provider: { userId, provider } },
      update: {
        accessToken,
        refreshToken: refreshToken || null,
        metadata: JSON.stringify(metadata || {}),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      create: {
        userId,
        provider,
        accessToken,
        refreshToken: refreshToken || null,
        metadata: JSON.stringify(metadata || {}),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    res.json({
      success: true,
      integration: {
        id: integration.id,
        userId: integration.userId,
        provider: integration.provider,
        metadata: integration.metadata,
        expiresAt: integration.expiresAt,
        createdAt: integration.createdAt,
      },
    });
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
