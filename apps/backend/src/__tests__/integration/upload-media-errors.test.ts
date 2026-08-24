// Regression tests for audit finding 3.3 item 4:
// "Rejected media uploads return HTTP 500 with no explanation — and a plain
// .wav can hit it."
//
// Before the fix, POST /canvas/:id/upload/direct answered:
//   audio/x-wav              -> 500 Internal server error
//   application/octet-stream -> 500 Internal server error
//   a 30 MB audio/wav        -> 500 Internal server error
// because multer's fileFilter rejected with a bare `new Error(...)` and its
// size cap threw a `MulterError`, neither of which errorHandler recognises.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { Readable } from 'node:stream';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
    canvasCollaborator: { findUnique: vi.fn() },
    codingCanvas: { findUnique: vi.fn() },
    fileUpload: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    transcriptionJob: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    canvasTranscript: { create: vi.fn(), count: vi.fn().mockResolvedValue(1) },
    aiUsage: { create: vi.fn() },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));

vi.mock('../../middleware/authLimiter.js', () => ({
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../middleware/planLimits.js', () => ({
  checkFileUploadAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkTranscriptionMinutes: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  resolveRequestPlan: vi.fn().mockResolvedValue('pro'),
}));

vi.mock('../../lib/storage.js', () => ({
  storage: {
    providerName: vi.fn().mockReturnValue('local'),
    getUploadUrl: vi.fn(),
    upload: vi.fn().mockResolvedValue({ size: 1024 }),
    delete: vi.fn().mockResolvedValue(undefined),
    head: vi.fn(),
    openReadStream: vi.fn().mockImplementation(() => Promise.resolve(Readable.from([Buffer.from('ID3test')]))),
  },
}));

vi.mock('../../lib/storage-local.js', () => ({}));
vi.mock('../../lib/storage-s3.js', () => ({}));

vi.mock('../../lib/jobs.js', () => ({
  createJob: vi.fn().mockReturnValue({ id: 'job-1' }),
  registerJobHandler: vi.fn(),
}));

vi.mock('../../utils/transcription.js', () => ({
  transcribeAudio: vi.fn(),
  getLocalUploadPath: vi.fn(),
}));

vi.mock('../../utils/transcriptionMetering.js', () => ({
  resolveUserOpenAiKey: vi.fn().mockResolvedValue(null),
  TRANSCRIPTION_CENTS_PER_MINUTE: 0.6,
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { uploadRoutes, resolveMediaType } from '../../routes/uploadRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

// A minimal but genuine RIFF/WAVE header, so the magic-byte check downstream
// passes and the response we assert on is really the MIME decision.
function wavBuffer(sizeBytes = 64): Buffer {
  const buf = Buffer.alloc(Math.max(64, sizeBytes));
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write('WAVE', 8, 'ascii');
  return buf;
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, uploadRoutes);
  app.use(errorHandler);
  return app;
}

describe('media upload rejections are client errors, not 500s', () => {
  let app: express.Express;
  const userId = 'user-upload-err';
  const dashboardAccessId = 'da-upload-err';
  const canvasId = 'canvas-upload-err';
  let jwt: string;

  beforeEach(() => {
    vi.clearAllMocks();
    jwt = signUserToken(userId, 'researcher', 'pro');
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'uploader@example.com',
      name: 'Upload Tester',
      role: 'researcher',
      plan: 'pro',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: dashboardAccessId },
    });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      id: canvasId,
      name: 'Test Canvas',
      dashboardAccessId,
      userId,
    });
    mockPrisma.fileUpload.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0 } });
    mockPrisma.fileUpload.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'file-1', ...data }),
    );
  });

  describe('resolveMediaType', () => {
    it('accepts the OS-registry spellings of the extensions the picker offers', () => {
      expect(resolveMediaType('audio/x-wav', 'interview.wav')).toBe('audio/wav');
      expect(resolveMediaType('audio/wave', 'interview.wav')).toBe('audio/wav');
      expect(resolveMediaType('audio/vnd.wave', 'interview.wav')).toBe('audio/wav');
      expect(resolveMediaType('audio/x-flac', 'interview.flac')).toBe('audio/flac');
      expect(resolveMediaType('audio/mp3', 'interview.mp3')).toBe('audio/mpeg');
      expect(resolveMediaType('audio/m4a', 'interview.m4a')).toBe('audio/mp4');
    });

    it('falls back to the extension when the browser sends no usable type', () => {
      expect(resolveMediaType('application/octet-stream', 'interview.wav')).toBe('audio/wav');
      expect(resolveMediaType('', 'interview.mp3')).toBe('audio/mpeg');
      expect(resolveMediaType('application/octet-stream', 'notes.txt')).toBeNull();
    });

    it('still refuses types that are not recordings at all', () => {
      expect(resolveMediaType('text/html', 'evil.html')).toBeNull();
      expect(resolveMediaType('application/x-msdownload', 'evil.exe')).toBeNull();
    });
  });

  it('accepts a .wav the OS calls audio/x-wav and stores the canonical type', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/direct`)
      .set('Authorization', `Bearer ${jwt}`)
      .attach('file', wavBuffer(), { filename: 'interview.wav', contentType: 'audio/x-wav' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPrisma.fileUpload.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ mimeType: 'audio/wav' }) }),
    );
  });

  it('accepts a .wav the browser reports as application/octet-stream', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/direct`)
      .set('Authorization', `Bearer ${jwt}`)
      .attach('file', wavBuffer(), { filename: 'interview.wav', contentType: 'application/octet-stream' });

    expect(res.status).toBe(200);
    expect(mockPrisma.fileUpload.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ mimeType: 'audio/wav' }) }),
    );
  });

  it('rejects a genuinely unsupported type with 415 and names the accepted formats', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/direct`)
      .set('Authorization', `Bearer ${jwt}`)
      .attach('file', Buffer.from('<html></html>'), { filename: 'evil.html', contentType: 'text/html' });

    expect(res.status).toBe(415);
    expect(res.body.error).toMatch(/text\/html/);
    expect(res.body.error).toMatch(/MP3, WAV, M4A, MP4, OGG, WEBM or FLAC/);
    expect(mockPrisma.fileUpload.create).not.toHaveBeenCalled();
  });

  it('rejects an oversized recording with 413 and states the size limit', async () => {
    const oversized = wavBuffer(26 * 1024 * 1024);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/direct`)
      .set('Authorization', `Bearer ${jwt}`)
      .attach('file', oversized, { filename: 'long-interview.wav', contentType: 'audio/wav' });

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/i);
    expect(res.body.error).toMatch(/25 MB/);
    expect(mockPrisma.fileUpload.create).not.toHaveBeenCalled();
  });
});
