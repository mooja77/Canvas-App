import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    pilotFeedback: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/lifecycleEmail.js', () => ({
  createEmailCampaign: vi.fn(),
  getEmailStats: vi.fn(),
  listEmailCampaigns: vi.fn(),
  sendCampaign: vi.fn(),
}));

import { adminRoutes } from './adminRoutes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRoutes);
  return app;
}

describe('admin pilot feedback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_API_KEY = 'pilot-admin-key';
    const row = {
      id: 'feedback-1',
      participantRole: 'academic-researcher',
      sector: 'Education',
      productExperience: 'first-time',
      taskResults: JSON.stringify([
        { taskId: 'create-project', outcome: 'easy' },
        { taskId: 'export', outcome: 'difficult' },
      ]),
      hardestStep: null,
      missingFeature: null,
      adoptionBlocker: null,
      recommendationScore: 8,
      contactEmail: null,
      consentToContact: false,
      createdAt: new Date('2026-08-27T10:00:00.000Z'),
    };
    mockPrisma.pilotFeedback.findMany
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ taskResults: row.taskResults }]);
    mockPrisma.pilotFeedback.count.mockResolvedValue(1);
    mockPrisma.pilotFeedback.aggregate.mockResolvedValue({ _avg: { recommendationScore: 8 } });
    mockPrisma.pilotFeedback.groupBy.mockResolvedValue([{ participantRole: 'academic-researcher', _count: { id: 1 } }]);
  });

  it('rejects unauthenticated access', async () => {
    const response = await request(makeApp()).get('/admin/pilot/feedback');
    expect(response.status).toBe(403);
  });

  it('returns parsed entries and aggregate task outcomes to an administrator', async () => {
    const response = await request(makeApp()).get('/admin/pilot/feedback').set('x-admin-key', 'pilot-admin-key');

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.averageRecommendationScore).toBe(8);
    expect(response.body.data.entries[0].taskResults).toEqual([
      { taskId: 'create-project', outcome: 'easy' },
      { taskId: 'export', outcome: 'difficult' },
    ]);
    expect(response.body.data.taskOutcomes).toEqual({
      'create-project': { easy: 1 },
      export: { difficult: 1 },
    });
  });
});
