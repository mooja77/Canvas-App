import { Router } from 'express';
import multer from 'multer';
import { getAuthId, getAuthUserId, getOwnedCanvas } from '../utils/routeHelpers.js';
import { exportQdpx } from '../utils/qdpxExport.js';
import { importQdpx } from '../utils/qdpxImport.js';
import { checkExportFormat } from '../middleware/planLimits.js';
import { validateParams, canvasIdParam } from '../middleware/validation.js';
import { isValidSignature } from '../utils/magicBytes.js';
import { prisma } from '../lib/prisma.js';

export const qdpxRoutes = Router();

// Multer for QDPX file upload (in memory, max 20MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.qdpx', '.zip'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .qdpx or .zip files are accepted'));
    }
  },
});

// GET /api/canvas/:id/export/qdpx — Export canvas as QDPX
qdpxRoutes.get(
  '/canvas/:id/export/qdpx',
  validateParams(canvasIdParam),
  checkExportFormat(),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      // Reject exports that would produce a semantically empty QDPX. NVivo
      // and ATLAS.ti will silently accept such archives and the researcher
      // will blame QualCanvas when no content appears on import.
      const [transcriptCount, codingCount] = await Promise.all([
        prisma.canvasTranscript.count({ where: { canvasId: req.params.id } }),
        prisma.canvasTextCoding.count({ where: { canvasId: req.params.id } }),
      ]);
      if (transcriptCount === 0 && codingCount === 0) {
        return res.status(400).json({
          success: false,
          error: 'Canvas has no transcripts or codings to export. Add content first.',
          code: 'EMPTY_CANVAS',
        });
      }

      const buffer = await exportQdpx(req.params.id);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="canvas-export.qdpx"');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/canvas/:id/import/qdpx — Import QDPX file
qdpxRoutes.post(
  '/canvas/:id/import/qdpx',
  validateParams(canvasIdParam),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      // Extension check isn't sufficient — verify ZIP magic bytes before passing
      // the buffer to the zip library. Rejects spoofed .qdpx uploads cheaply.
      if (!isValidSignature(req.file.buffer, 'zip')) {
        return res.status(400).json({ success: false, error: 'Invalid QDPX file: not a valid ZIP archive' });
      }

      const result = await importQdpx(req.params.id, req.file.buffer);

      // Disclose what was dropped. An import that reports only what it created
      // reads as lossless, and the researcher finds out otherwise much later.
      const notes: string[] = [];
      if (result.unsupported.length > 0) {
        notes.push(`not imported: ${result.unsupported.join(', ')}`);
      }
      if (result.skippedCodings > 0) {
        notes.push(`${result.skippedCodings} coding(s) skipped — unresolved code or source`);
      }

      const summary = `Imported ${result.codes} codes, ${result.sources} sources, ${result.codings} codings`;

      res.json({
        success: true,
        message: notes.length > 0 ? `${summary}. Note — ${notes.join('; ')}.` : summary,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  },
);
