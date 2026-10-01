import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  user: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  auditLog: { findMany: vi.fn(), create: vi.fn() },
  codingCanvas: { findUnique: vi.fn() },
}));
vi.mock('../lib/prisma.js', () => ({ prisma: db }));
vi.mock('../lib/jms-events.js', () => ({ trackJmsEvent: vi.fn() }));
vi.mock('../lib/lifecycleEmail.js', () => ({
  createEmailCampaign: vi.fn(),
  getEmailStats: vi.fn(),
  listEmailCampaigns: vi.fn(),
  sendCampaign: vi.fn(),
}));
import { adminRoutes } from './adminRoutes.js';
import { exportRoutes } from './exportRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (callback) => callback(db));
  db.$queryRaw.mockResolvedValue([]);
  db.user.update.mockResolvedValue({});
  process.env.ADMIN_API_KEY = 'funnel-local-key';
  db.user.findMany.mockResolvedValue([
    { id: 'researcher', email: 'r@ucc.ie', firstValueAt: new Date() },
    { id: 'fixture', email: 'qa@example.com' },
  ]);
  db.user.findUnique.mockResolvedValue({ email: 'qa@example.com' });
  db.auditLog.create.mockResolvedValue({});
  db.auditLog.findMany.mockResolvedValue([
    { actorId: 'researcher', action: 'onboarding.run-analysis' },
    { actorId: 'researcher', action: 'onboarding.run-analysis' },
    { actorId: 'researcher', action: 'onboarding.export-csv' },
  ]);
});

it('exposes all five observed guide steps and counts each real actor once, never client state', async () => {
  const app = express();
  app.use('/admin', adminRoutes);
  const response = await request(app).get('/admin/onboarding').set('x-admin-key', 'funnel-local-key');
  expect(response.status).toBe(200);
  expect(response.body.data.signups).toBe(1);
  expect(response.body.data.ahaReached).toBe(1);
  expect(response.body.data.steps).toEqual([
    { id: 'first-transcript', users: 0 },
    { id: 'first-coded-excerpt', users: 0 },
    { id: 'create-theme', users: 0 },
    { id: 'run-analysis', users: 1 },
    { id: 'export-csv', users: 1 },
  ]);
  expect(db.auditLog.findMany.mock.calls[0][0].where.actorId).toEqual({ in: ['researcher'] });
});

it('generates actual CSV bytes from authorized stored data and records the requesting actor, not canvas owner', async () => {
  db.codingCanvas.findUnique.mockResolvedValue({
    id: 'canvas1',
    dashboardAccessId: 'access',
    userId: 'owner',
    name: 'Study',
    questions: [{ id: 'q1', text: '=1+1', color: '#fff', parentQuestionId: null }],
    transcripts: [{ id: 't1', title: 'Interview', sourceType: null, caseId: null }],
    codings: [
      {
        id: 'c1',
        transcriptId: 't1',
        questionId: 'q1',
        source: null,
        codedText: 'Real, excerpt',
        startOffset: 0,
        endOffset: 13,
        createdAt: new Date('2026-09-30'),
      },
    ],
    cases: [],
  });
  const app = express();
  app.use((req, _res, next) => {
    req.dashboardAccessId = 'access';
    req.userId = 'actor';
    next();
  });
  app.use(exportRoutes);
  app.use(errorHandler);
  const response = await request(app).get('/canvas/canvas1/export/coded-data.csv');
  expect(response.status).toBe(200);
  expect(response.text).toContain('"Real, excerpt"');
  expect(response.text).toContain("'=1+1");
  expect(db.auditLog.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ actorId: 'actor', action: 'onboarding.export-csv' }) }),
  );
});

it('rejects an unauthorized CSV request before generating bytes or observing progress', async () => {
  db.codingCanvas.findUnique.mockResolvedValue({ id: 'canvas1', dashboardAccessId: 'owner' });
  const app = express();
  app.use((req, _res, next) => {
    req.dashboardAccessId = 'intruder';
    next();
  });
  app.use(exportRoutes);
  app.use(errorHandler);
  const response = await request(app).get('/canvas/canvas1/export/coded-data.csv');
  expect(response.status).toBe(403);
  expect(db.auditLog.create).not.toHaveBeenCalled();
});
