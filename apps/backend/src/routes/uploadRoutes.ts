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
import {
  checkFileUploadAccess,
  checkTranscriptLimit,
  checkTranscriptionAccess,
  resolveRequestPlan,
} from '../middleware/planLimits.js';
import { validateParams, canvasIdParam, canvasIdJobIdParams } from '../middleware/validation.js';
import { storage } from '../lib/storage.js';
import '../lib/storage-s3.js'; // register S3/R2 when configured
import '../lib/storage-local.js'; // register local fallback
import { createJob } from '../lib/jobs.js';
import { registerJobHandler } from '../lib/jobs.js';
import { transcribeAudio } from '../utils/transcription.js';
import { isValidSignature } from '../utils/magicBytes.js';
import { resolveTranscriptionKey, transcriptionUsageOnKey, WHISPER_USD_PER_MINUTE } from '../utils/aiKeys.js';
import { friendlyProviderError } from '../lib/aiKeyCheck.js';
import { getPlanLimits } from '../config/plans.js';
import { AppError } from '../middleware/errorHandler.js';

export const uploadRoutes = Router();

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);
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

// The browser's `File.type` for an ordinary interview recording is whatever the
// OS registry says, and for the very same .wav that is `audio/wav` on one
// machine and `audio/x-wav` on another. AudioUploadModal offers
// .mp3/.wav/.mp4/.m4a/.ogg/.webm/.flac by EXTENSION, so the server has to
// accept every mainstream spelling of those seven containers or it rejects
// files its own picker told the researcher were fine. Content is still
// magic-byte verified after this, so widening the name map does not widen what
// can actually be stored.
const MEDIA_TYPE_ALIASES: Record<string, string> = {
  'audio/mp3': 'audio/mpeg',
  'audio/mpeg3': 'audio/mpeg',
  'audio/x-mpeg': 'audio/mpeg',
  'audio/x-mpeg-3': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-pn-wav': 'audio/wav',
  'audio/m4a': 'audio/mp4',
  'audio/x-mp4': 'audio/mp4',
  'audio/x-flac': 'audio/flac',
  'audio/x-ogg': 'audio/ogg',
  'application/ogg': 'audio/ogg',
  'audio/vorbis': 'audio/ogg',
  'audio/webm;codecs=opus': 'audio/webm',
};

// Last resort for the same problem: some Windows installs hand the browser no
// registered type at all and it sends `application/octet-stream`. Fall back to
// the file extension rather than 500-ing on a perfectly valid recording.
const EXTENSION_MEDIA_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.webm': 'audio/webm',
  '.flac': 'audio/flac',
};

const GENERIC_MIME_TYPES = new Set(['application/octet-stream', 'binary/octet-stream', '']);

/**
 * Resolve a client-declared MIME type to one of ALLOWED_MEDIA_TYPES, or null if
 * the file is genuinely not a supported recording.
 */
export function resolveMediaType(declaredType: string | undefined, fileName: string): string | null {
  const declared = (declaredType || '').toLowerCase().trim();
  const canonical = MEDIA_TYPE_ALIASES[declared] ?? declared;
  if (ALLOWED_MEDIA_TYPES.has(canonical)) return canonical;
  if (GENERIC_MIME_TYPES.has(declared)) {
    return EXTENSION_MEDIA_TYPES[path.extname(fileName || '').toLowerCase()] ?? null;
  }
  return null;
}

const SUPPORTED_FORMATS_HINT = 'MP3, WAV, M4A, MP4, OGG, WEBM or FLAC';

function validCanvasStorageKey(canvasId: string, key: string): boolean {
  const escapedCanvasId = canvasId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^canvas/${escapedCanvasId}/[a-f0-9]{32}(?:\\.[a-z0-9]{1,10})?$`, 'i').test(key);
}

export async function ensureStorageAvailable(req: Request, additionalBytes: number): Promise<void> {
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
  fileFilter: (req, file, cb) => {
    const resolved = resolveMediaType(file.mimetype, file.originalname);
    if (resolved) {
      // Stash the canonical type so the handler stores `audio/wav`, not the
      // `audio/x-wav` / octet-stream string the browser happened to send.
      (req as Request & { resolvedMediaType?: string }).resolvedMediaType = resolved;
      cb(null, true);
    } else {
      // A bare `new Error` here reached errorHandler as an unrecognised throw
      // and was rendered as `500 Internal server error`, so a researcher whose
      // OS spells wav as `audio/x-wav` was told the server had crashed. This is
      // a client-side mistake with a fixable cause: say so, and say what to do.
      cb(
        new AppError(
          `Unsupported file type "${file.mimetype || 'unknown'}". Upload an audio or video recording in ${SUPPORTED_FORMATS_HINT}.`,
          415,
        ),
      );
    }
  },
});

/**
 * Run multer and translate its failures into client errors.
 *
 * Multer reports the size cap as a `MulterError` (code LIMIT_FILE_SIZE), which
 * is not an AppError and not a Prisma error, so errorHandler logged it as an
 * unexpected fault and returned 500. A 30 MB recording is a user mistake, not a
 * server fault, and the 25 MB limit was never stated anywhere in the product.
 */
function uploadSingleMedia(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(`File is too large. The maximum upload size is ${MAX_UPLOAD_MB} MB.`, 413));
      }
      return next(new AppError(`Upload rejected: ${err.message}`, 400));
    }
    return next(err);
  });
}

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
        return res
          .status(400)
          .json({ success: false, error: `Unsupported media type. Upload a recording in ${SUPPORTED_FORMATS_HINT}.` });
      }
      if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
        return res.status(400).json({ success: false, error: `File must be between 1 byte and ${MAX_UPLOAD_MB} MB` });
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
        return res
          .status(400)
          .json({ success: false, error: `Unsupported media type. Upload a recording in ${SUPPORTED_FORMATS_HINT}.` });
      }

      const object = await storage.head(storageKey).catch(() => null);
      if (!object) {
        return res.status(404).json({ success: false, error: 'Uploaded object not found' });
      }
      if (object.size <= 0 || object.size > MAX_UPLOAD_BYTES) {
        await storage.delete(storageKey).catch(() => undefined);
        return res.status(400).json({ success: false, error: `Uploaded object exceeds the ${MAX_UPLOAD_MB} MB limit` });
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
  uploadSingleMedia,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req);
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      // The canonical type the fileFilter resolved, not the browser's spelling.
      const mimeType =
        (req as Request & { resolvedMediaType?: string }).resolvedMediaType ??
        resolveMediaType(req.file.mimetype, req.file.originalname) ??
        req.file.mimetype;

      // Content-sniff the first bytes so a renamed .exe or .html can't slip
      // through just because multer accepted the MIME string from the client.
      const kind: 'audio' | 'video' = mimeType.startsWith('video/') ? 'video' : 'audio';
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
        contentType: mimeType,
      });

      let fileUpload;
      try {
        fileUpload = await prisma.fileUpload.create({
          data: {
            canvasId: req.params.id,
            userId,
            storageKey: key,
            originalName: req.file.originalname,
            mimeType,
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

// ─── GET /canvas/:id/transcribe/allowance ───
// What the transcription screen shows before an upload. Registered before
// /transcribe/:jobId so "allowance" is never read as a job id.
uploadRoutes.get(
  '/canvas/:id/transcribe/allowance',
  validateParams(canvasIdParam),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await getOwnedCanvas(req.params.id, getAuthId(req), getAuthUserId(req));
      const plan = await resolveRequestPlan(req);
      const userId = req.userId;
      // No included minutes: the screen shows whose own OpenAI key would pay
      // (utils/aiKeys.ts) and, for that key, plain usage this month.
      const key = userId ? await resolveTranscriptionKey(req.params.id, userId) : null;
      const [owner, usage] = await Promise.all([
        key && !key.isCanvasOwner
          ? prisma.user.findUnique({ where: { id: key.canvasOwnerId }, select: { name: true } })
          : Promise.resolve(null),
        key?.keyOwnerId ? transcriptionUsageOnKey(key.keyOwnerId) : Promise.resolve(null),
      ]);
      res.json({
        success: true,
        data: {
          plan,
          fileUploadEnabled: getPlanLimits(plan).fileUploadEnabled,
          maxUploadMb: MAX_UPLOAD_MB,
          emailAccount: Boolean(userId),
          keySource: key?.source ?? null,
          isCanvasOwner: key?.isCanvasOwner ?? true,
          canvasOwnerName: owner?.name ?? null,
          ownerHasOpenAiKey: key?.ownerHasOpenAiKey ?? false,
          ownerSharesKey: key?.ownerSharesKey ?? false,
          usageThisMonth: usage,
          pricePerMinuteUsd: WHISPER_USD_PER_MINUTE,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /canvas/:id/transcribe ───
// Recent transcription jobs on this canvas, newest first, so the screen can
// resume a job after it was closed or the page reloaded.
uploadRoutes.get('/canvas/:id/transcribe', validateParams(canvasIdParam), async (req, res, next) => {
  try {
    await getOwnedCanvas(req.params.id, getAuthId(req), getAuthUserId(req));
    const jobs = await prisma.transcriptionJob.findMany({
      where: { canvasId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        progress: true,
        errorMessage: true,
        language: true,
        fileUploadId: true,
        createdAt: true,
        updatedAt: true,
        fileUpload: { select: { originalName: true, sizeBytes: true } },
      },
    });
    const accepted = await prisma.canvasTranscript.findMany({
      where: { canvasId: req.params.id, sourceType: 'transcription', sourceId: { in: jobs.map((j) => j.id) } },
      select: { id: true, sourceId: true },
    });
    const transcriptByJob = new Map(accepted.map((t) => [t.sourceId, t.id]));
    res.json({
      success: true,
      data: jobs.map(({ fileUpload, ...job }) => ({
        ...job,
        fileName: fileUpload.originalName,
        sizeBytes: fileUpload.sizeBytes,
        transcriptId: transcriptByJob.get(job.id) ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /canvas/:id/transcribe ───
// Start transcription job
uploadRoutes.post(
  '/canvas/:id/transcribe',
  validateParams(canvasIdParam),
  checkTranscriptionAccess(),
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
      // Only recordings can be transcribed. Region-coding documents (PDFs,
      // images) are FileUploads on the same canvas, and would otherwise be
      // sent to the speech API and billed as minutes.
      if (!ALLOWED_MEDIA_TYPES.has(fileUpload.mimeType)) {
        return res.status(400).json({ success: false, error: 'Only audio or video recordings can be transcribed' });
      }

      // Fail before queueing when no customer key can pay. There is no server
      // key: see utils/aiKeys.ts for the collaborator rule.
      const key = await resolveTranscriptionKey(req.params.id, userId as string);
      if (!key.apiKey) {
        return res.status(409).json({
          success: false,
          error: key.isCanvasOwner
            ? 'Connect your AI account to transcribe. Transcription runs on your own OpenAI key and OpenAI bills you directly (about $0.006 a minute).'
            : key.ownerHasOpenAiKey
              ? "Connect your AI account to transcribe. The canvas owner hasn't let collaborators use their OpenAI key, so connect your own or ask them to allow it."
              : 'Connect your AI account to transcribe. Transcription runs on your own OpenAI key and OpenAI bills you directly (about $0.006 a minute).',
          code: 'TRANSCRIPTION_KEY_REQUIRED',
        });
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

      // Create transcription job record
      const transcriptionJob = await prisma.transcriptionJob.create({
        data: {
          fileUploadId,
          canvasId: req.params.id,
          status: 'queued',
          language: typeof language === 'string' ? language : null,
          requestedByUserId: userId || null,
          keyOwnerUserId: key.keyOwnerId,
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
          // The worker re-resolves whose own key pays from this user and the
          // canvas (utils/aiKeys.ts), so a revoked share stops the job.
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
  // Accepting creates a transcript, so it obeys the same per-canvas cap as
  // adding one by hand (it used to create it unconditionally).
  checkTranscriptLimit(),
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

      const maxWords = getPlanLimits(await resolveRequestPlan(req)).maxWordsPerTranscript;
      const words = job.resultText.trim().split(/\s+/).filter(Boolean).length;
      if (maxWords !== Infinity && words > maxWords) {
        return res.status(403).json({
          success: false,
          error: `This transcription has ${words.toLocaleString()} words; your plan allows ${maxWords.toLocaleString()} words per transcript. Split the recording and transcribe it in parts.`,
          code: 'PLAN_LIMIT_EXCEEDED',
          limit: 'maxWordsPerTranscript',
          current: words,
          max: maxWords,
          upgrade: false,
        });
      }

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

    // Whisper is OpenAI-only and always runs on a customer's own key: the
    // requester's, or the canvas owner's if they share it (utils/aiKeys.ts).
    // Resolved now, not at enqueue, so removing or unsharing a key stops it.
    const key = userId ? await resolveTranscriptionKey(canvasId, userId) : null;
    if (!key?.apiKey || !key.keyOwnerId) {
      throw new Error(
        'Connect your AI account to transcribe: add your own OpenAI key in Account → AI, then press Try again.',
      );
    }
    const openaiKey = key.apiKey;
    await prisma.transcriptionJob.update({ where: { id: jobDbId }, data: { keyOwnerUserId: key.keyOwnerId } });

    let result;
    try {
      result = await transcribeAudio(filePath, language, openaiKey);
    } catch (err) {
      throw new Error(friendlyProviderError('openai', err));
    }
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

    // Usage reporting only: nothing is metered or capped. The customer's own
    // key paid, so costCents is 0 (it is not our cost); keyOwnerId and the
    // recording length let each key owner see their own usage.
    await prisma.aiUsage.create({
      data: {
        userId,
        canvasId,
        keyOwnerId: key.keyOwnerId,
        durationSeconds: Math.round(result.duration),
        feature: 'transcribe',
        provider: 'openai',
        model: 'whisper-1',
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
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
