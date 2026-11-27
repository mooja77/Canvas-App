/**
 * Real-Postgres twin of audio-import-allowance.test.ts: the plan lookup, the
 * counter column, the migration and the transaction are the real ones. Skipped
 * unless QC_INTEGRATION_DATABASE_URL points at a migrated database (see
 * postgres-races.test.ts for the three setup commands).
 */
import { describe, it, expect, vi, afterAll } from 'vitest';

const DB_URL = vi.hoisted(() => {
  const url = process.env.QC_INTEGRATION_DATABASE_URL;
  if (url) process.env.DATABASE_URL = url;
  return url;
});

vi.mock('../../lib/jms-events.js', () => ({ trackJmsEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/storage.js', () => ({
  storage: {
    providerName: vi.fn().mockReturnValue('local'),
    getUploadUrl: vi.fn(),
    upload: vi.fn().mockResolvedValue({ size: 1024 }),
    delete: vi.fn().mockResolvedValue(undefined),
    head: vi.fn(),
  },
}));
vi.mock('../../lib/storage-local.js', () => ({}));
vi.mock('../../lib/storage-s3.js', () => ({}));
vi.mock('../../lib/jobs.js', () => ({ createJob: vi.fn(), registerJobHandler: vi.fn() }));

import request from 'supertest';
import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma.js';
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

describe.skipIf(!DB_URL)('audio import allowance on real Postgres', () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, uploadRoutes);
  app.use(errorHandler);
  const runId = randomUUID().slice(0, 8);
  const made: { userIds: string[]; accessIds: string[] } = { userIds: [], accessIds: [] };

  async function account(tag: string, plan: string) {
    const user = await prisma.user.create({
      data: {
        email: `audio-${tag}-${runId}@qualcanvas.test`,
        passwordHash: 'not-a-real-hash',
        name: `Audio ${tag}`,
        plan,
        emailVerified: true,
        dashboardAccess: {
          create: {
            accessCode: `AUD-${tag}-${runId}`,
            name: tag,
            role: 'researcher',
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        },
      },
      include: { dashboardAccess: true },
    });
    made.userIds.push(user.id);
    made.accessIds.push(user.dashboardAccess!.id);
    const canvas = await prisma.codingCanvas.create({
      data: { name: `Audio ${tag}`, dashboardAccessId: user.dashboardAccess!.id, userId: user.id },
    });
    return { userId: user.id, canvasId: canvas.id, jwt: signUserToken(user.id, 'researcher', plan) };
  }
  const upload = (a: { jwt: string; canvasId: string }) =>
    request(app)
      .post(`/api/canvas/${a.canvasId}/upload/direct`)
      .set('Authorization', `Bearer ${a.jwt}`)
      .attach('file', wav(), { filename: 'interview.wav', contentType: 'audio/wav' });
  const used = async (userId: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { audioImportsUsed: true } }))
      .audioImportsUsed;

  afterAll(async () => {
    for (const id of made.userIds) await prisma.user.delete({ where: { id } }).catch(() => {});
    for (const id of made.accessIds) await prisma.dashboardAccess.delete({ where: { id } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('first file allowed, second refused with a specific code, delete does not give it back', async () => {
    const a = await account('one', 'free');
    expect((await upload(a)).status).toBe(200);
    expect(await used(a.userId)).toBe(1);
    const second = await upload(a);
    expect(second.status).toBe(403);
    expect(second.body.code).toBe('AUDIO_IMPORT_LIMIT_REACHED');
    await prisma.fileUpload.deleteMany({ where: { canvasId: a.canvasId } });
    const third = await upload(a);
    expect(third.body.code).toBe('AUDIO_IMPORT_LIMIT_REACHED');
    expect(await used(a.userId)).toBe(1);
    expect(await prisma.fileUpload.count({ where: { canvasId: a.canvasId } })).toBe(0);
  });

  it('two simultaneous uploads: exactly one is accepted', async () => {
    const a = await account('race', 'free');
    const [r1, r2] = await Promise.all([upload(a), upload(a)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 403]);
    expect(await prisma.fileUpload.count({ where: { canvasId: a.canvasId } })).toBe(1);
    expect(await used(a.userId)).toBe(1);
  });

  it('tenant isolation: another free account keeps its own file; cross-canvas upload spends nothing', async () => {
    const a = await account('iso-a', 'free');
    const b = await account('iso-b', 'free');
    expect((await upload(a)).status).toBe(200);
    expect((await upload(b)).status).toBe(200);
    const cross = await upload({ jwt: b.jwt, canvasId: a.canvasId });
    expect(cross.status).not.toBe(200);
    expect(await used(a.userId)).toBe(1);
    expect(await used(b.userId)).toBe(1);
  });

  it('a paid account is unlimited', async () => {
    const a = await account('pro', 'pro');
    for (let i = 0; i < 3; i++) expect((await upload(a)).status).toBe(200);
    expect(await prisma.fileUpload.count({ where: { canvasId: a.canvasId } })).toBe(3);
  });
});
