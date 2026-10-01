import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  auditLog: { create: vi.fn(), findMany: vi.fn() },
  canvasTranscript: { count: vi.fn() },
  canvasTextCoding: { findMany: vi.fn() },
}));
const send = vi.hoisted(() => vi.fn());
vi.mock('./prisma.js', () => ({ prisma: db }));
vi.mock('./jms-events.js', () => ({ trackJmsEvent: send }));
import {
  observeSetupStep,
  observeCodingProgress,
  observeAnalysisRun,
  observedSetupSteps,
} from './onboardingObservations.js';
beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue({ email: 'qa@example.com', onboardingState: '{}' });
  db.$transaction.mockImplementation(async (callback) => callback(db));
  db.$queryRaw.mockResolvedValue([]);
  db.user.update.mockResolvedValue({});
  db.auditLog.create.mockResolvedValue({});
  db.canvasTextCoding.findMany.mockResolvedValue([]);
  db.canvasTranscript.count.mockResolvedValue(0);
});
it('does not observe sample-only analysis, records actual actor once own data exists', async () => {
  await observeAnalysisRun('actor', 'canvas');
  expect(db.auditLog.create).not.toHaveBeenCalled();
  db.canvasTranscript.count.mockResolvedValue(1);
  await observeAnalysisRun('actor', 'canvas');
  expect(db.auditLog.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ actorId: 'actor', action: 'onboarding.run-analysis' }),
  });
  expect(db.canvasTranscript.count.mock.calls[0][0].where).toMatchObject({
    deletedAt: null,
    OR: [{ sourceType: null }, { sourceType: { not: 'sample' } }],
  });
});
it('requires two distinct actor-attributed own codes for the two-code step', async () => {
  db.canvasTextCoding.findMany.mockResolvedValue([{ questionId: 'q1' }]);
  await observeCodingProgress('actor', 'canvas');
  expect(db.auditLog.create.mock.calls.map(([arg]) => arg.data.action)).toEqual(['onboarding.first-coded-excerpt']);
  db.canvasTextCoding.findMany.mockResolvedValue([{ questionId: 'q1' }, { questionId: 'q2' }]);
  await observeCodingProgress('actor', 'canvas');
  expect(db.auditLog.create.mock.calls.map(([arg]) => arg.data.action)).toContain('onboarding.create-theme');
  expect(db.canvasTextCoding.findMany.mock.calls[0][0]).toMatchObject({
    where: { coderUserId: 'actor', source: { not: 'sample' } },
    distinct: ['questionId'],
  });
});
it('never forwards test-account observations but forwards real progress without research content', async () => {
  await observeSetupStep('actor', 'canvas', 'export-csv');
  expect(send).not.toHaveBeenCalled();
  db.user.findUnique.mockResolvedValue({ email: 'r@ucc.ie' });
  await observeSetupStep('actor', 'canvas', 'export-csv');
  expect(send).toHaveBeenCalledWith({
    name: 'setup_step_completed',
    email: 'r@ucc.ie',
    properties: { user_id: 'actor', canvas_id: 'canvas', step: 'export-csv' },
  });
});
it('reads only durable reserved server milestones, not legacy checklist or expired audit rows', async () => {
  db.user.findUnique.mockResolvedValue({
    onboardingState: JSON.stringify({ checklistComplete: ['run-analysis'], serverSteps: ['export-csv', 'forged'] }),
  });
  expect(await observedSetupSteps('actor')).toEqual(['export-csv']);
  expect(db.auditLog.findMany).not.toHaveBeenCalled();
});
it('observation storage failures never discard already saved research', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  db.auditLog.create.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(observeSetupStep('actor', 'canvas', 'first-transcript')).resolves.toBeUndefined();
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
