import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomBytes } from 'crypto';
import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import { prisma } from '../lib/prisma.js';
import { getAuthId, getAuthUserId, getOwnedCanvas } from '../utils/routeHelpers.js';
import { checkFileUploadAccess, checkTranscriptionMinutes } from '../middleware/planLimits.js';
import { validateParams, canvasIdParam, canvasIdJobIdParams } from '../middleware/validation.js';
import { storage } from '../lib/storage.js';
import '../lib/storage-s3.js'; // register S3/R2 when configured
import '../lib/storage-local.js'; // register local fallback
import { createJob } from '../lib/jobs.js';
import { registerJobHandler } from '../lib/jobs.js';
import { transcribeAudio } from '../utils/transcription.js';
import { isValidSignature } from '../utils/magicBytes.js';
import { resolveUserOpenAiKey, TRANSCRIPTION_CENTS_PER_MINUTE } from '../utils/transcriptionMetering.js';

export const uploadRoutes = Router();

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'video/mp4',
  'video/webm',
]);

function validCanvasStorageKey(canvasId: string, key: string): boolean {
  const escapedCanvasId = canvasId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^canvas/${escapedCanvasId}/[a-f0-9]{32}(?:\\.[a-z0-9]{1,10})?$`, 'i').test(key);
}

async function requireOwnedCanvas(req: Request, _res: Response, next: NextFunction) {
  try {
    await getOwnedCanvas(req.params.id, getAuthId(req), getAuthUserId(req));
    next();
  } catch (err) {
    next(err);
  }
}

// Multer for local file uploads (dev mode / local storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MEDIA_TYPES.has(file.mimetype)) {
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

      if (storage.providerName() === 'local') {
        return res.status(409).json({
          success: false,
          error: 'Presigned uploads are unavailable with local storage; use the direct upload endpoint',
        });
      }

      const { fileName, contentType } = req.body;
      if (!fileName || !contentType) {
        return res.status(400).json({ success: false, error: 'fileName and contentType required' });
      }
      if (!ALLOWED_MEDIA_TYPES.has(contentType)) {
        return res.status(400).json({ success: false, error: 'Unsupported media type' });
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
      if (!validCanvasStorageKey(req.params.id, storageKey)) {
        return res.status(400).json({ success: false, error: 'Invalid storage key' });
      }
      if (!ALLOWED_MEDIA_TYPES.has(mimeType)) {
        return res.status(400).json({ success: false, error: 'Unsupported media type' });
      }

      const object = await storage.head(storageKey).catch(() => null);
      if (!object) {
        return res.status(404).json({ success: false, error: 'Uploaded object not found' });
      }
      if (object.size <= 0 || object.size > MAX_UPLOAD_BYTES) {
        return res.status(400).json({ success: false, error: 'Uploaded object exceeds the 25 MB limit' });
      }
      if (object.contentType && object.contentType !== mimeType) {
        return res.status(400).json({ success: false, error: 'Uploaded object type does not match confirmation' });
      }
      if (typeof sizeBytes === 'number' && sizeBytes > 0 && sizeBytes !== object.size) {
        return res.status(400).json({ success: false, error: 'Uploaded object size does not match confirmation' });
      }

      const fileUpload = await prisma.fileUpload.create({
        data: {
          canvasId: req.params.id,
          userId,
          storageKey,
          originalName,
          mimeType,
          sizeBytes: object.size,
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
  requireOwnedCanvas,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req);
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
  checkTranscriptionMinutes(),
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
          language: typeof language === 'string' ? language : null,
          requestedByUserId: userId || null,
        },
      });

      // Enqueue background job
      createJob('transcribe', {
        id: transcriptionJob.id,
        type: 'transcribe',
        // Metadata must exist before createJob starts its async handler.
        _meta: {
          jobDbId: transcriptionJob.id,
          storageKey: fileUpload.storageKey,
          canvasId: req.params.id,
          language,
          // Carry the enqueuing user so the worker can transcribe on their own
          // OpenAI key (correct billing/quota) instead of silently using the
          // server key. Undefined for legacy access-code users (no UserAiConfig).
          userId,
        },
      } as Partial<import('../lib/jobs.js').Job>);

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

  const { jobDbId, storageKey, canvasId, language, userId } = meta;

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

  // Atomically claim this durable DB job. Only one application instance may
  // transcribe it, even if multiple instances recover the same queued row.
  const claimed = await prisma.transcriptionJob.updateMany({
    where: { id: jobDbId, status: 'queued' },
    data: { status: 'processing', progress: 10, errorMessage: null },
  });
  if (claimed.count === 0) return;
  updateProgress(10);

  let tempDir: string | null = null;
  let filePath: string | null = null;
  try {
    // Materialise either local or S3/R2 storage into an isolated temporary
    // file because the OpenAI upload API expects a filesystem-backed stream.
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'qualcanvas-transcribe-'));
    const ext = path
      .extname(storageKey)
      .replace(/[^.a-z0-9]/gi, '')
      .slice(0, 12);
    filePath = path.join(tempDir, `source${ext || '.media'}`);
    await pipeline(await storage.openReadStream(storageKey), fs.createWriteStream(filePath));
    updateProgress(20);

    // Whisper transcription is OpenAI-only. If the enqueuing user configured
    // an OpenAI key, transcribe on their key/quota; if they configured a
    // different provider (Anthropic/Google) or no key, fall back to the server
    // key. resolveUserOpenAiKey is the same resolution the metering middleware
    // uses, so "BYO bypasses the cap" and "BYO is billed to the user" stay in
    // lockstep.
    const openaiKey = await resolveUserOpenAiKey(userId);
    if (!openaiKey && !process.env.OPENAI_API_KEY) {
      throw new Error(
        'Transcription requires an OpenAI API key. Add one under your provider (OpenAI) in AI settings, or ask an admin to configure a server key.',
      );
    }

    const result = await transcribeAudio(filePath, language, openaiKey);
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

    // Track AI usage. userId is recorded so the monthly transcription meter can
    // attribute minutes per user. BYO-key transcriptions cost us nothing (the
    // user is billed by OpenAI) and must not consume the metered pool, so they
    // are recorded at cost 0; server-key minutes are billed at ~$0.006/min.
    const usedOwnKey = Boolean(openaiKey);
    await prisma.aiUsage.create({
      data: {
        userId,
        canvasId,
        feature: 'transcribe',
        provider: 'openai',
        model: 'whisper-1',
        inputTokens: 0,
        outputTokens: 0,
        costCents: usedOwnKey ? 0 : Math.ceil(result.duration / 60) * TRANSCRIPTION_CENTS_PER_MINUTE,
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
  } finally {
    if (filePath) await fsPromises.unlink(filePath).catch(() => undefined);
    if (tempDir) await fsPromises.rmdir(tempDir).catch(() => undefined);
  }
});

/** Recover durable transcription jobs after an application restart. */
export async function recoverTranscriptionJobs(): Promise<void> {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.transcriptionJob.updateMany({
    where: { status: 'processing', updatedAt: { lt: staleBefore } },
    data: { status: 'queued', progress: 0, errorMessage: 'Recovered after an interrupted worker' },
  });

  const queued = await prisma.transcriptionJob.findMany({
    where: { status: 'queued' },
    include: { fileUpload: { select: { storageKey: true } } },
    orderBy: { createdAt: 'asc' },
    take: 25,
  });

  for (const row of queued) {
    createJob('transcribe', {
      id: row.id,
      type: 'transcribe',
      _meta: {
        jobDbId: row.id,
        storageKey: row.fileUpload.storageKey,
        canvasId: row.canvasId,
        language: row.language || undefined,
        userId: row.requestedByUserId || undefined,
      },
    } as Partial<import('../lib/jobs.js').Job>);
  }
}
