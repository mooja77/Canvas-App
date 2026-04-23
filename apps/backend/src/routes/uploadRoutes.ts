import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomBytes } from 'crypto';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { getAuthId, getAuthUserId, getOwnedCanvas } from '../utils/routeHelpers.js';
import { checkFileUploadAccess } from '../middleware/planLimits.js';
import { validateParams, canvasIdParam, canvasIdJobIdParams } from '../middleware/validation.js';
import { storage } from '../lib/storage.js';
import '../lib/storage-local.js'; // register local fallback
import { createJob } from '../lib/jobs.js';
import { registerJobHandler } from '../lib/jobs.js';
import { transcribeAudio, getLocalUploadPath } from '../utils/transcription.js';
import { isValidSignature } from '../utils/magicBytes.js';

export const uploadRoutes = Router();

// Multer for local file uploads (dev mode / local storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/x-m4a',
      'audio/ogg',
      'audio/webm',
      'audio/flac',
      'video/mp4',
      'video/webm',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`));
    }
  },
});

// ─── POST /canvas/:id/upload/presigned ───
// Get a pre-signed URL for direct client upload to S3
uploadRoutes.post(
  '/canvas/:id/upload/presigned',
  validateParams(canvasIdParam),
  checkFileUploadAccess(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { fileName, contentType } = req.body;
      if (!fileName || !contentType) {
        return res.status(400).json({ success: false, error: 'fileName and contentType required' });
      }

      const ext = path.extname(fileName);
      const key = `canvas/${req.params.id}/${randomBytes(16).toString('hex')}${ext}`;

      const { url } = await storage.getUploadUrl({ key, contentType });

      res.json({ success: true, data: { uploadUrl: url, storageKey: key } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /canvas/:id/upload/confirm ───
// Confirm upload and create FileUpload record
uploadRoutes.post(
  '/canvas/:id/upload/confirm',
  validateParams(canvasIdParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { storageKey, originalName, mimeType, sizeBytes } = req.body;
      if (!storageKey || !originalName || !mimeType) {
        return res.status(400).json({ success: false, error: 'storageKey, originalName, mimeType required' });
      }

      const fileUpload = await prisma.fileUpload.create({
        data: {
          canvasId: req.params.id,
          userId,
          storageKey,
          originalName,
          mimeType,
          sizeBytes: sizeBytes || 0,
          status: 'uploaded',
        },
      });

      res.json({ success: true, data: fileUpload });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /canvas/:id/upload/direct ───
// Direct file upload (for local storage / dev mode)
uploadRoutes.post(
  '/canvas/:id/upload/direct',
  validateParams(canvasIdParam),
  checkFileUploadAccess(),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      // Content-sniff the first bytes so a renamed .exe or .html can't slip
      // through just because multer accepted the MIME string from the client.
      const kind: 'audio' | 'video' = req.file.mimetype.startsWith('video/') ? 'video' : 'audio';
      if (!isValidSignature(req.file.buffer, kind)) {
        return res.status(400).json({ success: false, error: 'File contents do not match declared type' });
      }

      const ext = path.extname(req.file.originalname);
      const key = `canvas/${req.params.id}/${randomBytes(16).toString('hex')}${ext}`;

      const { size } = await storage.upload({
        key,
        body: req.file.buffer,
        contentType: req.file.mimetype,
      });

      const fileUpload = await prisma.fileUpload.create({
        data: {
          canvasId: req.params.id,
          userId,
          storageKey: key,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: size || req.file.size,
          status: 'uploaded',
        },
      });

      res.json({ success: true, data: fileUpload });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /canvas/:id/transcribe ───
// Start transcription job
uploadRoutes.post(
  '/canvas/:id/transcribe',
  validateParams(canvasIdParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { fileUploadId, language } = req.body;
      if (!fileUploadId) {
        return res.status(400).json({ success: false, error: 'fileUploadId required' });
      }

      const fileUpload = await prisma.fileUpload.findFirst({
        where: { id: fileUploadId, canvasId: req.params.id },
      });
      if (!fileUpload) {
        return res.status(404).json({ success: false, error: 'File upload not found' });
      }

      // Create transcription job record
      const transcriptionJob = await prisma.transcriptionJob.create({
        data: {
          fileUploadId,
          canvasId: req.params.id,
          status: 'queued',
        },
      });

      // Enqueue background job
      const job = createJob('transcribe', {
        id: transcriptionJob.id,
        type: 'transcribe',
      });

      // Store metadata for the job handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (job as any)._meta = {
        jobDbId: transcriptionJob.id,
        storageKey: fileUpload.storageKey,
        canvasId: req.params.id,
        language,
      };

      res.json({ success: true, data: { jobId: transcriptionJob.id } });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /canvas/:id/transcribe/:jobId ───
// Poll transcription job status
uploadRoutes.get(
  '/canvas/:id/transcribe/:jobId',
  validateParams(canvasIdJobIdParams),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const job = await prisma.transcriptionJob.findFirst({
        where: { id: req.params.jobId, canvasId: req.params.id },
      });
      if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      res.json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /canvas/:id/transcribe/:jobId/accept ───
// Accept transcription result → create transcript node
uploadRoutes.post(
  '/canvas/:id/transcribe/:jobId/accept',
  validateParams(canvasIdJobIdParams),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const job = await prisma.transcriptionJob.findFirst({
        where: { id: req.params.jobId, canvasId: req.params.id, status: 'completed' },
        include: { fileUpload: true },
      });
      if (!job) {
        return res.status(404).json({ success: false, error: 'Completed job not found' });
      }
      if (!job.resultText) {
        return res.status(400).json({ success: false, error: 'Job has no result text' });
      }

      const title = req.body.title || job.fileUpload.originalName.replace(/\.[^.]+$/, '');

      const transcript = await prisma.canvasTranscript.create({
        data: {
          canvasId: req.params.id,
          title,
          content: job.resultText,
          fileUploadId: job.fileUploadId,
          timestamps: job.resultSegments,
          sourceType: 'transcription',
          sourceId: job.id,
        },
      });

      res.json({ success: true, data: transcript });
    } catch (err) {
      next(err);
    }
  },
);

// Register transcription job handler
registerJobHandler('transcribe', async (job, updateProgress) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (job as any)._meta;
  if (!meta) throw new Error('Missing job metadata');

  const { jobDbId, storageKey, canvasId, language } = meta;

  // Short-circuit if the canvas has been deleted (hard or soft) between
  // enqueue and execution. Otherwise the job burns AI cost and writes a
  // result row that no UI can reach.
  const canvas = await prisma.codingCanvas.findUnique({
    where: { id: canvasId },
    select: { id: true, deletedAt: true },
  });
  if (!canvas || canvas.deletedAt) {
    await prisma.transcriptionJob.update({
      where: { id: jobDbId },
      data: { status: 'failed', errorMessage: 'Canvas was deleted before transcription completed' },
    });
    return;
  }

  // Update DB status
  await prisma.transcriptionJob.update({
    where: { id: jobDbId },
    data: { status: 'processing', progress: 10 },
  });
  updateProgress(10);

  try {
    // Get file path (for local storage, resolve path; for S3, would need to download first)
    const filePath = getLocalUploadPath(storageKey);
    updateProgress(20);

    const result = await transcribeAudio(filePath, language);
    updateProgress(90);

    // Save result to DB
    await prisma.transcriptionJob.update({
      where: { id: jobDbId },
      data: {
        status: 'completed',
        progress: 100,
        resultText: result.text,
        resultSegments: JSON.stringify(result.segments),
      },
    });

    // Track AI usage
    await prisma.aiUsage.create({
      data: {
        canvasId,
        feature: 'transcribe',
        provider: 'openai',
        model: 'whisper-1',
        inputTokens: 0,
        outputTokens: 0,
        costCents: Math.ceil(result.duration / 60) * 0.6, // $0.006/min
      },
    });

    updateProgress(100);
    return result;
  } catch (err) {
    await prisma.transcriptionJob.update({
      where: { id: jobDbId },
      data: {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Transcription failed',
      },
    });
    throw err;
  }
});
