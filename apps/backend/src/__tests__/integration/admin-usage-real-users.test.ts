/**
 * Real-Postgres regression for GET /admin/usage (bug hunt 2026-09-02):
 *
 *  - every sub-aggregate (computed nodes by type, AI usage by feature, AI cost
 *    total, action breakdown, top users) excludes test accounts the way the
 *    headline counts already did;
 *  - a cohort member whose only coding is as a collaborator on somebody
 *    else's canvas activates in the funnel.
 *
 * Skipped unless QC_INTEGRATION_DATABASE_URL points at a migrated database;
 * see postgres-races.test.ts for the setup recipe.
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

import request from 'supertest';
import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { adminRoutes } from '../../routes/adminRoutes.js';

const ADMIN_KEY = 'integration-admin-key';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRoutes);
  return app;
}

interface UsageBody {
  data: {
    activation: { activatedUsers: number; stages: { key: string; users: number }[] };
    content: { computedNodeRuns: number };
    features: {
      computedNodes: { type: string; count: number }[];
      aiUsage: { feature: string; count: number; costCents: number }[];
    };
    ai: { totalCostCents: number };
    actionBreakdown: { action: string; count: number }[];
    topUsers: { userId: string; actionCount: number }[];
  };
}

describe.skipIf(!DB_URL)('GET /admin/usage on Postgres: test accounts excluded, collaborators activated', () => {
  const app = createApp();
  const runId = randomUUID().slice(0, 8);
  const tag = `bh-${runId}`;
  let realId = '';
  let testId = '';
  const accessIds: string[] = [];
  let baseline: UsageBody['data'];

  const getUsage = async (): Promise<UsageBody['data']> => {
    const res = await request(app).get('/admin/usage?period=1d').set('x-admin-key', ADMIN_KEY);
    expect(res.status).toBe(200);
    return (res.body as UsageBody).data;
  };

  async function createUser(email: string) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'not-a-real-hash',
        name: email.split('@')[0],
        dashboardAccess: {
          create: {
            accessCode: `${tag}-${email.slice(0, 4)}`,
            name: email,
            role: 'researcher',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
      include: { dashboardAccess: true },
    });
    accessIds.push(user.dashboardAccess!.id);
    return user;
  }

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    const real = await createUser(`real-${runId}@ucc.ie`);
    const test = await createUser(`test-${runId}@example.com`);
    realId = real.id;
    testId = test.id;

    // Both users exist and are (or are not) in the cohort; no activity yet.
    baseline = await getUsage();

    const realCanvas = await prisma.codingCanvas.create({
      data: { name: `${tag} real`, dashboardAccessId: real.dashboardAccess!.id, userId: realId },
    });
    const testCanvas = await prisma.codingCanvas.create({
      data: { name: `${tag} test`, dashboardAccessId: test.dashboardAccess!.id, userId: testId },
    });

    await prisma.canvasComputedNode.createMany({
      data: [
        { canvasId: realCanvas.id, nodeType: `${tag}-real`, label: 'r' },
        { canvasId: testCanvas.id, nodeType: `${tag}-test`, label: 't' },
      ],
    });
    await prisma.aiUsage.createMany({
      data: [
        { userId: realId, feature: tag, provider: 'openai', model: 'm', costCents: 7 },
        { userId: testId, feature: tag, provider: 'openai', model: 'm', costCents: 1000 },
      ],
    });
    await prisma.auditLog.createMany({
      data: [
        ...Array.from({ length: 3 }, () => ({ action: tag, resource: 'x', actorType: 'user', actorId: realId })),
        ...Array.from({ length: 40 }, () => ({ action: tag, resource: 'x', actorType: 'user', actorId: testId })),
      ],
    });

    // The real user's only coding is on the TEST user's canvas, as an invited coder.
    const question = await prisma.canvasQuestion.create({ data: { canvasId: testCanvas.id, text: 'Q' } });
    const transcript = await prisma.canvasTranscript.create({
      data: { canvasId: testCanvas.id, title: 'T', content: 'some coded words here' },
    });
    await prisma.canvasTextCoding.create({
      data: {
        canvasId: testCanvas.id,
        transcriptId: transcript.id,
        questionId: question.id,
        startOffset: 5,
        endOffset: 10,
        codedText: 'coded',
        coderUserId: realId,
      },
    });
  });

  afterAll(async () => {
    const ids = [realId, testId].filter(Boolean);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.aiUsage.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.dashboardAccess.deleteMany({ where: { id: { in: accessIds } } });
    await prisma.$disconnect();
  });

  it('excludes the test account from every sub-aggregate and counts the real one', async () => {
    const after = await getUsage();

    // Computed nodes by type: only the real user's node type appears.
    const types = after.features.computedNodes.map((n) => n.type);
    expect(types).toContain(`${tag}-real`);
    expect(types).not.toContain(`${tag}-test`);
    expect(after.content.computedNodeRuns - baseline.content.computedNodeRuns).toBe(1);

    // AI usage by feature and the cost total: 7 cents, not 1007.
    const feature = after.features.aiUsage.find((a) => a.feature === tag);
    expect(feature).toMatchObject({ count: 1, costCents: 7 });
    expect(after.ai.totalCostCents - baseline.ai.totalCostCents).toBe(7);

    // Action breakdown: 3 real actions, the 40 test actions are gone.
    const action = after.actionBreakdown.find((a) => a.action === tag);
    expect(action).toMatchObject({ count: 3 });

    // Top users: the 40-action test account never appears.
    const topIds = after.topUsers.map((u) => u.userId);
    expect(topIds).not.toContain(testId);
    expect(after.topUsers.find((u) => u.userId === realId)).toMatchObject({ actionCount: 3 });
  });

  it('activates the real user through a coding on another account’s canvas', async () => {
    const after = await getUsage();
    const stage = (body: UsageBody['data']) => body.activation.stages.find((s) => s.key === 'coding')!.users;
    expect(after.activation.activatedUsers - baseline.activation.activatedUsers).toBe(1);
    expect(stage(after) - stage(baseline)).toBe(1);
  });
});

describe.skipIf(Boolean(DB_URL))('GET /admin/usage on Postgres', () => {
  it.skip('QC_INTEGRATION_DATABASE_URL is not set; see the header comment to run these', () => {});
});
