import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// The wizard's promises, checked against the real route + real AES-256-GCM:
// the key is validated before it is stored, stored only encrypted, never
// returned, used only for this account, and removable.

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    userAiConfig: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    aiUsage: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { durationSeconds: 0 } }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));

process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
import request from 'supertest';
import express from 'express';
import { aiSettingsRoutes } from '../../routes/aiSettingsRoutes.js';
import { decryptApiKey } from '../../utils/encryption.js';

function app(userId: string | null = 'u1') {
  const a = express();
  a.use(express.json());
  a.use((req: Request, _res: Response, next: NextFunction) => {
    req.userId = userId ?? undefined;
    next();
  });
  a.use('/api', aiSettingsRoutes);
  return a;
}

const newKey = () => `sk-test-${randomBytes(12).toString('hex')}`;

describe('AI key storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.userAiConfig.upsert.mockResolvedValue({ shareWithCollaborators: false });
    // Hermetic: any provider call not stubbed by a test fails loudly.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('unexpected network call');
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stores only AES-256-GCM ciphertext that decrypts back to the key', async () => {
    const k = newKey();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"data":[]}', { status: 200 })),
    );
    const res = await request(app()).put('/api/ai-settings').send({ provider: 'openai', apiKey: k });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(k);
    const { create, update, where } = mockPrisma.userAiConfig.upsert.mock.calls[0][0];
    expect(where).toEqual({ userId: 'u1' });
    expect(create.userId).toBe('u1');
    for (const row of [create, update]) {
      expect(JSON.stringify(row)).not.toContain(k);
      expect(row.apiKeyEncrypted).not.toBe(k);
      expect(Buffer.from(row.apiKeyIv, 'base64')).toHaveLength(12);
      expect(Buffer.from(row.apiKeyTag, 'base64')).toHaveLength(16);
      expect(decryptApiKey(row.apiKeyEncrypted, row.apiKeyIv, row.apiKeyTag)).toBe(k);
    }
  });

  it('a key the provider rejects is not saved, and the reply says what to do', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );
    const res = await request(app()).put('/api/ai-settings').send({ provider: 'openai', apiKey: newKey() });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AI_KEY_INVALID_KEY');
    expect(res.body.error).toMatch(/copied the whole key/);
    expect(mockPrisma.userAiConfig.upsert).not.toHaveBeenCalled();
  });

  it('GET never returns the key, only whether one is connected', async () => {
    const k = newKey();
    mockPrisma.userAiConfig.findUnique.mockResolvedValue({
      provider: 'openai',
      model: null,
      embeddingModel: null,
      shareWithCollaborators: false,
      updatedAt: new Date(),
    });
    const res = await request(app()).get('/api/ai-settings');
    expect(res.body.data).toMatchObject({ hasApiKey: true, provider: 'openai', shareWithCollaborators: false });
    expect(JSON.stringify(res.body)).not.toContain(k);
    expect(mockPrisma.userAiConfig.findUnique.mock.calls[0][0].select).not.toHaveProperty('apiKeyEncrypted');
  });

  it('the owner can allow and block collaborators using the key; it needs a connected key', async () => {
    mockPrisma.userAiConfig.updateMany.mockResolvedValueOnce({ count: 1 });
    const on = await request(app()).put('/api/ai-settings/sharing').send({ shareWithCollaborators: true });
    expect(on.body.data.shareWithCollaborators).toBe(true);
    expect(mockPrisma.userAiConfig.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { shareWithCollaborators: true },
    });
    mockPrisma.userAiConfig.updateMany.mockResolvedValueOnce({ count: 0 });
    const none = await request(app()).put('/api/ai-settings/sharing').send({ shareWithCollaborators: true });
    expect(none.status).toBe(409);
  });

  it('removing the key deletes only this account’s row', async () => {
    mockPrisma.userAiConfig.deleteMany.mockResolvedValue({ count: 1 });
    await request(app()).delete('/api/ai-settings');
    expect(mockPrisma.userAiConfig.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('legacy sessions without an email account cannot store a key', async () => {
    const res = await request(app(null)).put('/api/ai-settings').send({ provider: 'openai', apiKey: newKey() });
    expect(res.status).toBe(401);
  });
});
