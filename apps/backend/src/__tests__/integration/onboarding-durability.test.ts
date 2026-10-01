import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { observeSetupStep, observedSetupSteps, SETUP_STEPS } from '../../lib/onboardingObservations.js';
import { templateRoutes } from '../../routes/templateRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';

if (process.env.QC_DURABILITY_DATABASE_URL) {
  const local = new URL(process.env.QC_DURABILITY_DATABASE_URL);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(local.hostname) ||
    !/^\/(qualcanvas_fullstack|qc_onboard)/.test(local.pathname) ||
    process.env.DATABASE_URL !== process.env.QC_DURABILITY_DATABASE_URL
  ) {
    throw new Error('Durability tests require matching isolated loopback database URLs');
  }
}

describe.skipIf(!process.env.QC_DURABILITY_DATABASE_URL)('Trusted guide progress on local PostgreSQL', () => {
  let userId = '';
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = userId;
    next();
  });
  app.use('/api', templateRoutes);
  app.use(errorHandler);
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `onboarding-durability-${randomUUID()}@example.com`,
        name: 'Fictional local researcher',
        passwordHash: 'not-a-login-password',
      },
    });
    userId = user.id;
  });
  afterAll(async () => {
    if (userId) {
      await prisma.auditLog.deleteMany({ where: { actorId: userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });
  it('preserves all milestones against parallel preference patches and audit retention/deletion', async () => {
    await Promise.all([
      ...SETUP_STEPS.map((step) => observeSetupStep(userId, 'fictional-canvas', step)),
      ...[1, 2, 3, 4, 5].map((currentStep) =>
        request(app)
          .patch('/api/user/onboarding')
          .send({ state: { currentStep, checklistDismissed: true } })
          .expect(200),
      ),
    ]);
    expect(await observedSetupSteps(userId)).toEqual([...SETUP_STEPS]);
    expect(await prisma.auditLog.count({ where: { actorId: userId, action: { startsWith: 'onboarding.' } } })).toBe(5);
    // Simulate pruning only this test actor's events. Nothing else is deleted.
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    const response = await request(app).get('/api/user/onboarding').expect(200);
    expect(response.body.data.observedSteps).toEqual([...SETUP_STEPS]);
    expect(response.body.data.state.checklistComplete).toContain('export-csv');
    expect(response.body.data.state.checklistDismissed).toBe(true);
  });
  it('rejects reserved fields and forged ticks without deleting trusted progress', async () => {
    for (const state of [
      { serverSteps: [] },
      { serverSteps: ['export-csv'] },
      { checklistComplete: ['export-csv'] },
      { observedSteps: ['run-analysis'] },
    ]) {
      await request(app).patch('/api/user/onboarding').send({ state }).expect(400);
    }
    expect(await observedSetupSteps(userId)).toEqual([...SETUP_STEPS]);
  });
});
