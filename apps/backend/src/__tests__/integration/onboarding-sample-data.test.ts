/**
 * Real-Postgres regression for the starter template's seeded study:
 *
 *  - DELETE /canvas/:id/sample-data removes the sample transcripts, their
 *    codings and unedited sample memos in one step, and leaves the codebook,
 *    the researcher's own transcripts/codings and edited memos alone;
 *  - GET /admin/usage never counts seeded rows as a researcher's transcript or
 *    coding milestone, or in the content totals.
 *
 * Skipped unless QC_INTEGRATION_DATABASE_URL points at a migrated, seeded
 * database (the seed provides the starter templates); see
 * postgres-races.test.ts for the setup recipe.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const DB_URL = vi.hoisted(() => {
  const url = process.env.QC_INTEGRATION_DATABASE_URL;
  if (url) process.env.DATABASE_URL = url;
  return url;
});

vi.mock('../../lib/lifecycleEmail.js', () => ({
  createEmailCampaign: vi.fn(),
  getEmailStats: vi.fn(),
  listEmailCampaigns: vi.fn(),
  sendCampaign: vi.fn(),
}));
vi.mock('../../lib/jms-events.js', () => ({ trackJmsEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../middleware/auditLog.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../middleware/auditLog.js')>();
  return { ...original, logAudit: vi.fn() };
});

import request from 'supertest';
import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { adminRoutes } from '../../routes/adminRoutes.js';
import { canvasRoutes } from '../../routes/canvasRoutes.js';
import { templateRoutes } from '../../routes/templateRoutes.js';
import { auth } from '../../middleware/auth.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

const ADMIN_KEY = 'integration-admin-key';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/admin', adminRoutes);
  app.use('/api', auth, templateRoutes, canvasRoutes);
  app.use(errorHandler);
  return app;
}

interface UsageData {
  activation: { stages: { key: string; users: number }[] };
  content: { transcriptsCreated: number; codingsCreated: number };
}

describe.skipIf(!DB_URL)('Starter sample study on Postgres', () => {
  const app = createApp();
  const runId = randomUUID().slice(0, 8);
  let userId = '';
  let accessId = '';
  let jwt = '';
  let canvasId = '';

  const usage = async (): Promise<UsageData> => {
    const res = await request(app).get('/admin/usage?period=1d').set('x-admin-key', ADMIN_KEY);
    expect(res.status).toBe(200);
    return res.body.data as UsageData;
  };
  const stageUsers = (data: UsageData, key: string) => data.activation.stages.find((s) => s.key === key)?.users ?? 0;
  const authed = (req: request.Test) => req.set('Cookie', `qc_token=${jwt}`).set('Authorization', `Bearer ${jwt}`);

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    const user = await prisma.user.create({
      data: {
        email: `researcher-${runId}@ucc.ie`,
        passwordHash: 'not-a-real-hash',
        name: 'Sample Study',
        plan: 'free',
        dashboardAccess: {
          create: {
            accessCode: `ss-${runId}`,
            name: 'Sample Study',
            role: 'researcher',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
      include: { dashboardAccess: true },
    });
    userId = user.id;
    accessId = user.dashboardAccess!.id;
    jwt = signUserToken(userId, 'researcher', 'free');

    const template = await prisma.canvasTemplate.findFirst({
      where: { name: 'Thematic Analysis (Braun & Clarke)' },
      select: { id: true },
    });
    expect(template, 'seed the database first: npm run db:seed -w apps/backend').toBeTruthy();
    const res = await authed(
      request(app)
        .post(`/api/canvas/templates/${template!.id}/instantiate`)
        .send({
          canvasName: `Sample study ${runId}`,
          includeSampleData: true,
        }),
    );
    expect(res.status).toBe(201);
    canvasId = res.body.data.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.codingCanvas.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    if (accessId) await prisma.dashboardAccess.deleteMany({ where: { id: accessId } });
    await prisma.$disconnect();
  });

  it('does not count a seeded study as the researcher adding or coding a transcript', async () => {
    const seeded = await prisma.canvasTranscript.count({ where: { canvasId, sourceType: 'sample' } });
    expect(seeded).toBeGreaterThan(0);
    const data = await usage();
    const own = await prisma.canvasTranscript.count({
      where: { canvas: { userId }, OR: [{ sourceType: null }, { sourceType: { not: 'sample' } }] },
    });
    expect(own).toBe(0);
    // The only rows this user has are samples, so the user must not appear in
    // either milestone. Other data in the database is compared out by checking
    // the stage counts with and without this user's own rows below.
    const before = { transcript: stageUsers(data, 'transcript'), coding: stageUsers(data, 'coding') };

    const question = await prisma.canvasQuestion.findFirstOrThrow({ where: { canvasId } });
    const transcript = await prisma.canvasTranscript.create({
      data: { canvasId, title: 'My own interview', content: 'I found the forms confusing at first.' },
    });
    await prisma.canvasTextCoding.create({
      data: {
        canvasId,
        transcriptId: transcript.id,
        questionId: question.id,
        startOffset: 0,
        endOffset: 20,
        codedText: 'I found the forms co',
        coderUserId: userId,
      },
    });
    const after = await usage();
    expect(stageUsers(after, 'transcript') - before.transcript).toBe(1);
    expect(stageUsers(after, 'coding') - before.coding).toBe(1);
    expect(after.content.transcriptsCreated - data.content.transcriptsCreated).toBe(1);
    expect(after.content.codingsCreated - data.content.codingsCreated).toBe(1);
  });

  it('removes the seeded study in one step and keeps everything the researcher made', async () => {
    const memos = await prisma.canvasMemo.findMany({ where: { canvasId }, orderBy: { createdAt: 'asc' } });
    expect(memos.length).toBeGreaterThan(0);
    // The researcher edits one sample memo: it is now theirs.
    await prisma.canvasMemo.update({ where: { id: memos[0].id }, data: { content: `${memos[0].content} Mine now.` } });
    const codesBefore = await prisma.canvasQuestion.count({ where: { canvasId } });

    const res = await authed(request(app).delete(`/api/canvas/${canvasId}/sample-data`));
    expect(res.status).toBe(200);
    expect(res.body.data.removed.transcripts).toBeGreaterThan(0);
    expect(res.body.data.removed.codings).toBeGreaterThan(0);
    expect(res.body.data.removed.memos).toBe(memos.length - 1);

    expect(await prisma.canvasTranscript.count({ where: { canvasId, sourceType: 'sample' } })).toBe(0);
    expect(await prisma.canvasTextCoding.count({ where: { canvasId, source: 'sample' } })).toBe(0);
    expect(await prisma.canvasTranscript.count({ where: { canvasId } })).toBe(1);
    expect(await prisma.canvasTextCoding.count({ where: { canvasId } })).toBe(1);
    expect(await prisma.canvasMemo.count({ where: { canvasId } })).toBe(1);
    expect(await prisma.canvasQuestion.count({ where: { canvasId } })).toBe(codesBefore);
  });

  it('refuses a user who does not own the canvas', async () => {
    const stranger = signUserToken(`stranger-${runId}`, 'researcher', 'free');
    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/sample-data`)
      .set('Cookie', `qc_token=${stranger}`)
      .set('Authorization', `Bearer ${stranger}`);
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });
});

describe.skipIf(Boolean(DB_URL))('Starter sample study on Postgres', () => {
  it.skip('QC_INTEGRATION_DATABASE_URL is not set; see the header comment to run these', () => {});
});
