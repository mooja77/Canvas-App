/**
 * Real-Postgres regression tests for bug hunt 2026-09-02 findings that a
 * mocked Prisma cannot demonstrate: M4 (concurrent re-parent cycle), the
 * 409 cycle-repair message, L1 (empty parent id at the route), L2 (skip
 * overflow) and L3 (realUsersWhere anchoring).
 *
 * Skipped unless QC_INTEGRATION_DATABASE_URL points at a migrated database:
 *
 *   docker exec qc-e2e-pg psql -U qualcanvas -d postgres -c "create database qualcanvas_bughunt"
 *   DATABASE_URL=postgresql://qualcanvas:qualcanvas@localhost:55432/qualcanvas_bughunt?schema=public \
 *     npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma
 *   QC_INTEGRATION_DATABASE_URL=postgresql://qualcanvas:qualcanvas@localhost:55432/qualcanvas_bughunt?schema=public \
 *     npx vitest run src/__tests__/integration/postgres-races.test.ts
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const DB_URL = vi.hoisted(() => {
  const url = process.env.QC_INTEGRATION_DATABASE_URL;
  if (url) process.env.DATABASE_URL = url;
  return url;
});

// Outbound side effects that have nothing to do with the database.
vi.mock('../../lib/jms-events.js', () => ({ trackJmsEvent: vi.fn().mockResolvedValue(undefined) }));
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
import { auth } from '../../middleware/auth.js';
import { canvasRoutes } from '../../routes/canvasRoutes.js';
import { getRealUserIds } from '../../utils/testAccounts.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, canvasRoutes);
  app.use(errorHandler);
  return app;
}

describe.skipIf(!DB_URL)('real Postgres regressions (bug hunt 2026-09-02)', () => {
  const app = createApp();
  const runId = randomUUID().slice(0, 8);
  let userId = '';
  let dashboardAccessId = '';
  let canvasId = '';
  let jwt = '';

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `race-${runId}@qualcanvas.test`,
        passwordHash: 'not-a-real-hash',
        name: 'Race Tester',
        plan: 'pro',
        emailVerified: true,
        dashboardAccess: {
          create: {
            accessCode: `RACE-${runId}`,
            name: 'Race Tester',
            role: 'researcher',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
      include: { dashboardAccess: true },
    });
    userId = user.id;
    dashboardAccessId = user.dashboardAccess!.id;
    jwt = signUserToken(userId, 'researcher', 'pro');
    const canvas = await prisma.codingCanvas.create({
      data: { name: `Race canvas ${runId}`, dashboardAccessId, userId },
    });
    canvasId = canvas.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (dashboardAccessId) {
      await prisma.dashboardAccess.delete({ where: { id: dashboardAccessId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  const put = (qid: string, body: object | string) =>
    request(app).put(`/api/canvas/${canvasId}/questions/${qid}`).set('Authorization', `Bearer ${jwt}`).send(body);
  const post = (body: object) =>
    request(app).post(`/api/canvas/${canvasId}/questions`).set('Authorization', `Bearer ${jwt}`).send(body);

  async function createQuestion(text: string) {
    return prisma.canvasQuestion.create({ data: { canvasId, text } });
  }

  describe('M4: concurrent re-parents cannot commit a cycle', () => {
    let a = '';
    let b = '';

    beforeAll(async () => {
      a = (await createQuestion('A')).id;
      b = (await createQuestion('B')).id;
    });

    it('never answers 200 to both PUT A{parent:B} and PUT B{parent:A}, across 10 concurrent rounds', async () => {
      for (let round = 0; round < 10; round++) {
        await prisma.canvasQuestion.updateMany({ where: { id: { in: [a, b] } }, data: { parentQuestionId: null } });

        const [r1, r2] = await Promise.all([put(a, { parentQuestionId: b }), put(b, { parentQuestionId: a })]);
        const statuses = [r1.status, r2.status].sort();

        expect(statuses, `round ${round}: ${JSON.stringify([r1.body, r2.body])}`).toEqual([200, 400]);

        const rows = await prisma.canvasQuestion.findMany({
          where: { id: { in: [a, b] } },
          select: { id: true, parentQuestionId: true },
        });
        const parentOf = Object.fromEntries(rows.map((r) => [r.id, r.parentQuestionId]));
        const bothPoint = parentOf[a] === b && parentOf[b] === a;
        expect(bothPoint, `round ${round}: cycle persisted ${JSON.stringify(parentOf)}`).toBe(false);
        // Exactly one edge was written.
        expect([parentOf[a], parentOf[b]].filter(Boolean)).toHaveLength(1);
      }
    });

    it('still lets a later, non-conflicting hierarchy edit through', async () => {
      const c = (await createQuestion('C')).id;
      const res = await put(c, { parentQuestionId: a });
      expect(res.status).toBe(200);
      expect(res.body.data.parentQuestionId).toBe(a);
    });
  });

  describe('M4 repair path: an existing cycle is reported with its member ids', () => {
    it('answers 409 naming every code in the loop', async () => {
      const c = (await createQuestion('Cycle C')).id;
      const d = (await createQuestion('Cycle D')).id;
      const e = (await createQuestion('Outside E')).id;
      // Corrupt the data directly, the way the pre-fix race did.
      await prisma.canvasQuestion.update({ where: { id: c }, data: { parentQuestionId: d } });
      await prisma.canvasQuestion.update({ where: { id: d }, data: { parentQuestionId: c } });

      const res = await put(e, { parentQuestionId: c });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(c);
      expect(res.body.error).toContain(d);
      expect(res.body.error).not.toContain(e);
      expect(res.body.error).toMatch(/parent .* null/);

      // The named repair works and unblocks the canvas.
      expect((await put(d, { parentQuestionId: null })).status).toBe(200);
      expect((await put(e, { parentQuestionId: c })).status).toBe(200);
    });
  });

  describe('L1: parentQuestionId "" is "no parent", never a 500', () => {
    it('POST with "" creates a top-level code', async () => {
      const res = await post({ text: 'Empty parent on create', parentQuestionId: '' });
      expect(res.status).toBe(201);
      expect(res.body.data.parentQuestionId).toBeNull();
    });

    it('PUT with "" clears the parent', async () => {
      const parent = (await createQuestion('P')).id;
      const child = (await createQuestion('K')).id;
      expect((await put(child, { parentQuestionId: parent })).status).toBe(200);

      const res = await put(child, { parentQuestionId: '' });
      expect(res.status).toBe(200);
      expect(res.body.data.parentQuestionId).toBeNull();
    });

    it('a parent id in another canvas is a 404, an unshaped id a 400', async () => {
      const other = await prisma.codingCanvas.create({
        data: { name: `Other ${runId}`, dashboardAccessId, userId },
      });
      const foreign = await prisma.canvasQuestion.create({ data: { canvasId: other.id, text: 'Foreign' } });
      const child = (await createQuestion('K2')).id;
      expect((await put(child, { parentQuestionId: foreign.id })).status).toBe(404);
      expect((await put(child, { parentQuestionId: 'not an id' })).status).toBe(400);
    });
  });

  describe('L2: detail paging query', () => {
    const get = (query: string) =>
      request(app).get(`/api/canvas/${canvasId}${query}`).set('Authorization', `Bearer ${jwt}`);

    it('rejects an overflowing detailPage with 400 instead of a Prisma 500', async () => {
      const res = await get('?detailPage=99999999999999999999');
      expect(res.status).toBe(400);
    });

    it('serves an in-range page', async () => {
      const res = await get('?detailPage=1&detailPageSize=50');
      expect(res.status).toBe(200);
      expect(res.body.detailPagination).toMatchObject({ page: 1, pageSize: 50 });
    });
  });

  describe('the real-user filter counts researchers and excludes fixtures', () => {
    const real = [
      'researcher@qu.edu.qa',
      'maria.testa@unibo.it',
      'j.seedorf@uva.nl',
      'contest.winner@ucc.ie',
      'p.demoulin@ulb.be',
    ];
    const fixtures = [
      'testuser-1@example.com',
      'qa-bot@x.com',
      'john+test@gmail.com',
      'demo.account@ucc.ie',
      'seed-user@uva.nl',
      'e2e-runner@unibo.it',
      'smoke.check@qu.edu.qa',
      'someone@example.org',
      'someone@test.local',
      'someone@qualcanvas.test',
      'anna+e2e@gmail.com',
      'anna+qa@gmail.com',
      'Test.Upper@ucc.ie',
      // Fixtures the earlier anchored-prefix rules let through, which is how
      // four of them reached the activation cohort while the user list beside
      // it excluded them.
      'jamie.ux.test@startup.io',
      'dr.chen.test@university.edu',
      'marcus.student.test@gmail.com',
      'mary.oshaughnessy@wiseshift.demo',
    ];
    const all = [...real, ...fixtures];
    const createdIds: string[] = [];

    beforeAll(async () => {
      await prisma.user.deleteMany({ where: { email: { in: all } } });
      for (const email of all) {
        const row = await prisma.user.create({
          data: { email, passwordHash: 'not-a-real-hash', name: email.split('@')[0] },
          select: { id: true },
        });
        createdIds.push(row.id);
      }
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    });

    it('resolves to exactly the real researchers against Postgres', async () => {
      const realIds = new Set(await getRealUserIds(prisma));
      const rows = await prisma.user.findMany({
        where: { email: { in: all } },
        select: { id: true, email: true },
      });
      const counted = rows.filter((u) => realIds.has(u.id)).map((u) => u.email);
      expect(counted.sort()).toEqual([...real].sort());
    });
  });
});

describe.skipIf(Boolean(DB_URL))('real Postgres regressions (bug hunt 2026-09-02)', () => {
  it.skip('QC_INTEGRATION_DATABASE_URL is not set; see the header comment to run these', () => {});
});
