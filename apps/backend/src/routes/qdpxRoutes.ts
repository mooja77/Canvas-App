import { Router } from 'express';
import multer from 'multer';
import { getAuthId, getAuthUserId, getOwnedCanvas } from '../utils/routeHelpers.js';
import { exportQdpx } from '../utils/qdpxExport.js';
import { importQdpx } from '../utils/qdpxImport.js';
import { checkExportFormat } from '../middleware/planLimits.js';
import { validateParams, canvasIdParam } from '../middleware/validation.js';

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
qdpxRoutes.get('/canvas/:id/export/qdpx', validateParams(canvasIdParam), checkExportFormat(), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

    const buffer = await exportQdpx(req.params.id);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="canvas-export.qdpx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/canvas/:id/import/qdpx — Import QDPX file
qdpxRoutes.post('/canvas/:id/import/qdpx', validateParams(canvasIdParam), upload.single('file'), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const result = await importQdpx(req.params.id, req.file.buffer);

    res.json({
      success: true,
      message: `Imported ${result.codes} codes, ${result.sources} sources, ${result.codings} codings`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});
