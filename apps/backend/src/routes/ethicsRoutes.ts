import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/auditLog.js';
import { validate, updateEthicsSchema, createConsentSchema, withdrawConsentSchema, anonymizeTranscriptSchema } from '../middleware/validation.js';
import { sha256 } from '../utils/hashing.js';
import { getAuthId, getOwnedCanvas } from '../utils/routeHelpers.js';

export const ethicsRoutes = Router();

// ─── Ethics Settings ───

// GET /api/canvas/:canvasId/ethics - Get ethics settings
ethicsRoutes.get('/canvas/:canvasId/ethics', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const canvas = await getOwnedCanvas(req.params.canvasId, dashboardAccessId);

    const consentRecords = await prisma.consentRecord.findMany({
      where: { canvasId: canvas.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        ethicsApprovalId: canvas.ethicsApprovalId,
        ethicsStatus: canvas.ethicsStatus,
        dataRetentionDate: canvas.dataRetentionDate,
        consentRecords,
      },
    });
  } catch (err) { next(err); }
});

// PUT /api/canvas/:canvasId/ethics - Update ethics settings
ethicsRoutes.put('/canvas/:canvasId/ethics', validate(updateEthicsSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.canvasId, dashboardAccessId);

    const { ethicsApprovalId, ethicsStatus, dataRetentionDate } = req.body;
    const updateData: Record<string, unknown> = {};
    if (ethicsApprovalId !== undefined) updateData.ethicsApprovalId = ethicsApprovalId;
    if (ethicsStatus !== undefined) updateData.ethicsStatus = ethicsStatus;
    if (dataRetentionDate !== undefined) {
      updateData.dataRetentionDate = dataRetentionDate ? new Date(dataRetentionDate) : null;
    }

    const updated = await prisma.codingCanvas.update({
      where: { id: req.params.canvasId },
      data: updateData,
    });

    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    logAudit({
      action: 'ethics.update',
      resource: 'canvas',
      resourceId: req.params.canvasId,
      actorType: 'researcher',
      actorId: dashboardAccessId,
      ip: sha256(rawIp),
      method: 'PUT',
      path: req.originalUrl,
      meta: JSON.stringify({ ethicsApprovalId, ethicsStatus, dataRetentionDate }),
    });

    res.json({
      success: true,
      data: {
        ethicsApprovalId: updated.ethicsApprovalId,
        ethicsStatus: updated.ethicsStatus,
        dataRetentionDate: updated.dataRetentionDate,
      },
    });
  } catch (err) { next(err); }
});

// ─── Consent Records ───

// POST /api/canvas/:canvasId/consent - Record participant consent
ethicsRoutes.post('/canvas/:canvasId/consent', validate(createConsentSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.canvasId, dashboardAccessId);

    const { participantId, consentType, ethicsProtocol, notes } = req.body;

    const record = await prisma.consentRecord.create({
      data: {
        canvasId: req.params.canvasId,
        participantId,
        consentType: consentType || 'informed',
        ethicsProtocol: ethicsProtocol || null,
        notes: notes || null,
      },
    });

    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    logAudit({
      action: 'consent.create',
      resource: 'consent',
      resourceId: record.id,
      actorType: 'researcher',
      actorId: dashboardAccessId,
      ip: sha256(rawIp),
      method: 'POST',
      path: req.originalUrl,
      meta: JSON.stringify({ canvasId: req.params.canvasId, participantId, consentType: record.consentType }),
    });

    res.status(201).json({ success: true, data: record });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return next(new AppError('Consent record already exists for this participant in this canvas', 409));
    }
    next(err);
  }
});

// GET /api/canvas/:canvasId/consent - List consent records
ethicsRoutes.get('/canvas/:canvasId/consent', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.canvasId, dashboardAccessId);

    const records = await prisma.consentRecord.findMany({
      where: { canvasId: req.params.canvasId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: records });
  } catch (err) { next(err); }
});

// PUT /api/canvas/:canvasId/consent/:consentId/withdraw - Withdraw consent
ethicsRoutes.put('/canvas/:canvasId/consent/:consentId/withdraw', validate(withdrawConsentSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.canvasId, dashboardAccessId);

    const existing = await prisma.consentRecord.findUnique({
      where: { id: req.params.consentId },
    });
    if (!existing || existing.canvasId !== req.params.canvasId) {
      throw new AppError('Consent record not found', 404);
    }
    if (existing.consentStatus === 'withdrawn') {
      throw new AppError('Consent has already been withdrawn', 400);
    }

    const { notes } = req.body || {};

    const updated = await prisma.consentRecord.update({
      where: { id: req.params.consentId },
      data: {
        consentStatus: 'withdrawn',
        withdrawalDate: new Date(),
        notes: notes || existing.notes,
      },
    });

    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    logAudit({
      action: 'consent.withdraw',
      resource: 'consent',
      resourceId: updated.id,
      actorType: 'researcher',
      actorId: dashboardAccessId,
      ip: sha256(rawIp),
      method: 'PUT',
      path: req.originalUrl,
      meta: JSON.stringify({ canvasId: req.params.canvasId, participantId: updated.participantId }),
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── Audit Log Export ───

// GET /api/audit-log - Export audit trail (own data only)
ethicsRoutes.get('/audit-log', async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);

    const { from, to, action, resource, limit, offset } = req.query;

    const where: Record<string, unknown> = {
      actorId: dashboardAccessId,
    };

    if (from || to) {
      const timestamp: Record<string, Date> = {};
      if (from) timestamp.gte = new Date(from as string);
      if (to) timestamp.lte = new Date(to as string);
      where.timestamp = timestamp;
    }
    if (action) where.action = action as string;
    if (resource) where.resource = resource as string;

    const take = Math.min(parseInt(limit as string) || 100, 1000);
    const skip = parseInt(offset as string) || 0;

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        entries,
        total,
        limit: take,
        offset: skip,
      },
    });
  } catch (err) { next(err); }
});

// ─── Transcript Anonymization ───

// POST /api/canvas/:canvasId/transcripts/:transcriptId/anonymize - Anonymize transcript
ethicsRoutes.post('/canvas/:canvasId/transcripts/:transcriptId/anonymize', validate(anonymizeTranscriptSchema), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.canvasId, dashboardAccessId);

    const { replacements } = req.body;

    const transcript = await prisma.canvasTranscript.findUnique({
      where: { id: req.params.transcriptId },
    });
    if (!transcript || transcript.canvasId !== req.params.canvasId) {
      throw new AppError('Transcript not found in this canvas', 404);
    }

    // Apply replacements to transcript content
    let newContent = transcript.content;
    for (const { find, replace } of replacements) {
      newContent = newContent.split(find).join(replace);
    }

    // Apply replacements to all coded segments referencing this transcript
    const codings = await prisma.canvasTextCoding.findMany({
      where: { transcriptId: transcript.id },
    });

    const codingUpdates = codings
      .map((coding) => {
        let newCodedText = coding.codedText;
        for (const { find, replace } of replacements) {
          newCodedText = newCodedText.split(find).join(replace);
        }
        if (newCodedText !== coding.codedText) {
          return prisma.canvasTextCoding.update({
            where: { id: coding.id },
            data: { codedText: newCodedText },
          });
        }
        return null;
      })
      .filter(Boolean);

    // Execute all updates in a transaction
    await prisma.$transaction([
      prisma.canvasTranscript.update({
        where: { id: transcript.id },
        data: {
          content: newContent,
          isAnonymized: true,
        },
      }),
      ...codingUpdates as any[],
    ]);

    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    logAudit({
      action: 'transcript.anonymize',
      resource: 'transcript',
      resourceId: transcript.id,
      actorType: 'researcher',
      actorId: dashboardAccessId,
      ip: sha256(rawIp),
      method: 'POST',
      path: req.originalUrl,
      meta: JSON.stringify({
        canvasId: req.params.canvasId,
        replacementCount: replacements.length,
        codingsUpdated: codingUpdates.length,
      }),
    });

    const updatedTranscript = await prisma.canvasTranscript.findUnique({
      where: { id: transcript.id },
    });

    res.json({ success: true, data: updatedTranscript });
  } catch (err) { next(err); }
});
