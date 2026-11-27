import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { Readable } from 'node:stream';
import fsPromises from 'node:fs/promises';
import os from 'node:os';

const { mockPrisma, mockStorageUpload } = vi.hoisted(() => {
  const mockStorageUpload = vi.fn();
  const mockPrisma = {
    user: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
    canvasCollaborator: { findUnique: vi.fn() },
    codingCanvas: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    canvasShare: { findUnique: vi.fn(), update: vi.fn() },
    canvasCase: { create: vi.fn() },
    canvasTranscript: { create: vi.fn() },
    canvasQuestion: { create: vi.fn(), update: vi.fn() },
    canvasMemo: { create: vi.fn() },
    canvasTextCoding: { create: vi.fn(), createMany: vi.fn() },
    canvasRelation: { create: vi.fn(), createMany: vi.fn() },
    canvasComputedNode: { create: vi.fn() },
    canvasNodePosition: { create: vi.fn(), createMany: vi.fn() },
    fileUpload: { aggregate: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    transcriptionJob: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    aiUsage: { create: vi.fn() },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma, mockStorageUpload };
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
  checkCanvasLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkShareLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkFileUploadAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkTranscriptionAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkTranscriptLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  resolveRequestPlan: vi.fn().mockResolvedValue('pro'),
}));

vi.mock('../../lib/storage.js', () => ({
  storage: {
    providerName: vi.fn().mockReturnValue('local'),
    getUploadUrl: vi.fn(),
    upload: mockStorageUpload,
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

vi.mock('../../utils/aiKeys.js', () => ({
  resolveTranscriptionKey: vi
    .fn()
    .mockResolvedValue({ apiKey: null, keyOwnerId: null, source: null, isCanvasOwner: true }),
  transcriptionUsageOnKey: vi.fn().mockResolvedValue(null),
  WHISPER_USD_PER_MINUTE: 0.006,
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { shareRoutes, CLONE_BATCH_SIZE } from '../../routes/shareRoutes.js';
import { uploadRoutes } from '../../routes/uploadRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function wavBuffer(sizeBytes = 1024): Buffer {
  const buf = Buffer.alloc(Math.max(64, sizeBytes));
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write('WAVE', 8, 'ascii');
  return buf;
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, shareRoutes, uploadRoutes);
  app.use(errorHandler);
  return app;
}

describe('qualcanvas-17: large canvas clone batching and streaming uploads', () => {
  let app: express.Express;
  const userId = 'user-large-17';
  const dashboardAccessId = 'da-large-17';
  const canvasId = 'canvas-large-17';
  let jwt: string;

  beforeEach(() => {
    vi.clearAllMocks();
    jwt = signUserToken(userId, 'researcher', 'pro');
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'large@example.com',
      name: 'Large Tester',
      role: 'researcher',
      plan: 'pro',
      passwordHash: '$2a$12$hashedpassword',
      dashboardAccess: { id: dashboardAccessId },
    });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({
      id: canvasId,
      name: 'Large Canvas',
      dashboardAccessId,
      userId,
    });
    mockPrisma.fileUpload.aggregate.mockResolvedValue({ _sum: { sizeBytes: 0 } });
    mockPrisma.fileUpload.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'file-1', ...data }),
    );
  });

  it('batches 1,100 codings, 120 relations, and 600 node positions via createMany while preserving provenance', async () => {
    const codingCount = CLONE_BATCH_SIZE * 2 + 100; // 1,100 -> 3 chunks
    const relationCount = 120;
    const positionCount = CLONE_BATCH_SIZE + 100; // 600 -> 2 chunks

    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: 'share-1',
      canvasId: 'src-canvas',
      shareCode: 'SHARE-BIG-1',
      expiresAt: null,
    });
    mockPrisma.codingCanvas.findUnique.mockResolvedValueOnce({
      id: 'src-canvas',
      name: 'Big Study',
      description: 'Large dataset',
      deletedAt: null,
      cases: [{ id: 'case-1', name: 'Site A', attributes: '{}' }],
      transcripts: [{ id: 't-1', title: 'Interview 1', content: 'Hello world', sortOrder: 0, caseId: 'case-1' }],
      questions: [
        { id: 'q-1', text: 'Code 1', color: '#EF4444', sortOrder: 0, parentQuestionId: null },
        { id: 'q-2', text: 'Code 2', color: '#3B82F6', sortOrder: 1, parentQuestionId: 'q-1' },
      ],
      memos: [{ id: 'm-1', title: 'Memo', content: 'Notes', color: '#F59E0B' }],
      codings: Array.from({ length: codingCount }, (_, i) => ({
        id: `coding-${i}`,
        transcriptId: 't-1',
        questionId: i % 2 === 0 ? 'q-1' : 'q-2',
        startOffset: 0,
        endOffset: 5,
        codedText: 'Hello',
        note: null,
        annotation: null,
        source: i % 3 === 0 ? 'ai_accepted' : 'human',
        coderUserId: i % 2 === 0 ? 'coder-a' : 'coder-b',
      })),
      relations: Array.from({ length: relationCount }, (_, i) => ({
        id: `rel-${i}`,
        fromType: 'question',
        fromId: 'q-1',
        toType: 'question',
        toId: 'q-2',
        label: `rel-${i}`,
      })),
      computedNodes: [],
      nodePositions: Array.from({ length: positionCount }, (_, i) => ({
        nodeId: i % 2 === 0 ? 'question-q-1' : 'question-q-2',
        nodeType: 'question',
        x: i * 10,
        y: i * 5,
        width: 240,
        height: 120,
        collapsed: false,
      })),
    });
    mockPrisma.codingCanvas.findFirst.mockResolvedValue(null);
    mockPrisma.codingCanvas.create.mockResolvedValue({ id: 'cloned-canvas', name: 'Big Study (Clone)' });
    mockPrisma.canvasCase.create.mockResolvedValue({ id: 'new-case-1' });
    mockPrisma.canvasTranscript.create.mockResolvedValue({ id: 'new-t-1' });
    mockPrisma.canvasQuestion.create.mockResolvedValueOnce({ id: 'new-q-1' }).mockResolvedValueOnce({ id: 'new-q-2' });
    mockPrisma.canvasQuestion.update.mockResolvedValue({});
    mockPrisma.canvasMemo.create.mockResolvedValue({ id: 'new-m-1' });
    mockPrisma.canvasTextCoding.createMany.mockResolvedValue({ count: CLONE_BATCH_SIZE });
    mockPrisma.canvasRelation.createMany.mockResolvedValue({ count: relationCount });
    mockPrisma.canvasNodePosition.createMany.mockResolvedValue({ count: CLONE_BATCH_SIZE });
    mockPrisma.canvasShare.update.mockResolvedValue({});

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );

    const res = await request(app).post('/api/canvas/clone/SHARE-BIG-1').set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(201);
    expect(mockPrisma.canvasTextCoding.create).not.toHaveBeenCalled();
    expect(mockPrisma.canvasTextCoding.createMany).toHaveBeenCalledTimes(3);
    const allClonedCodings = mockPrisma.canvasTextCoding.createMany.mock.calls.flatMap(
      (call) => (call[0] as { data: { source: string; coderUserId: string }[] }).data,
    );
    expect(allClonedCodings).toHaveLength(codingCount);
    expect(allClonedCodings[0].source).toBe('ai_accepted');
    expect(allClonedCodings[0].coderUserId).toBe('coder-a');
    expect(allClonedCodings[1].source).toBe('human');
    expect(allClonedCodings[1].coderUserId).toBe('coder-b');

    expect(mockPrisma.canvasRelation.create).not.toHaveBeenCalled();
    expect(mockPrisma.canvasRelation.createMany).toHaveBeenCalledTimes(1);

    expect(mockPrisma.canvasNodePosition.create).not.toHaveBeenCalled();
    expect(mockPrisma.canvasNodePosition.createMany).toHaveBeenCalledTimes(2);
  });

  it('streams direct uploads from disk instead of buffering in heap and removes temp file after success', async () => {
    let observedStreamPath: string | undefined;
    mockStorageUpload.mockImplementation(async ({ body, sizeBytes }: { body: Readable; sizeBytes?: number }) => {
      expect(Buffer.isBuffer(body)).toBe(false);
      expect(typeof body.pipe).toBe('function');
      expect(sizeBytes).toBe(4096);
      observedStreamPath = (body as Readable & { path?: string }).path;
      let bytes = 0;
      for await (const chunk of body) {
        bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      }
      return { key: 'k', size: bytes };
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/direct`)
      .set('Authorization', `Bearer ${jwt}`)
      .attach('file', wavBuffer(4096), { filename: 'interview.wav', contentType: 'audio/wav' });

    expect(res.status).toBe(200);
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(observedStreamPath).toBeTruthy();
    expect(observedStreamPath!.startsWith(os.tmpdir())).toBe(true);
    await expect(fsPromises.access(observedStreamPath!)).rejects.toThrow();
  });

  it('removes the temp file when magic-byte validation rejects a spoofed upload', async () => {
    const before = new Set((await fsPromises.readdir(os.tmpdir())).filter((f) => f.startsWith('qualcanvas-upload-')));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/direct`)
      .set('Authorization', `Bearer ${jwt}`)
      .attach('file', Buffer.from('<html>not audio</html>'), {
        filename: 'fake.wav',
        contentType: 'audio/wav',
      });

    expect(res.status).toBe(400);
    expect(mockStorageUpload).not.toHaveBeenCalled();

    const after = (await fsPromises.readdir(os.tmpdir())).filter(
      (f) => f.startsWith('qualcanvas-upload-') && !before.has(f),
    );
    expect(after).toEqual([]);
  });

  it('closes and unlinks the temp file without unhandled errors when storage.upload does not consume the stream', async () => {
    let observedStreamPath: string | undefined;
    mockStorageUpload.mockImplementation(async ({ body }: { body: Readable }) => {
      observedStreamPath = (body as Readable & { path?: string }).path;
      // Return immediately without reading the stream (exercises pending open + destroy + unlink race)
      return { key: 'k', size: 1024 };
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/direct`)
      .set('Authorization', `Bearer ${jwt}`)
      .attach('file', wavBuffer(1024), { filename: 'unread.wav', contentType: 'audio/wav' });

    expect(res.status).toBe(200);
    expect(observedStreamPath).toBeTruthy();
    await expect(fsPromises.access(observedStreamPath!)).rejects.toThrow();
  });

  it('closes and unlinks the temp file without unhandled errors when storage.upload rejects immediately', async () => {
    let observedStreamPath: string | undefined;
    mockStorageUpload.mockImplementation(async ({ body }: { body: Readable }) => {
      observedStreamPath = (body as Readable & { path?: string }).path;
      throw new Error('simulated storage failure');
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/upload/direct`)
      .set('Authorization', `Bearer ${jwt}`)
      .attach('file', wavBuffer(1024), { filename: 'reject.wav', contentType: 'audio/wav' });

    expect(res.status).toBe(500);
    expect(observedStreamPath).toBeTruthy();
    await expect(fsPromises.access(observedStreamPath!)).rejects.toThrow();
  });
});
