import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import {
  validateParams,
  canvasIdParam,
  canvasIdDocIdParams,
  canvasIdDocIdRegionIdParams,
} from '../middleware/validation.js';

export const documentRoutes = Router();

// ─── Documents ───

// POST /canvas/:id/documents — create document (link to existing FileUpload)
documentRoutes.post('/canvas/:id/documents', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const { fileUploadId, title, docType, pageCount, metadata } = req.body;

    if (!fileUploadId || !title || !docType) {
      return next(new AppError('fileUploadId, title, and docType are required', 400));
    }
    if (!['image', 'pdf'].includes(docType)) {
      return next(new AppError('docType must be "image" or "pdf"', 400));
    }

    // Verify the file upload exists
    const fileUpload = await prisma.fileUpload.findUnique({ where: { id: fileUploadId } });
    if (!fileUpload) {
      return next(new AppError('FileUpload not found', 404));
    }

    const document = await prisma.canvasDocument.create({
      data: {
        canvasId: req.params.id,
        fileUploadId,
        title,
        docType,
        pageCount: pageCount || 1,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
      },
    });

    res.status(201).json({
      success: true,
      data: { ...document, metadata: safeJsonParse(document.metadata) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /canvas/:id/documents — list documents
documentRoutes.get('/canvas/:id/documents', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const documents = await prisma.canvasDocument.findMany({
      where: { canvasId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: documents.map((d) => ({ ...d, metadata: safeJsonParse(d.metadata) })),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /canvas/:id/documents/:docId — delete document
documentRoutes.delete('/canvas/:id/documents/:docId', validateParams(canvasIdDocIdParams), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const doc = await prisma.canvasDocument.findUnique({ where: { id: req.params.docId } });
    if (!doc || doc.canvasId !== req.params.id) {
      return next(new AppError('Document not found', 404));
    }

    await prisma.canvasDocument.delete({ where: { id: req.params.docId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Region Codings ───

// POST /canvas/:id/documents/:docId/regions — create region coding
documentRoutes.post(
  '/canvas/:id/documents/:docId/regions',
  validateParams(canvasIdDocIdParams),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

      const doc = await prisma.canvasDocument.findUnique({ where: { id: req.params.docId } });
      if (!doc || doc.canvasId !== req.params.id) {
        return next(new AppError('Document not found', 404));
      }

      const { questionId, pageNumber, x, y, width, height, note } = req.body;

      if (!questionId || x === undefined || y === undefined || width === undefined || height === undefined) {
        return next(new AppError('questionId, x, y, width, and height are required', 400));
      }

      // Verify question belongs to this canvas
      const question = await prisma.canvasQuestion.findUnique({ where: { id: questionId } });
      if (!question || question.canvasId !== req.params.id) {
        return next(new AppError('Question not found in this canvas', 400));
      }

      const region = await prisma.documentRegionCoding.create({
        data: {
          documentId: req.params.docId,
          questionId,
          pageNumber: pageNumber || 1,
          x,
          y,
          width,
          height,
          note: note || null,
        },
      });

      res.status(201).json({ success: true, data: region });
    } catch (err) {
      next(err);
    }
  },
);

// GET /canvas/:id/documents/:docId/regions — list region codings
documentRoutes.get(
  '/canvas/:id/documents/:docId/regions',
  validateParams(canvasIdDocIdParams),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

      const doc = await prisma.canvasDocument.findUnique({ where: { id: req.params.docId } });
      if (!doc || doc.canvasId !== req.params.id) {
        return next(new AppError('Document not found', 404));
      }

      const regions = await prisma.documentRegionCoding.findMany({
        where: { documentId: req.params.docId },
        orderBy: { createdAt: 'asc' },
      });

      res.json({ success: true, data: regions });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /canvas/:id/documents/:docId/regions/:regionId — delete region coding
documentRoutes.delete(
  '/canvas/:id/documents/:docId/regions/:regionId',
  validateParams(canvasIdDocIdRegionIdParams),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

      const region = await prisma.documentRegionCoding.findUnique({ where: { id: req.params.regionId } });
      if (!region || region.documentId !== req.params.docId) {
        return next(new AppError('Region coding not found', 404));
      }

      await prisma.documentRegionCoding.delete({ where: { id: req.params.regionId } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);
