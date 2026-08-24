import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { AppError } from '../middleware/errorHandler.js';
import { getAuthId, getAuthUserId, getOwnedCanvas } from '../utils/routeHelpers.js';
import { exportQdpx } from '../utils/qdpxExport.js';
import { importQdpx } from '../utils/qdpxImport.js';
import { checkExportFormat } from '../middleware/planLimits.js';
import { validateParams, canvasIdParam } from '../middleware/validation.js';
import { isValidSignature } from '../utils/magicBytes.js';
import { prisma } from '../lib/prisma.js';

export const qdpxRoutes = Router();

const MAX_QDPX_BYTES = 20 * 1024 * 1024;

// Multer for QDPX file upload (in memory, max 20MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_QDPX_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.qdpx', '.zip'];
    const dot = file.originalname.lastIndexOf('.');
    // slice(-1) on a name with no dot returned the last character, so an
    // extension-less upload was compared as e.g. "t" — still rejected, but
    // for the wrong reason. Treat "no dot" as "no extension" explicitly.
    const ext = dot === -1 ? '' : file.originalname.toLowerCase().slice(dot);
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      // A plain Error has no status, so errorHandler logged it and answered
      // 500 "Internal server error" — the researcher saw a server fault for
      // their own mis-named file. This is a 400.
      cb(new AppError('Only .qdpx or .zip files are accepted', 400));
    }
  },
});

/**
 * Multer reports its own limits (file too large, unexpected field) as a
 * MulterError, which likewise carries no HTTP status and therefore became a
 * 500. Translate to the 4xx each one actually is.
 */
function uploadQdpxFile(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `QDPX file exceeds the ${Math.round(MAX_QDPX_BYTES / (1024 * 1024))}MB upload limit`
          : `Invalid file upload: ${err.message}`;
      return next(new AppError(message, status));
    }
    next(err);
  });
}

// GET /api/canvas/:id/export/qdpx — Export canvas as QDPX
qdpxRoutes.get(
  '/canvas/:id/export/qdpx',
  validateParams(canvasIdParam),
  checkExportFormat('qdpx'),
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

      const { buffer, notes } = await exportQdpx(req.params.id);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="canvas-export.qdpx"');
      // Tell the caller what the archive does not contain. The import path
      // already discloses its losses; an export that only ever reports success
      // reads as lossless. The same text is written into project.qde, so the
      // disclosure survives even when nobody reads the header.
      if (notes.length > 0) {
        res.setHeader('X-Export-Notes', notes.join('; ').replace(/[^\x20-\x7E]/g, ' '));
        res.setHeader('Access-Control-Expose-Headers', 'X-Export-Notes');
      }
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
  checkExportFormat('qdpx'),
  uploadQdpxFile,
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
      // Re-importing the same archive is a common accident (a double-click on
      // Import used to double the codebook). Say plainly what was recognised
      // as already present rather than reporting it as freshly imported.
      const matched = [
        result.matchedCodes > 0 ? `${result.matchedCodes} code(s)` : null,
        result.matchedSources > 0 ? `${result.matchedSources} source(s)` : null,
        result.duplicateCodings > 0 ? `${result.duplicateCodings} coding(s)` : null,
      ].filter((s): s is string => s !== null);
      if (matched.length > 0) {
        notes.push(`already on this canvas and reused: ${matched.join(', ')}`);
      }
      if (result.unmatchedCoders > 0) {
        notes.push(
          `${result.unmatchedCoders} coding(s) name a coder with no QualCanvas account — attribution not restored`,
        );
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
