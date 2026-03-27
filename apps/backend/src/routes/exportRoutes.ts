import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateParams, canvasIdParam } from '../middleware/validation.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import { generateExcelExport } from '../utils/excelExport.js';

export const exportRoutes = Router();

// GET /canvas/:id/export/excel — download canvas data as .xlsx
exportRoutes.get('/canvas/:id/export/excel', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const dashboardAccessId = getAuthId(req);
    const userId = getAuthUserId(req);
    await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

    const canvas = await prisma.codingCanvas.findUnique({
      where: { id: req.params.id },
      include: {
        transcripts: { orderBy: { sortOrder: 'asc' } },
        questions: { orderBy: { sortOrder: 'asc' } },
        codings: { take: 50000 },
        cases: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!canvas) return next(new AppError('Canvas not found', 404));

    const data = {
      name: canvas.name,
      questions: canvas.questions,
      transcripts: canvas.transcripts,
      codings: canvas.codings,
      cases: canvas.cases.map(c => ({
        ...c,
        attributes: safeJsonParse(c.attributes),
      })),
    };

    const buffer = await generateExcelExport(data);

    const safeName = canvas.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-export.xlsx"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
