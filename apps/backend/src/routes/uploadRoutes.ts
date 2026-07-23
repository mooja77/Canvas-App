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
import { checkFileUploadAccess, checkTranscriptionMinutes, resolveRequestPlan } from '../middleware/planLimits.js';
import { validateParams, canvasIdParam, canvasIdJobIdParams } from '../middleware/validation.js';
import { storage } from '../lib/storage.js';
import '../lib/storage-s3.js'; // register S3/R2 when configured
import '../lib/storage-local.js'; // register local fallback
import { createJob } from '../lib/jobs.js';
import { registerJobHandler } from '../lib/jobs.js';
import { transcribeAudio } from '../utils/transcription.js';
import { isValidSignature } from '../utils/magicBytes.js';
import { resolveUserOpenAiKey, TRANSCRIPTION_CENTS_PER_MINUTE } from '../utils/transcriptionMetering.js';
import { getPlanLimits } from '../config/plans.js';
import { AppError } from '../middleware/errorHandler.js';

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

async function ensureStorageAvailable(req: Request, additionalBytes: number): Promise<void> {
  const plan = await resolveRequestPlan(req);
  const maxBytes = getPlanLimits(plan).maxStorageMb * 1024 * 1024;
  const canvas = await prisma.codingCanvas.findUnique({
    where: { id: req.params.id },
    select: { userId: true, dashboardAccessId: true },
  });
  if (!canvas) throw new AppError('Canvas not found', 404);

  const aggregate = await prisma.fileUpload.aggregate({
    where: canvas.userId
      ? { canvas: { userId: canvas.userId } }
      : { canvas: { dashboardAccessId: canvas.dashboardAccessId } },
    _sum: { sizeBytes: true },
  });
  const usedBytes = aggregate._sum.sizeBytes ?? 0;
  if (maxBytes !== Infinity && usedBytes + additionalBytes > maxBytes) {
    throw new AppError(`Storage limit exceeded (${getPlanLimits(plan).maxStorageMb} MB on the ${plan} plan)`, 403);
  }
}

async function readStoragePrefix(key: string, maxBytes = 32): Promise<Buffer> {
  const stream = await storage.openReadStream(key);
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buffer.subarray(0, Math.max(0, maxBytes - length)));
    length += buffer.length;
    if (length >= maxBytes) break;
  }
  return Buffer.concat(chunks);
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

      const { fileName, contentType, sizeBytes } = req.body;
      if (!fileName || !contentType || !Number.isInteger(sizeBytes)) {
        return res.status(400).json({ success: false, error: 'fileName, contentType and sizeBytes required' });
      }
      if (!ALLOWED_MEDIA_TYPES.has(contentType)) {
        return res.status(400).json({ success: false, error: 'Unsupported media type' });
      }
      if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
        return res.status(400).json({ success: false, error: 'File must be between 1 byte and 25 MB' });
      }
      await ensureStorageAvailable(req, sizeBytes);

      const rawExt = path.extname(fileName);
      const ext = /^\.[a-z0-9]{1,10}$/i.test(rawExt) ? rawExt.toLowerCase() : '';
      const key = `canvas/${req.params.id}/${randomBytes(16).toString('hex')}${ext}`;

      const { url } = await storage.getUploadUrl({ key, contentType, sizeBytes });

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
  checkFileUploadAccess(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardAccessId = getAuthId(req);
      const userId = getAuthUserId(req);
      await getOwnedCanvas(req.params.id, dashboardAccessId, userId);

      const { storageKey, originalName, mimeType, sizeBytes } = req.body;
      if (
        !storageKey ||
        typeof storageKey !== 'string' ||
        !originalName ||
        typeof originalName !== 'string' ||
        originalName.length > 255 ||
        !mimeType ||
        typeof mimeType !== 'string'
      ) {
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
        await storage.delete(storageKey).catch(() => undefined);
        return res.status(400).json({ success: false, error: 'Uploaded object exceeds the 25 MB limit' });
      }
      if (object.contentType && object.contentType !== mimeType) {
        await storage.delete(storageKey).catch(() => undefined);
        return res.status(400).json({ success: false, error: 'Uploaded object type does not match confirmation' });
      }
      if (typeof sizeBytes === 'number' && sizeBytes > 0 && sizeBytes !== object.size) {
        await storage.delete(storageKey).catch(() => undefined);
        return res.status(400).json({ success: false, error: 'Uploaded object size does not match confirmation' });
      }
      const kind: 'audio' | 'video' = mimeType.startsWith('video/') ? 'video' : 'audio';
      const prefix = await readStoragePrefix(storageKey);
      if (!isValidSignature(prefix, kind)) {
        await storage.delete(storageKey).catch(() => undefined);
        return res.status(400).json({ success: false, error: 'File contents do not match declared type' });
      }
      try {
        await ensureStorageAvailable(req, object.size);
      } catch (err) {
        await storage.delete(storageKey).catch(() => undefined);
        throw err;
      }

      const existing = await prisma.fileUpload.findUnique({ where: { storageKey } });
      if (existing) {
        if (existing.canvasId !== req.params.id) {
          return res.status(409).json({ success: false, error: 'Storage object is already registered' });
        }
        return res.json({ success: true, data: existing, cached: true });
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
      await ensureStorageAvailable(req, req.file.size);

      const rawExt = path.extname(req.file.originalname);
      const ext = /^\.[a-z0-9]{1,10}$/i.test(rawExt) ? rawExt.toLowerCase() : '';
      const key = `canvas/${req.params.id}/${randomBytes(16).toString('hex')}${ext}`;

      const { size } = await storage.upload({
        key,
        body: req.file.buffer,
        contentType: req.file.mimetype,
      });

      let fileUpload;
      try {
        fileUpload = await prisma.fileUpload.create({
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
      } catch (err) {
        await storage.delete(key).catch(() => undefined);
        throw err;
      }

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

      const existingJob = await prisma.transcriptionJob.findFirst({
        where: {
          fileUploadId,
          canvasId: req.params.id,
          status: { in: ['queued', 'processing', 'completed'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existingJob) {
        return res.json({ success: true, data: { jobId: existingJob.id }, cached: true });
      }

      // Platform-key jobs are serialized per user. This prevents several
      // simultaneous requests from all passing the same monthly usage check
      // before any of them records its minutes.
      if (userId && !(await resolveUserOpenAiKey(userId))) {
        const activeJob = await prisma.transcriptionJob.findFirst({
          where: { requestedByUserId: userId, status: { in: ['queued', 'processing'] } },
          select: { id: true },
        });
        if (activeJob) {
          return res.status(409).json({
            success: false,
            error: 'Another transcription is already in progress. Wait for it to finish before starting the next.',
            code: 'TRANSCRIPTION_IN_PROGRESS',
            jobId: activeJob.id,
          });
        }
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

      const existingTranscript = await prisma.canvasTranscript.findFirst({
        where: { canvasId: req.params.id, sourceType: 'transcription', sourceId: job.id },
      });
      if (existingTranscript) {
        return res.json({ success: true, data: existingTranscript, cached: true });
      }

      const requestedTitle = req.body.title;
      if (requestedTitle !== undefined && (typeof requestedTitle !== 'string' || requestedTitle.trim().length > 200)) {
        return res.status(400).json({ success: false, error: 'Title must be 1-200 characters' });
      }
      const title =
        typeof requestedTitle === 'string' && requestedTitle.trim()
          ? requestedTitle.trim()
          : job.fileUpload.originalName.replace(/\.[^.]+$/, '').slice(0, 200);

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
