/**
 * Integration credential routes — provider connections are RETIRED.
 *
 * There was never a real OAuth flow here. POST /integrations/connect accepted
 * an access token supplied in the request body, encrypted it and stored it;
 * nothing ever read it back out, and no provider integration was ever built.
 * That endpoint is gone (410) and no new credentials can be created.
 *
 * List and delete deliberately REMAIN, and deliberately are NOT plan-gated.
 * Earlier builds may have written encrypted provider tokens into the
 * Integration table while the capability was advertised on the Team plan.
 * Those rows belong to the user: they must be able to see that something is
 * held and to delete it, whatever plan they are on today. Gating these behind
 * checkIntegrationsAccess() — now false on every plan — would strand a user's
 * own credentials with no route to revoke them.
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateParams, integrationIdParam } from '../middleware/validation.js';
import { logAudit } from '../middleware/auditLog.js';
import { sha256 } from '../utils/hashing.js';

export const integrationRoutes = Router();

// GET /api/integrations — list credentials still held for this user.
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
        // Never select accessToken / refreshToken or their IV/tag columns.
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, integrations, connectionsRetired: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/integrations/connect — withdrawn.
//
// This never was an OAuth flow: it accepted an access token from the request
// body, encrypted it and stored it, which is a credential-exfiltration surface
// and implied a working integration that did not exist. Authenticate first so
// an unauthenticated caller learns nothing about account state, then refuse.
integrationRoutes.post('/integrations/connect', async (req, res, next) => {
  try {
    if (!req.userId) throw new AppError('Email authentication required', 401);
    res.status(410).json({
      success: false,
      error:
        'Provider connections have been retired. QualCanvas does not connect to Zoom, Slack or Qualtrics; import transcripts as files instead.',
      code: 'INTEGRATION_CONNECT_RETIRED',
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/integrations/:id — revoke and erase a stored credential.
integrationRoutes.delete('/integrations/:id', validateParams(integrationIdParam), async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);

    const integration = await prisma.integration.findUnique({ where: { id: req.params.id } });
    if (!integration) throw new AppError('Integration not found', 404);
    if (integration.userId !== userId) throw new AppError('Access denied', 403);

    await prisma.integration.delete({ where: { id: req.params.id } });

    void logAudit({
      action: 'integration.delete',
      resource: 'integration',
      resourceId: req.params.id,
      actorType: 'researcher',
      actorId: userId,
      ip: sha256(req.ip || req.socket.remoteAddress || 'unknown'),
      method: 'DELETE',
      path: req.originalUrl,
      meta: JSON.stringify({ provider: integration.provider }),
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
