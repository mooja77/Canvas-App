import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';

// The collaborator key rule (utils/aiKeys.ts): the requester's own OpenAI key
// first; otherwise the canvas owner's key only if the owner shares it; never
// a server key. Uses the real AES-256-GCM encryption with a per-run key.

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    userAiConfig: { findUnique: vi.fn() },
    codingCanvas: { findUnique: vi.fn() },
  },
}));
vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));

process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
import { encryptApiKey } from './encryption.js';
import { resolveTranscriptionKey } from './aiKeys.js';

const OWNER = 'u-owner';
const CODER = 'u-coder';
const keyFor = (who: string) => `sk-test-${who}-${randomBytes(6).toString('hex')}`;

type Cfg = { provider: string; key: string; share?: boolean } | null;
function configs(map: Record<string, Cfg>) {
  mockPrisma.userAiConfig.findUnique.mockImplementation(async ({ where }: { where: { userId: string } }) => {
    const c = map[where.userId];
    if (!c) return null;
    const { encrypted, iv, tag } = encryptApiKey(c.key);
    return {
      userId: where.userId,
      provider: c.provider,
      apiKeyEncrypted: encrypted,
      apiKeyIv: iv,
      apiKeyTag: tag,
      shareWithCollaborators: Boolean(c.share),
    };
  });
}

describe('resolveTranscriptionKey — whose own key pays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ userId: OWNER, dashboardAccess: null });
  });

  it('owner with a key: their own key', async () => {
    const k = keyFor('owner');
    configs({ [OWNER]: { provider: 'openai', key: k } });
    const r = await resolveTranscriptionKey('c1', OWNER);
    expect(r).toMatchObject({ apiKey: k, keyOwnerId: OWNER, source: 'own', isCanvasOwner: true });
  });

  it('owner with no key: nobody pays', async () => {
    configs({});
    const r = await resolveTranscriptionKey('c1', OWNER);
    expect(r).toMatchObject({ apiKey: null, keyOwnerId: null, source: null, isCanvasOwner: true });
  });

  it('collaborator with their own key uses it, even when the owner shares theirs', async () => {
    const mine = keyFor('coder');
    configs({
      [CODER]: { provider: 'openai', key: mine },
      [OWNER]: { provider: 'openai', key: keyFor('owner'), share: true },
    });
    const r = await resolveTranscriptionKey('c1', CODER);
    expect(r).toMatchObject({
      apiKey: mine,
      keyOwnerId: CODER,
      source: 'own',
      isCanvasOwner: false,
      ownerSharesKey: true,
    });
  });

  it("collaborator with no key uses the owner's key only when the owner allows it", async () => {
    const owners = keyFor('owner');
    configs({ [OWNER]: { provider: 'openai', key: owners, share: true } });
    const r = await resolveTranscriptionKey('c1', CODER);
    expect(r).toMatchObject({ apiKey: owners, keyOwnerId: OWNER, source: 'canvas-owner', canvasOwnerId: OWNER });
  });

  it('collaborator with no key is refused when the owner has not shared (the default)', async () => {
    configs({ [OWNER]: { provider: 'openai', key: keyFor('owner') } });
    const r = await resolveTranscriptionKey('c1', CODER);
    expect(r).toMatchObject({ apiKey: null, source: null, ownerHasOpenAiKey: true, ownerSharesKey: false });
  });

  it('a non-OpenAI key cannot pay for Whisper, for the requester or the owner', async () => {
    configs({
      [CODER]: { provider: 'anthropic', key: keyFor('coder') },
      [OWNER]: { provider: 'google', key: keyFor('owner'), share: true },
    });
    const r = await resolveTranscriptionKey('c1', CODER);
    expect(r.apiKey).toBeNull();
    expect(r.ownerHasOpenAiKey).toBe(false);
  });

  it('never falls back to a server key', async () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = keyFor('server');
    try {
      configs({});
      expect((await resolveTranscriptionKey('c1', CODER)).apiKey).toBeNull();
      expect((await resolveTranscriptionKey('c1', OWNER)).apiKey).toBeNull();
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });
});
