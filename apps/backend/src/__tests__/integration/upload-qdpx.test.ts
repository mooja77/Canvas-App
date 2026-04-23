import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    codingCanvas: {
      findUnique: vi.fn(),
    },
    fileUpload: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    transcriptionJob: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    canvasTranscript: {
      create: vi.fn(),
    },
    aiUsage: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

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

// Plan limits — pass through by default
vi.mock('../../middleware/planLimits.js', () => ({
  checkCanvasLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkTranscriptLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkWordLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCodeLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAutoCode: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCaseAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkShareLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAnalysisType: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAnalysisTypeOnRun: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkRepositoryAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkIntegrationsAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkFileUploadAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkExportFormat: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock12nanoid'),
}));

vi.mock('../../lib/stripe.js', () => ({
  getStripe: vi.fn().mockReturnValue({
    subscriptions: { cancel: vi.fn() },
  }),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(),
  },
}));

// Mock storage
vi.mock('../../lib/storage.js', () => ({
  storage: {
    getUploadUrl: vi.fn().mockResolvedValue({ url: 'https://s3.example.com/presigned-url' }),
    upload: vi.fn().mockResolvedValue({ size: 1024 }),
    download: vi.fn(),
  },
}));

vi.mock('../../lib/storage-local.js', () => ({}));

// Mock jobs
vi.mock('../../lib/jobs.js', () => ({
  createJob: vi.fn().mockReturnValue({ id: 'job-1' }),
  registerJobHandler: vi.fn(),
}));

// Mock transcription
vi.mock('../../utils/transcription.js', () => ({
  transcribeAudio: vi.fn(),
  getLocalUploadPath: vi.fn(),
}));

// Mock QDPX export/import — hoisted so they can be referenced in vi.mock
const { mockExportQdpx, mockImportQdpx } = vi.hoisted(() => ({
  mockExportQdpx: vi.fn(),
  mockImportQdpx: vi.fn(),
}));

vi.mock('../../utils/qdpxExport.js', () => ({
  exportQdpx: mockExportQdpx,
}));

vi.mock('../../utils/qdpxImport.js', () => ({
  importQdpx: mockImportQdpx,
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { uploadRoutes } from '../../routes/uploadRoutes.js';
import { qdpxRoutes } from '../../routes/qdpxRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, uploadRoutes);
  app.use('/api', auth, qdpxRoutes);
  app.use(errorHandler);
  return app;
}

describe('Upload and QDPX integration tests', () => {
  let app: express.Express;
  const userId = 'user-upload-1';
  const dashboardAccessId = 'da-upload-1';
  const canvasId = 'canvas-upload-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'uploader@example.com',
    name: 'Upload Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const mockCanvas = {
    id: canvasId,
    name: 'Test Canvas',
    dashboardAccessId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    jwt = signUserToken(userId, 'researcher', 'pro');
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
  });

  // ═══════════════════════════════════════
  // Upload Routes
  // ═══════════════════════════════════════

  // ─── 1. POST /canvas/:id/upload/presigned returns upload URL + key ───
  it('POST /canvas/:id/upload/presigned returns upload URL and key', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/presigned`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ fileName: 'interview.mp3', contentType: 'audio/mpeg' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uploadUrl).toBe('https://s3.example.com/presigned-url');
    expect(res.body.data.storageKey).toContain(`canvas/${canvasId}/`);
  });

  // ─── 2. POST /canvas/:id/upload/presigned rejects missing params ───
  it('POST /canvas/:id/upload/presigned rejects missing fileName', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/presigned`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ contentType: 'audio/mpeg' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 3. POST /canvas/:id/upload/confirm creates file record ───
  it('POST /canvas/:id/upload/confirm creates file record', async () => {
    const fileRecord = {
      id: 'file-1',
      canvasId,
      userId,
      storageKey: 'canvas/1/abc.mp3',
      originalName: 'interview.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 5000,
      status: 'uploaded',
    };
    mockPrisma.fileUpload.create.mockResolvedValue(fileRecord);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/confirm`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        storageKey: 'canvas/1/abc.mp3',
        originalName: 'interview.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 5000,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('file-1');
    expect(mockPrisma.fileUpload.create).toHaveBeenCalledOnce();
  });

  // ─── 4. POST /canvas/:id/upload/confirm rejects missing fields ───
  it('POST /canvas/:id/upload/confirm rejects missing storageKey', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/confirm`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ originalName: 'interview.mp3', mimeType: 'audio/mpeg' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 5. POST /canvas/:id/transcribe creates transcription job ───
  it('POST /canvas/:id/transcribe creates transcription job', async () => {
    const fileUploadId = 'file-1';
    mockPrisma.fileUpload.findFirst.mockResolvedValue({
      id: fileUploadId,
      canvasId,
      storageKey: 'canvas/1/abc.mp3',
    });
    mockPrisma.transcriptionJob.create.mockResolvedValue({
      id: 'tjob-1',
      fileUploadId,
      canvasId,
      status: 'queued',
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcribe`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ fileUploadId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBe('tjob-1');
  });

  // ─── 6. POST /canvas/:id/transcribe rejects missing fileUploadId ───
  it('POST /canvas/:id/transcribe rejects missing fileUploadId', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcribe`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 7. GET /canvas/:id/transcribe/:jobId returns job status ───
  it('GET /canvas/:id/transcribe/:jobId returns job status', async () => {
    const jobId = 'tjob-1';
    mockPrisma.transcriptionJob.findFirst.mockResolvedValue({
      id: jobId,
      canvasId,
      status: 'processing',
      progress: 50,
    });

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/transcribe/${jobId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('processing');
    expect(res.body.data.progress).toBe(50);
  });

  // ─── 8. GET /canvas/:id/transcribe/:jobId returns 404 for unknown job ───
  it('GET /canvas/:id/transcribe/:jobId returns 404 for unknown job', async () => {
    mockPrisma.transcriptionJob.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/transcribe/nonexistent`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
  });

  // ─── 9. Upload on another user's canvas returns 403 ───
  it('POST /canvas/:id/upload/presigned on another user canvas returns 403', async () => {
    const otherUserId = 'user-other';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');
    const otherUser = {
      id: otherUserId,
      email: 'other@example.com',
      name: 'Other User',
      role: 'researcher',
      plan: 'pro',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: 'da-other' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(otherUser);
    // Canvas belongs to original user
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/presigned`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ fileName: 'hack.mp3', contentType: 'audio/mpeg' });

    expect(res.status).toBe(403);
  });

  // ═══════════════════════════════════════
  // QDPX Routes
  // ═══════════════════════════════════════

  // ─── 10. GET /canvas/:id/export/qdpx returns QDPX buffer ───
  it('GET /canvas/:id/export/qdpx returns QDPX data', async () => {
    const qdpxBuffer = Buffer.from('PK mock zip content');
    mockExportQdpx.mockResolvedValue(qdpxBuffer);

    const res = await request(app).get(`/api/canvas/${canvasId}/export/qdpx`).set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('canvas-export.qdpx');
    expect(mockExportQdpx).toHaveBeenCalledWith(canvasId);
  });

  // ─── 11. GET /canvas/:id/export/qdpx on empty canvas returns valid response ───
  it('GET /canvas/:id/export/qdpx on empty canvas returns valid QDPX', async () => {
    const emptyQdpx = Buffer.from('PK empty qdpx');
    mockExportQdpx.mockResolvedValue(emptyQdpx);

    const res = await request(app).get(`/api/canvas/${canvasId}/export/qdpx`).set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
  });

  // ─── 12. GET /canvas/:id/export/qdpx on another user's canvas returns 403 ───
  it('GET /canvas/:id/export/qdpx on another user canvas returns 403', async () => {
    const otherUserId = 'user-other-qdpx';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');
    const otherUser = {
      id: otherUserId,
      email: 'otherqdpx@example.com',
      name: 'Other User',
      role: 'researcher',
      plan: 'pro',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: 'da-other-qdpx' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(otherUser);
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/export/qdpx`)
      .set('Authorization', `Bearer ${otherJwt}`);

    expect(res.status).toBe(403);
  });

  // ─── 13. POST /canvas/:id/import/qdpx creates canvas from QDPX ───
  it('POST /canvas/:id/import/qdpx imports QDPX file', async () => {
    mockImportQdpx.mockResolvedValue({ codes: 5, sources: 3, codings: 12 });

    // Proper ZIP local file header signature so magic-bytes validation passes.
    const zipFixture = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(' mock qdpx')]);
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import/qdpx`)
      .set('Authorization', `Bearer ${jwt}`)
      .attach('file', zipFixture, { filename: 'export.qdpx' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.codes).toBe(5);
    expect(res.body.sources).toBe(3);
    expect(res.body.codings).toBe(12);
    expect(mockImportQdpx).toHaveBeenCalledWith(canvasId, expect.any(Buffer));
  });

  // ─── 14. POST /canvas/:id/import/qdpx with no file returns 400 ───
  it('POST /canvas/:id/import/qdpx with no file returns 400', async () => {
    const res = await request(app).post(`/api/canvas/${canvasId}/import/qdpx`).set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 15. POST /canvas/:id/import/qdpx on another user's canvas returns 403 ───
  it('POST /canvas/:id/import/qdpx on another user canvas returns 403', async () => {
    const otherUserId = 'user-other-import';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');
    const otherUser = {
      id: otherUserId,
      email: 'otherimport@example.com',
      name: 'Other User',
      role: 'researcher',
      plan: 'pro',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: 'da-other-import' },
    };
    mockPrisma.user.findUnique.mockResolvedValue(otherUser);
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/import/qdpx`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .attach('file', Buffer.from('PK mock qdpx'), { filename: 'export.qdpx' });

    expect(res.status).toBe(403);
  });
});
