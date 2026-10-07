import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Refuse every target except this owner's disposable database BEFORE imports.
const target = new URL(process.env.DATABASE_URL || '');
assert.equal(target.protocol, 'postgresql:');
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.port, '4759');
assert.equal(target.pathname, '/qc_team_20261007');
assert.equal(target.username, 'qc_team_20261007');
assert.equal(target.search, '');
for (const key of Object.keys(process.env)) {
  if (/SMTP|RESEND|ADMIN_API_KEY|STRIPE|AWS|SENTRY|OPENAI|ANTHROPIC|GOOGLE|LIFECYCLE/.test(key))
    delete process.env[key];
}
process.env.NODE_ENV = 'test';
process.env.LIFECYCLE_EMAIL_AUTOMATION_ENABLED = 'false';
process.env.LIFECYCLE_EMAIL_SENDING_ENABLED = 'false';
process.env.LIFECYCLE_SETUP_SEQUENCE_ENABLED = 'true';
globalThis.fetch = async () => {
  throw new Error('Network delivery forbidden in this local proof');
};

const { prisma } = await import('../../apps/backend/dist/lib/prisma.js');
const { setupProgress } = await import('../../apps/backend/dist/jobs/lifecycleEmailScheduler.js');
const { lifecycleTemplate } = await import('../../apps/backend/dist/lib/lifecycleEmail.js');
const { observeSetupStep, SETUP_STEPS } = await import('../../apps/backend/dist/lib/onboardingObservations.js');
let user;
let access;
const checks = [];
try {
  const identity = await prisma.$queryRaw`SELECT current_database() AS db, current_user AS role`;
  assert.equal(identity[0].db, 'qc_team_20261007');
  assert.equal(identity[0].role, 'qc_team_20261007');
  user = await prisma.user.create({
    data: {
      email: `lifecycle-local-${randomUUID()}@example.com`,
      name: 'Fictional setup researcher',
      passwordHash: 'not-an-authenticatable-password-hash',
      onboardingState: '{}',
    },
  });
  assert.equal(await setupProgress(user.id), 'no_project');
  checks.push('no owned project');
  access = await prisma.dashboardAccess.create({
    data: {
      userId: user.id,
      accessCode: `fixture-${randomUUID()}`,
      name: 'Local fixture',
      role: 'researcher',
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const canvas = await prisma.codingCanvas.create({
    data: {
      userId: user.id,
      dashboardAccessId: access.id,
      name: 'Local fixture project',
    },
  });
  await prisma.canvasTranscript.create({
    data: {
      canvasId: canvas.id,
      title: 'Labelled sample',
      content: 'Fictional sample only.',
      sourceType: 'sample',
    },
  });
  assert.equal(await setupProgress(user.id), 'no_transcript');
  checks.push('sample does not satisfy own transcript');
  await prisma.canvasTranscript.create({
    data: {
      canvasId: canvas.id,
      title: 'Own fictional transcript',
      content: 'Fictional researcher text.',
      sourceType: 'manual',
    },
  });
  const expected = ['no_coding', 'no_theme', 'no_analysis', 'no_export', null];
  for (let index = 0; index < SETUP_STEPS.length; index++) {
    // Exercise real locked server-observation persistence, not mocked Prisma.
    // This is not a claim that the corresponding browser operations ran here.
    await observeSetupStep(user.id, canvas.id, SETUP_STEPS[index]);
    assert.equal(await setupProgress(user.id), expected[index]);
    checks.push(`persisted ${SETUP_STEPS[index]} -> ${expected[index] ?? 'complete'}`);
    if (expected[index]) {
      for (const type of ['setup_nudge_1d', 'training_tip_3d', 'onboarding_7d']) {
        const message = lifecycleTemplate(type, user, expected[index]);
        assert.equal(message.setupSequence, true);
        assert.match(message.bodyHtml, /two business days/);
        assert.match(message.bodyHtml, /support@qualcanvas.com/);
      }
    }
  }
  const before = await prisma.emailDelivery.count({ where: { userId: user.id } });
  assert.equal(before, 0);
  checks.push('zero email deliveries; no sender invoked');
} finally {
  if (user) {
    await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
    if (access) await prisma.dashboardAccess.delete({ where: { id: access.id } });
    await prisma.user.delete({ where: { id: user.id } });
    assert.equal(await prisma.user.count({ where: { id: user.id } }), 0);
    assert.equal(await prisma.codingCanvas.count({ where: { userId: user.id } }), 0);
    checks.push('exact owned fixture cleaned');
  }
  await prisma.$disconnect();
}
console.log(
  JSON.stringify(
    { status: 'PASS', scope: 'real local persistence -> progress -> templates, not browser or email delivery', checks },
    null,
    2,
  ),
);
