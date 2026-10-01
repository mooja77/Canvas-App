import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateParams, canvasIdParam } from '../middleware/validation.js';
import { getAuthId, getAuthUserId, getOwnedCanvas, safeJsonParse } from '../utils/routeHelpers.js';
import { generateExcelExport } from '../utils/excelExport.js';
import { checkExportFormat } from '../middleware/planLimits.js';
import { observeSetupStep } from '../lib/onboardingObservations.js';

export const exportRoutes = Router();

// Generate the guide's real coded-data download from authorized stored rows.
// A client completion marker cannot produce this observation.
exportRoutes.get('/canvas/:id/export/coded-data.csv', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    await getOwnedCanvas(req.params.id, getAuthId(req), userId);
    const canvas = await prisma.codingCanvas.findUnique({
      where: { id: req.params.id },
      include: {
        transcripts: { where: { deletedAt: null } },
        questions: true,
        codings: { orderBy: { createdAt: 'asc' } },
        cases: true,
      },
    });
    if (!canvas) return next(new AppError('Canvas not found', 404));
    const transcripts = new Map(canvas.transcripts.map((row) => [row.id, row]));
    const questions = new Map(canvas.questions.map((row) => [row.id, row]));
    const cases = new Map(canvas.cases.map((row) => [row.id, row]));
    const codings = canvas.codings.filter((row) => transcripts.has(row.transcriptId));
    const field = (value: unknown) => {
      const text = String(value ?? '');
      const safe = /^\s*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = codings.map((coding) => {
      const transcript = transcripts.get(coding.transcriptId)!;
      const question = questions.get(coding.questionId);
      return [
        transcript.title,
        question?.text,
        question?.color,
        question?.parentQuestionId ? questions.get(question.parentQuestionId)?.text : '',
        coding.codedText,
        coding.startOffset,
        coding.endOffset,
        coding.annotation,
        transcript.caseId ? cases.get(transcript.caseId)?.name : '',
        coding.createdAt.toISOString().slice(0, 10),
      ]
        .map(field)
        .join(',');
    });
    const csv =
      '\uFEFF' +
      ['Transcript,Code,Code Color,Parent Theme,Coded Text,Start,End,Annotation,Case,Date', ...rows].join('\n');
    // This means generated/delivered by the server, not a claim about the user's disk.
    if (
      codings.some(
        (coding) => coding.source !== 'sample' && transcripts.get(coding.transcriptId)?.sourceType !== 'sample',
      )
    ) {
      await observeSetupStep(userId, canvas.id, 'export-csv');
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="coded-data-${canvas.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv"`,
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// GET /canvas/:id/export/excel — download canvas data as .xlsx
exportRoutes.get(
  '/canvas/:id/export/excel',
  validateParams(canvasIdParam),
  checkExportFormat('xlsx'),
  async (req, res, next) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const canvas = await prisma.codingCanvas.findUnique({
        where: { id: req.params.id },
        include: {
          transcripts: { orderBy: { sortOrder: 'asc' } },
          questions: { orderBy: { sortOrder: 'asc' } },
          codings: { orderBy: { createdAt: 'asc' } },
          cases: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!canvas) return next(new AppError('Canvas not found', 404));

      const data = {
        name: canvas.name,
        questions: canvas.questions,
        transcripts: canvas.transcripts,
        codings: canvas.codings,
        cases: canvas.cases.map((c) => ({
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
  },
);
