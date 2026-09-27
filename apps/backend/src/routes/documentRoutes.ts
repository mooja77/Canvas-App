import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import {
  validateParams,
  canvasIdParam,
  canvasIdDocIdParams,
  canvasIdDocIdRegionIdParams,
  validate,
  createDocumentSchema,
  createRegionSchema,
  updateRegionSchema,
} from '../middleware/validation.js';
import { checkFileUploadAccess } from '../middleware/planLimits.js';
import { storage } from '../lib/storage.js';
import '../lib/storage-s3.js'; // register S3/R2 when configured
import '../lib/storage-local.js'; // register local fallback
import { imageSignatureType, isValidSignature } from '../utils/magicBytes.js';
import { ensureStorageAvailable } from './uploadRoutes.js';

export const documentRoutes = Router();

// ─── Document file upload (PDF / raster image) ───
//
// The region-coding screen needs the page itself, and the generic upload
// endpoint only accepts audio/video. Documents get their own narrow door:
// PDF or PNG/JPEG/GIF/WebP, content-sniffed, stored under the canvas prefix,
// and registered as a FileUpload + CanvasDocument in one request so a failed
// half never leaves an orphan the user cannot see.
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENT_MB = MAX_DOCUMENT_BYTES / (1024 * 1024);
const DOCUMENT_FORMATS_HINT = 'PDF, PNG, JPEG, GIF or WebP';
const VIEWABLE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
});

function uploadSingleDocument(req: Request, res: Response, next: NextFunction): void {
  documentUpload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(`File is too large. The maximum document size is ${MAX_DOCUMENT_MB} MB.`, 413));
      }
      return next(new AppError(`Upload rejected: ${err.message}`, 400));
    }
    return next(err);
  });
}

async function requireCanvasAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    await getOwnedCanvas(req.params.id, getAuthId(req), getAuthUserId(req));
    next();
  } catch (err) {
    next(err);
  }
}

/** Detect the stored type from the bytes, never from the client's claim. */
function sniffDocument(buf: Buffer): { docType: 'image' | 'pdf'; mimeType: string } | null {
  if (isValidSignature(buf, 'pdf')) return { docType: 'pdf', mimeType: 'application/pdf' };
  const image = imageSignatureType(buf);
  if (image) return { docType: 'image', mimeType: image };
  return null;
}

// POST /canvas/:id/documents/upload — upload a PDF or image and register it
documentRoutes.post(
  '/canvas/:id/documents/upload',
  validateParams(canvasIdParam),
  checkFileUploadAccess(),
  requireCanvasAccess,
  uploadSingleDocument,
  async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) return next(new AppError(`Choose a ${DOCUMENT_FORMATS_HINT} file to upload.`, 400));

      const sniffed = sniffDocument(file.buffer);
      if (!sniffed) {
        return next(
          new AppError(`That file is not a supported document. Upload a ${DOCUMENT_FORMATS_HINT} file.`, 415),
        );
      }

      const rawTitle = typeof req.body.title === 'string' ? req.body.title.trim() : '';
      const fallbackTitle = path
        .basename(file.originalname || 'Document')
        .replace(/\.[^.]+$/, '')
        .trim();
      const title = (rawTitle || fallbackTitle || 'Document').slice(0, 200);

      // The browser counts PDF pages with pdf.js before uploading. A missing or
      // silly value falls back to 1 page; images are always a single page.
      const requestedPages = Number.parseInt(String(req.body.pageCount ?? ''), 10);
      const pageCount =
        sniffed.docType === 'pdf' && Number.isInteger(requestedPages) && requestedPages >= 1
          ? Math.min(requestedPages, 10_000)
          : 1;

      await ensureStorageAvailable(req, file.size);

      const ext = sniffed.docType === 'pdf' ? '.pdf' : `.${sniffed.mimeType.split('/')[1].replace('jpeg', 'jpg')}`;
      const key = `canvas/${req.params.id}/${randomBytes(16).toString('hex')}${ext}`;
      const { size } = await storage.upload({ key, body: file.buffer, contentType: sniffed.mimeType });

      try {
        const document = await prisma.$transaction(async (tx) => {
          const fileUpload = await tx.fileUpload.create({
            data: {
              canvasId: req.params.id,
              userId: getAuthUserId(req),
              storageKey: key,
              originalName: (file.originalname || title).slice(0, 255),
              mimeType: sniffed.mimeType,
              sizeBytes: size || file.size,
              status: 'ready',
            },
          });
          return tx.canvasDocument.create({
            data: {
              canvasId: req.params.id,
              fileUploadId: fileUpload.id,
              title,
              docType: sniffed.docType,
              pageCount,
              metadata: JSON.stringify({ mimeType: sniffed.mimeType, sizeBytes: size || file.size }),
            },
          });
        });
        res.status(201).json({ success: true, data: { ...document, metadata: safeJsonParse(document.metadata) } });
      } catch (err) {
        await storage.delete(key).catch(() => undefined);
        throw err;
      }
    } catch (err) {
      next(err);
    }
  },
);

// ─── Documents ───

// POST /canvas/:id/documents — create document (link to existing FileUpload)
documentRoutes.post(
  '/canvas/:id/documents',
  validateParams(canvasIdParam),
  validate(createDocumentSchema),
  async (req, res, next) => {
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

      // Verify the file upload exists AND belongs to this canvas (which the caller
      // owns, checked above) — otherwise a caller could link another tenant's
      // fileUploadId into their own canvas. Mirrors the transcribe route's scoping.
      const fileUpload = await prisma.fileUpload.findUnique({ where: { id: fileUploadId } });
      if (!fileUpload || fileUpload.canvasId !== req.params.id) {
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
  },
);

// GET /canvas/:id/documents — list documents (with a region count per document)
documentRoutes.get('/canvas/:id/documents', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, getAuthUserId(req));

    const documents = await prisma.canvasDocument.findMany({
      where: { canvasId: req.params.id },
      include: { _count: { select: { regionCodings: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: documents.map(({ _count, ...d }) => ({
        ...d,
        metadata: safeJsonParse(d.metadata),
        regionCount: _count.regionCodings,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /canvas/:id/documents/:docId/file — stream the stored page(s)
//
// Fetched by the app as a blob (the auth cookie rides on the XHR), then shown
// through an object URL. Only the sniffed raster/PDF types are ever stored, and
// nosniff + a sandboxing CSP keep the browser from treating the bytes as a page.
documentRoutes.get('/canvas/:id/documents/:docId/file', validateParams(canvasIdDocIdParams), async (req, res, next) => {
  try {
    await getOwnedCanvas(req.params.id, getAuthId(req), getAuthUserId(req));
    const doc = await prisma.canvasDocument.findUnique({ where: { id: req.params.docId } });
    if (!doc || doc.canvasId !== req.params.id) return next(new AppError('Document not found', 404));
    const upload = await prisma.fileUpload.findUnique({ where: { id: doc.fileUploadId } });
    if (!upload || upload.canvasId !== req.params.id) {
      return next(new AppError('The file for this document is missing. Delete it and upload it again.', 404));
    }
    if (!VIEWABLE_TYPES.has(upload.mimeType)) return next(new AppError('Document file type is not viewable', 415));

    const stream = await storage.openReadStream(upload.storageKey).catch(() => null);
    if (!stream) {
      return next(new AppError('The file for this document is missing. Delete it and upload it again.', 404));
    }
    res.setHeader('Content-Type', upload.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    stream.on('error', (err) => next(err));
    stream.pipe(res);
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

    // Remove the stored file too when nothing else still points at it (the
    // regions went with the document by cascade). Best effort: the document is
    // already gone, and a leftover object only costs storage.
    const upload = await prisma.fileUpload.findUnique({
      where: { id: doc.fileUploadId },
      select: { id: true, canvasId: true, storageKey: true, mimeType: true },
    });
    if (upload && upload.canvasId === req.params.id && VIEWABLE_TYPES.has(upload.mimeType)) {
      const [otherDocs, jobs] = await Promise.all([
        prisma.canvasDocument.count({ where: { fileUploadId: upload.id } }),
        prisma.transcriptionJob.count({ where: { fileUploadId: upload.id } }),
      ]);
      if (otherDocs === 0 && jobs === 0) {
        await prisma.fileUpload.delete({ where: { id: upload.id } }).catch(() => undefined);
        await storage.delete(upload.storageKey).catch(() => undefined);
      }
    }
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
  validate(createRegionSchema),
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
      if (width <= 0 || height <= 0 || x + width > 100.0001 || y + height > 100.0001) {
        return next(new AppError('A region must have a size and stay inside the page', 400));
      }
      if (pageNumber !== undefined && pageNumber > doc.pageCount) {
        return next(new AppError(`This document has ${doc.pageCount} page(s)`, 400));
      }

      // Verify question belongs to this canvas
      const question = await prisma.canvasQuestion.findUnique({ where: { id: questionId } });
      if (!question || question.canvasId !== req.params.id) {
        return next(new AppError('Code not found in this canvas', 400));
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
          note: typeof note === 'string' && note.trim() ? note.trim() : null,
        },
      });

      res.status(201).json({ success: true, data: { ...region, codeMissing: false } });
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
        orderBy: [{ pageNumber: 'asc' }, { createdAt: 'asc' }],
      });

      // Region codings have no foreign key to the code, so deleting or merging a
      // code leaves them pointing at nothing. Flag those rows so the screen can
      // offer "reassign or delete" instead of an "Unknown" label.
      const liveCodes = await prisma.canvasQuestion.findMany({
        where: { canvasId: req.params.id, id: { in: [...new Set(regions.map((r) => r.questionId))] } },
        select: { id: true },
      });
      const live = new Set(liveCodes.map((q) => q.id));
      res.json({ success: true, data: regions.map((r) => ({ ...r, codeMissing: !live.has(r.questionId) })) });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /canvas/:id/documents/:docId/regions/:regionId — edit a region coding
documentRoutes.patch(
  '/canvas/:id/documents/:docId/regions/:regionId',
  validateParams(canvasIdDocIdRegionIdParams),
  validate(updateRegionSchema),
  async (req, res, next) => {
    try {
      await getOwnedCanvas(req.params.id, getAuthId(req), getAuthUserId(req));

      // Same ownership chain as DELETE: canvas -> document -> region.
      const doc = await prisma.canvasDocument.findUnique({
        where: { id: req.params.docId },
        select: { canvasId: true, pageCount: true },
      });
      if (!doc || doc.canvasId !== req.params.id) return next(new AppError('Region coding not found', 404));
      const region = await prisma.documentRegionCoding.findUnique({ where: { id: req.params.regionId } });
      if (!region || region.documentId !== req.params.docId) {
        return next(new AppError('Region coding not found', 404));
      }

      const { questionId, pageNumber, x, y, width, height, note } = req.body as {
        questionId?: string;
        pageNumber?: number;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        note?: string | null;
      };
      if (questionId !== undefined) {
        const question = await prisma.canvasQuestion.findUnique({
          where: { id: questionId },
          select: { canvasId: true },
        });
        if (!question || question.canvasId !== req.params.id) {
          return next(new AppError('Code not found in this canvas', 400));
        }
      }
      if (pageNumber !== undefined && pageNumber > doc.pageCount) {
        return next(new AppError(`This document has ${doc.pageCount} page(s)`, 400));
      }
      const box = {
        x: x ?? region.x,
        y: y ?? region.y,
        width: width ?? region.width,
        height: height ?? region.height,
      };
      if (box.width <= 0 || box.height <= 0 || box.x + box.width > 100.0001 || box.y + box.height > 100.0001) {
        return next(new AppError('A region must have a size and stay inside the page', 400));
      }

      const updated = await prisma.documentRegionCoding.update({
        where: { id: region.id },
        data: {
          ...(questionId !== undefined ? { questionId } : {}),
          ...(pageNumber !== undefined ? { pageNumber } : {}),
          ...box,
          ...(note !== undefined ? { note: note && note.trim() ? note.trim() : null } : {}),
        },
      });
      const codeLive = await prisma.canvasQuestion.count({
        where: { id: updated.questionId, canvasId: req.params.id },
      });
      res.json({ success: true, data: { ...updated, codeMissing: codeLive === 0 } });
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

      // The region model has no canvasId, so the document must be proven to
      // belong to the canvas checked above; otherwise any canvas owner could
      // delete another tenant's region by pairing their own canvas id with
      // the victim's docId/regionId.
      const doc = await prisma.canvasDocument.findUnique({
        where: { id: req.params.docId },
        select: { canvasId: true },
      });
      if (!doc || doc.canvasId !== req.params.id) {
        return next(new AppError('Region coding not found', 404));
      }

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
