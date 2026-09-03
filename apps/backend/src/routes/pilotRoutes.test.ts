import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock('../lib/prisma.js', () => ({ prisma: { pilotFeedback: { create: mockCreate } } }));

import { publicPilotRoutes } from './pilotRoutes.js';

const validPayload = {
  participantRole: 'postgraduate-researcher',
  sector: 'Health research',
  productExperience: 'first-time',
  taskResults: [
    { taskId: 'create-project', outcome: 'easy' },
    { taskId: 'add-transcript', outcome: 'easy' },
    { taskId: 'code-passages', outcome: 'difficult' },
    { taskId: 'memo-analysis', outcome: 'not-completed' },
    { taskId: 'export', outcome: 'not-attempted' },
  ],
  hardestStep: 'Finding the analysis menu',
  missingFeature: '',
  adoptionBlocker: '',
  recommendationScore: 7,
  contactEmail: '',
  consentToContact: false,
  website: '',
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/pilot', publicPilotRoutes);
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error.message });
  });
  return app;
}

describe('public pilot feedback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'feedback-1' });
  });

  it('stores a validated anonymous response without account or network identifiers', async () => {
    const response = await request(makeApp()).post('/pilot/feedback').send(validPayload);

    expect(response.status).toBe(201);
    expect(response.body.message).toMatch(/feedback has been recorded/i);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        participantRole: 'postgraduate-researcher',
        sector: 'Health research',
        recommendationScore: 7,
        contactEmail: null,
        consentToContact: false,
      }),
    });
    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty('ip');
    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty('userAgent');
  });

  it('requires one result for each distinct pilot task', async () => {
    const duplicateTaskPayload = {
      ...validPayload,
      taskResults: validPayload.taskResults.map((result) => ({ ...result })),
    };
    duplicateTaskPayload.taskResults[4].taskId = 'create-project';

    const response = await request(makeApp()).post('/pilot/feedback').send(duplicateTaskPayload);

    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does not store an email without explicit follow-up consent', async () => {
    const response = await request(makeApp())
      .post('/pilot/feedback')
      .send({ ...validPayload, contactEmail: 'participant@example.org', consentToContact: false });

    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('accepts a honeypot submission without polluting the dataset', async () => {
    const response = await request(makeApp())
      .post('/pilot/feedback')
      .send({ ...validPayload, website: 'https://spam.invalid' });

    expect(response.status).toBe(201);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('answers a honeypot submission exactly like a real one, so a bot cannot detect the trap', async () => {
    // Bug hunt 2026-09-02: the honeypot returned 202 against the real path's
    // 201 - a one-byte fingerprint of which field had tripped it.
    const real = await request(makeApp()).post('/pilot/feedback').send(validPayload);
    const trapped = await request(makeApp())
      .post('/pilot/feedback')
      .send({ ...validPayload, website: 'https://spam.invalid' });

    expect(trapped.status).toBe(real.status);
    expect(trapped.body).toEqual(real.body);
    expect(trapped.headers['content-type']).toBe(real.headers['content-type']);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
