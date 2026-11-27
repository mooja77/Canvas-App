// Free plan: ONE audio file import per account, on the customer's own key.
// Mocked Prisma with a small stateful store (the real-Postgres twin of these
// tests is audio-import-allowance.postgres.test.ts, skipped without a database).
//
// Covered: first file allowed; second refused with a specific code
// (AUDIO_IMPORT_LIMIT_REACHED) and a friendly message; deleting the file does
// not hand the allowance back; paid plans unlimited as before; no key keeps
// the existing "connect your AI account" answer; one account's use never
// touches another's.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { Readable } from 'node:stream';

const { store, mockPrisma, planFor } = vi.hoisted(() => {
  type U = { id: string; plan: string; audioImportsUsed: number };
  const store = {
    users: {} as Record<string, U>,
    canvases: {} as Record<string, { id: string; userId: string; dashboardAccessId: string }>,
    files: [] as Array<Record<string, unknown>>,
  };
  const userRow = (u: U) => ({
    id: u.id,
    email: `${u.id}@example.test`,
    name: u.id,
    role: 'researcher',
    plan: u.plan,
    passwordHash: 'x',
    audioImportsUsed: u.audioImportsUsed,
    dashboardAccess: { id: `da-${u.id}` },
  });
  type Counter = { audioImportsUsed: { increment: number } };
  const mockPrisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        store.users[where.id] ? userRow(store.users[where.id]) : null,
      ),
      updateMany: vi.fn(
        async ({ where, data }: { where: { id: string; audioImportsUsed: { lt: number } }; data: Counter }) => {
          const u = store.users[where.id];
          if (!u || !(u.audioImportsUsed < where.audioImportsUsed.lt)) return { count: 0 };
          u.audioImportsUsed += data.audioImportsUsed.increment;
          return { count: 1 };
        },
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Counter }) => {
        store.users[where.id].audioImportsUsed += data.audioImportsUsed.increment;
        return userRow(store.users[where.id]);
      }),
    },
    subscription: { findUnique: vi.fn() },
    canvasCollaborator: { findUnique: vi.fn() },
    codingCanvas: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const c = store.canvases[where.id];
        return c ? { ...c, name: 'Canvas', dashboardAccess: { userId: c.userId } } : null;
      }),
    },
    fileUpload: {
      aggregate: vi.fn(async () => ({ _sum: { sizeBytes: 0 } })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `file-${store.files.length + 1}`, ...data };
        store.files.push(row);
        return row;
      }),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string } }) => store.files.find((f) => f.id === where.id) ?? null,
      ),
      findUnique: vi.fn(),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        store.files = store.files.filter((f) => f.id !== where.id);
      }),
    },
    transcriptionJob: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    canvasTranscript: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    aiUsage: { create: vi.fn() },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  };
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma));
  // The plan is the canvas OWNER's plan, as in resolveRequestPlan.
  const planFor = (canvasId: string) => store.users[store.canvases[canvasId]?.userId]?.plan ?? 'free';
  return { store, mockPrisma, planFor };
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
// Plan limits come from the real table (shared/types/plans.ts); only the plan
// lookup and the not-included gate read the mock store.
vi.mock('../../middleware/planLimits.js', () => ({
  checkFileUploadAccess: () => (req: Request, res: Response, next: NextFunction) => {
    if (planFor(req.params.id) === 'free') {
      return res
        .status(403)
        .json({ success: false, error: 'File upload is available on paid plans.', code: 'PLAN_LIMIT_EXCEEDED' });
    }
    next();
  },
  checkTranscriptionAccess: () => (req: Request, res: Response, next: NextFunction) => {
    if (planFor(req.params.id) === 'free') {
      return res.status(403).json({
        success: false,
        error: 'Audio transcription is available on paid plans.',
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }
    next();
  },
  checkTranscriptLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  resolveRequestPlan: vi.fn(async (req: Request) => planFor(req.params.id)),
}));
const { storageDelete } = vi.hoisted(() => ({ storageDelete: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/storage.js', () => ({
  storage: {
    providerName: vi.fn().mockReturnValue('local'),
    getUploadUrl: vi.fn(),
    upload: vi.fn().mockResolvedValue({ size: 1024 }),
    delete: storageDelete,
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
vi.mock('../../utils/transcription.js', () => ({ transcribeAudio: vi.fn(), getLocalUploadPath: vi.fn() }));
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
import { uploadRoutes } from '../../routes/uploadRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function wav(): Buffer {
  const buf = Buffer.alloc(64);
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
function addUser(id: string, plan: string, used = 0) {
  store.users[id] = { id, plan, audioImportsUsed: used };
  store.canvases[`canvas-${id}`] = { id: `canvas-${id}`, userId: id, dashboardAccessId: `da-${id}` };
  return signUserToken(id, 'researcher', plan);
}

describe('Free plan: one audio import per account', () => {
  const app = createApp();
  const upload = (jwt: string, canvasId: string) =>
    request(app)
      .post(`/api/canvas/${canvasId}/upload/direct`)
      .set('Authorization', `Bearer ${jwt}`)
      .attach('file', wav(), { filename: 'interview.wav', contentType: 'audio/wav' });

  beforeEach(() => {
    store.users = {};
    store.canvases = {};
    store.files = [];
    storageDelete.mockClear();
  });

  it('allows the first file and counts it on the account', async () => {
    const jwt = addUser('free-a', 'free');
    const res = await upload(jwt, 'canvas-free-a');
    expect(res.status).toBe(200);
    expect(store.users['free-a'].audioImportsUsed).toBe(1);
  });

  it('refuses the second file with AUDIO_IMPORT_LIMIT_REACHED and a friendly message, storing nothing', async () => {
    const jwt = addUser('free-b', 'free');
    expect((await upload(jwt, 'canvas-free-b')).status).toBe(200);
    const res = await upload(jwt, 'canvas-free-b');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUDIO_IMPORT_LIMIT_REACHED');
    expect(res.body).toMatchObject({ limit: 'maxAudioImports', current: 1, max: 1, upgrade: true });
    expect(res.body.error).toMatch(/Free plan includes 1 audio file/);
    expect(res.body.error).toMatch(/Upgrade/);
    expect(res.body.error).not.toMatch(/refund|guarantee/i);
    expect(store.files).toHaveLength(1);
    expect(store.users['free-b'].audioImportsUsed).toBe(1);
  });

  it('does not hand the allowance back when the file is deleted', async () => {
    const jwt = addUser('free-c', 'free');
    const first = await upload(jwt, 'canvas-free-c');
    await mockPrisma.fileUpload.delete({ where: { id: first.body.data.id } });
    expect(store.files).toHaveLength(0);
    const again = await upload(jwt, 'canvas-free-c');
    expect(again.status).toBe(403);
    expect(again.body.code).toBe('AUDIO_IMPORT_LIMIT_REACHED');
  });

  it('is per account: a second canvas of the same account is still refused', async () => {
    const jwt = addUser('free-d', 'free');
    store.canvases['canvas-free-d-2'] = { id: 'canvas-free-d-2', userId: 'free-d', dashboardAccessId: 'da-free-d' };
    expect((await upload(jwt, 'canvas-free-d')).status).toBe(200);
    expect((await upload(jwt, 'canvas-free-d-2')).body.code).toBe('AUDIO_IMPORT_LIMIT_REACHED');
  });

  it('tenant isolation: one account using its file does not touch another account', async () => {
    const jwtA = addUser('iso-a', 'free');
    const jwtB = addUser('iso-b', 'free');
    expect((await upload(jwtA, 'canvas-iso-a')).status).toBe(200);
    expect((await upload(jwtA, 'canvas-iso-a')).status).toBe(403);
    // B still has their own first file.
    expect((await upload(jwtB, 'canvas-iso-b')).status).toBe(200);
    expect(store.users['iso-a'].audioImportsUsed).toBe(1);
    expect(store.users['iso-b'].audioImportsUsed).toBe(1);
    // B cannot upload into A's canvas, and that never spends A's or B's count.
    const cross = await upload(jwtB, 'canvas-iso-a');
    expect(cross.status).not.toBe(200);
    expect(store.users['iso-a'].audioImportsUsed).toBe(1);
    expect(store.users['iso-b'].audioImportsUsed).toBe(1);
  });

  it('paid plans stay unlimited and are not blocked by the counter', async () => {
    const jwt = addUser('pro-a', 'pro', 5);
    for (let i = 0; i < 3; i++) expect((await upload(jwt, 'canvas-pro-a')).status).toBe(200);
    expect(store.files).toHaveLength(3);
  });

  it('an account back on Free that already used its allowance is held to the Free limit', async () => {
    const jwt = addUser('lapsed', 'free', 4);
    const res = await upload(jwt, 'canvas-lapsed');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUDIO_IMPORT_LIMIT_REACHED');
  });

  it('two simultaneous uploads cannot both slip under the limit', async () => {
    const jwt = addUser('race', 'free');
    const [r1, r2] = await Promise.all([upload(jwt, 'canvas-race'), upload(jwt, 'canvas-race')]);
    expect([r1.status, r2.status].sort()).toEqual([200, 403]);
    expect(store.files).toHaveLength(1);
  });

  it('with no key, transcription gives the existing "connect your AI account" answer', async () => {
    const jwt = addUser('nokey', 'free');
    const up = await upload(jwt, 'canvas-nokey');
    const res = await request(app)
      .post('/api/canvas/canvas-nokey/transcribe')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ fileUploadId: up.body.data.id });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSCRIPTION_KEY_REQUIRED');
    expect(res.body.error).toMatch(/Connect your AI account/);
  });

  it('the transcription screen reports used and allowed', async () => {
    const jwt = addUser('screen', 'free');
    const res = await request(app)
      .get('/api/canvas/canvas-screen/transcribe/allowance')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ fileUploadEnabled: false, audioImportsUsed: 0, maxAudioImports: 1 });
  });

  it('paid plans report no limit on the screen', async () => {
    const jwt = addUser('screen-pro', 'pro');
    const res = await request(app)
      .get('/api/canvas/canvas-screen-pro/transcribe/allowance')
      .set('Authorization', `Bearer ${jwt}`);
    expect(res.body.data).toMatchObject({ fileUploadEnabled: true, maxAudioImports: null });
  });
});
