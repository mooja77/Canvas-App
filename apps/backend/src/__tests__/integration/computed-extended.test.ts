import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    dashboardAccess: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    codingCanvas: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasTranscript: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    canvasQuestion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    canvasTextCoding: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasComputedNode: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    canvasCase: {
      findMany: vi.fn(),
    },
    canvasNodePosition: {
      upsert: vi.fn(),
    },
    canvasShare: { count: vi.fn() },
    canvasMemo: { count: vi.fn() },
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../middleware/authLimiter.js', () => ({
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../middleware/planLimits.js', () => ({
  checkCanvasLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkTranscriptLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkWordLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCodeLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAutoCode: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkCaseAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkShareLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAnalysisType: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkAnalysisTypeOnRun: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock12nanoid'),
}));

vi.mock('../../lib/stripe.js', () => ({
  getStripe: vi.fn().mockReturnValue({
    subscriptions: { cancel: vi.fn() },
  }),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(),
  },
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { canvasRoutes } from '../../routes/canvasRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, canvasRoutes);
  app.use(errorHandler);
  return app;
}

// ═══════════════════════════════════════════════════════════════
// Extended computed node tests — analysis types and edge cases
// not covered by computed.test.ts
// ═══════════════════════════════════════════════════════════════
describe('Computed node extended tests', () => {
  let app: express.Express;
  const userId = 'user-cext-1';
  const dashboardAccessId = 'da-cext-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'cext@example.com',
    name: 'Computed Extended Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-cext1';
  const mockCanvas = {
    id: canvasId,
    name: 'Extended Computed Canvas',
    description: 'Canvas for extended computed tests',
    dashboardAccessId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  // Reusable test data
  const transcripts = [
    { id: 'tr-1', title: 'Interview A', content: 'The participants felt great satisfaction and wonderful progress.', caseId: 'case-1', eventDate: null },
    { id: 'tr-2', title: 'Interview B', content: 'Some terrible problems and frustrating issues emerged here.', caseId: 'case-2', eventDate: null },
  ];
  const questions = [
    { id: 'q-1', text: 'Positive Theme', color: '#00FF00', parentQuestionId: null },
    { id: 'q-2', text: 'Negative Theme', color: '#FF0000', parentQuestionId: null },
    { id: 'q-3', text: 'Neutral Theme', color: '#888888', parentQuestionId: null },
  ];
  const codings = [
    { id: 'c-1', transcriptId: 'tr-1', questionId: 'q-1', startOffset: 0, endOffset: 30, codedText: 'participants felt great satisfaction' },
    { id: 'c-2', transcriptId: 'tr-1', questionId: 'q-2', startOffset: 10, endOffset: 30, codedText: 'great satisfaction' },
    { id: 'c-3', transcriptId: 'tr-2', questionId: 'q-2', startOffset: 5, endOffset: 40, codedText: 'terrible problems and frustrating issues' },
    { id: 'c-4', transcriptId: 'tr-2', questionId: 'q-1', startOffset: 0, endOffset: 20, codedText: 'Some terrible problems' },
  ];
  const cases = [
    { id: 'case-1', name: 'Case Alpha', attributes: '{"region":"north"}' },
    { id: 'case-2', name: 'Case Beta', attributes: '{"region":"south"}' },
  ];

  function setupCommonMocks() {
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([...transcripts]);
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([...questions]);
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([...codings]);
    mockPrisma.canvasCase.findMany.mockResolvedValue([...cases]);
  }

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
  });

  // ─── 1. cooccurrence returns matrix with 2+ codes ───
  it('cooccurrence run returns co-occurrence pairs when 2+ questions overlap', async () => {
    const nodeId = 'node-cooc-1';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'cooccurrence',
      config: JSON.stringify({ questionIds: ['q-1', 'q-2'] }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'cooccurrence',
      config: JSON.stringify({ questionIds: ['q-1', 'q-2'] }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const result = res.body.data.result;
    expect(result.pairs).toBeDefined();
    expect(Array.isArray(result.pairs)).toBe(true);
  });

  // ─── 2. cooccurrence with fewer than 2 questions returns empty ───
  it('cooccurrence run with <2 questionIds returns empty pairs', async () => {
    const nodeId = 'node-cooc-empty';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'cooccurrence',
      config: JSON.stringify({ questionIds: ['q-1'] }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'cooccurrence',
      config: JSON.stringify({ questionIds: ['q-1'] }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data.result.pairs).toEqual([]);
  });

  // ─── 3. sentiment returns scores ───
  it('sentiment run returns overall scores with positive/negative/neutral', async () => {
    const nodeId = 'node-sent-1';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'sentiment',
      config: JSON.stringify({ scope: 'all' }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'sentiment',
      config: JSON.stringify({ scope: 'all' }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const result = res.body.data.result;
    expect(result.overall).toBeDefined();
    expect(typeof result.overall.positive).toBe('number');
    expect(typeof result.overall.negative).toBe('number');
    expect(typeof result.overall.neutral).toBe('number');
    expect(typeof result.overall.averageScore).toBe('number');
    expect(result.items).toBeDefined();
  });

  // ─── 4. comparison returns per-transcript profiles ───
  it('comparison run returns per-transcript coding profiles', async () => {
    const nodeId = 'node-comp-1';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'comparison',
      config: JSON.stringify({ transcriptIds: ['tr-1', 'tr-2'] }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'comparison',
      config: JSON.stringify({ transcriptIds: ['tr-1', 'tr-2'] }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    const result = res.body.data.result;
    expect(result.transcripts).toBeDefined();
    expect(result.transcripts).toHaveLength(2);
    expect(result.transcripts[0]).toHaveProperty('profile');
    expect(result.transcripts[0].profile[0]).toHaveProperty('count');
  });

  // ─── 5. cluster returns grouped segments ───
  it('cluster run returns clustered segments with keywords', async () => {
    const nodeId = 'node-clust-1';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'cluster',
      config: JSON.stringify({ k: 2 }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'cluster',
      config: JSON.stringify({ k: 2 }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    const result = res.body.data.result;
    expect(result.clusters).toBeDefined();
    expect(Array.isArray(result.clusters)).toBe(true);
    if (result.clusters.length > 0) {
      expect(result.clusters[0]).toHaveProperty('segments');
      expect(result.clusters[0]).toHaveProperty('keywords');
    }
  });

  // ─── 6. codingquery AND operation ───
  it('codingquery run with AND returns segments matching both codes', async () => {
    const nodeId = 'node-cq-and';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'codingquery',
      config: JSON.stringify({
        conditions: [
          { questionId: 'q-1', operator: 'AND' },
          { questionId: 'q-2', operator: 'AND' },
        ],
      }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'codingquery',
      config: JSON.stringify({
        conditions: [
          { questionId: 'q-1', operator: 'AND' },
          { questionId: 'q-2', operator: 'AND' },
        ],
      }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    const result = res.body.data.result;
    expect(result.matches).toBeDefined();
    expect(typeof result.totalMatches).toBe('number');
  });

  // ─── 7. codingquery OR operation ───
  it('codingquery run with OR returns union of segments', async () => {
    const nodeId = 'node-cq-or';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'codingquery',
      config: JSON.stringify({
        conditions: [
          { questionId: 'q-1', operator: 'AND' },
          { questionId: 'q-3', operator: 'OR' },
        ],
      }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'codingquery',
      config: JSON.stringify({
        conditions: [
          { questionId: 'q-1', operator: 'AND' },
          { questionId: 'q-3', operator: 'OR' },
        ],
      }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    const result = res.body.data.result;
    expect(result.matches).toBeDefined();
    expect(Array.isArray(result.matches)).toBe(true);
  });

  // ─── 8. codingquery NOT operation ───
  it('codingquery run with NOT excludes overlapping segments', async () => {
    const nodeId = 'node-cq-not';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'codingquery',
      config: JSON.stringify({
        conditions: [
          { questionId: 'q-1', operator: 'AND' },
          { questionId: 'q-2', operator: 'NOT' },
        ],
      }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'codingquery',
      config: JSON.stringify({
        conditions: [
          { questionId: 'q-1', operator: 'AND' },
          { questionId: 'q-2', operator: 'NOT' },
        ],
      }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    const result = res.body.data.result;
    expect(result.matches).toBeDefined();
    // NOT should exclude segments that overlap with q-2
    // c-1 (q-1 tr-1 0-30) overlaps with c-2 (q-2 tr-1 10-30) → excluded
    // c-4 (q-1 tr-2 0-20) overlaps with c-3 (q-2 tr-2 5-40) → excluded
    expect(result.totalMatches).toBe(0);
  });

  // ─── 9. search with regex pattern ───
  it('search run with regex mode finds pattern matches', async () => {
    const nodeId = 'node-search-regex';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'search',
      config: JSON.stringify({ pattern: 'great|terrible', mode: 'regex' }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'search',
      config: JSON.stringify({ pattern: 'great|terrible', mode: 'regex' }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    const result = res.body.data.result;
    expect(result.matches).toBeDefined();
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    // Should match 'great' in transcript A and 'terrible' in transcript B
    const matchTexts = result.matches.map((m: { matchText: string }) => m.matchText.toLowerCase());
    expect(matchTexts).toEqual(expect.arrayContaining(['great', 'terrible']));
  });

  // ─── 10. search with invalid regex continues without error ───
  it('search run with invalid regex pattern returns empty matches gracefully', async () => {
    const nodeId = 'node-search-bad-regex';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'search',
      config: JSON.stringify({ pattern: '[invalid', mode: 'regex' }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'search',
      config: JSON.stringify({ pattern: '[invalid', mode: 'regex' }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    // Invalid regex is caught and continues — returns empty matches
    expect(res.body.data.result.matches).toEqual([]);
  });

  // ─── 11. matrix framework with cases x codes ───
  it('matrix run returns rows with case/code cross-tabulation', async () => {
    const nodeId = 'node-matrix-1';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'matrix',
      config: JSON.stringify({ questionIds: ['q-1', 'q-2'], caseIds: ['case-1', 'case-2'] }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'matrix',
      config: JSON.stringify({ questionIds: ['q-1', 'q-2'], caseIds: ['case-1', 'case-2'] }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    const result = res.body.data.result;
    expect(result.rows).toBeDefined();
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toHaveProperty('caseId');
    expect(result.rows[0]).toHaveProperty('caseName');
    expect(result.rows[0]).toHaveProperty('cells');
    expect(result.rows[0].cells).toHaveLength(2);
    expect(result.rows[0].cells[0]).toHaveProperty('count');
    expect(result.rows[0].cells[0]).toHaveProperty('excerpts');
  });

  // ─── 12. wordcloud returns word frequencies from coded text ───
  it('wordcloud run returns word frequencies sorted by count', async () => {
    const nodeId = 'node-wc-ext';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'wordcloud',
      config: JSON.stringify({ maxWords: 10 }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'wordcloud',
      config: JSON.stringify({ maxWords: 10 }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    const result = res.body.data.result;
    expect(result.words).toBeDefined();
    expect(Array.isArray(result.words)).toBe(true);
    if (result.words.length > 0) {
      expect(result.words[0]).toHaveProperty('text');
      expect(result.words[0]).toHaveProperty('count');
      // Check sorted descending
      for (let i = 1; i < result.words.length; i++) {
        expect(result.words[i - 1].count).toBeGreaterThanOrEqual(result.words[i].count);
      }
    }
  });

  // ─── 13. stats returns code frequency counts ───
  it('stats run returns code frequency grouped by question', async () => {
    const nodeId = 'node-stats-ext';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'stats',
      config: JSON.stringify({ groupBy: 'question' }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'stats',
      config: JSON.stringify({ groupBy: 'question' }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    const result = res.body.data.result;
    expect(result.items).toBeDefined();
    expect(result.total).toBe(4); // 4 codings total
    const q1Item = result.items.find((i: { id: string }) => i.id === 'q-1');
    expect(q1Item).toBeDefined();
    expect(q1Item.count).toBe(2); // c-1 and c-4
    expect(typeof q1Item.percentage).toBe('number');
    expect(typeof q1Item.coverage).toBe('number');
  });

  // ─── 14. Run on canvas with no data returns empty results ───
  it('stats run on empty canvas returns zero total', async () => {
    const nodeId = 'node-stats-empty';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([]);
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([]);
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([]);
    mockPrisma.canvasCase.findMany.mockResolvedValue([]);
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'stats',
      config: JSON.stringify({ groupBy: 'question' }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'stats',
      config: JSON.stringify({ groupBy: 'question' }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data.result.total).toBe(0);
    expect(res.body.data.result.items).toEqual([]);
  });

  // ─── 15. cluster on empty canvas returns empty clusters ───
  it('cluster run with no codings returns empty clusters array', async () => {
    const nodeId = 'node-clust-empty';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([]);
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([]);
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([]);
    mockPrisma.canvasCase.findMany.mockResolvedValue([]);
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'cluster',
      config: JSON.stringify({ k: 3 }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'cluster',
      config: JSON.stringify({ k: 3 }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data.result.clusters).toEqual([]);
  });

  // ─── 16. Unknown node type returns 400 ───
  it('run with unknown nodeType returns 400', async () => {
    const nodeId = 'node-unknown';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'unknowntype',
      config: '{}',
      result: '{}',
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── 17. User B cannot run computed on user A's canvas ───
  it('user B cannot run analysis on user A canvas', async () => {
    const otherUserId = 'user-other-cext';
    const otherDaId = 'da-other-cext';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'other@example.com',
      name: 'Other User',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/node-any/run`)
      .set('Authorization', `Bearer ${otherJwt}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── 18. PUT updates label and config together ───
  it('PUT updates both label and config in one request', async () => {
    const nodeId = 'node-put-both';
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
    mockPrisma.canvasComputedNode.update.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'cooccurrence',
      label: 'Updated Cooc',
      config: JSON.stringify({ questionIds: ['q-1', 'q-2', 'q-3'], minOverlap: 5 }),
      result: '{}',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/computed/${nodeId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ label: 'Updated Cooc', config: { questionIds: ['q-1', 'q-2', 'q-3'], minOverlap: 5 } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.label).toBe('Updated Cooc');
    expect(res.body.data.config.questionIds).toHaveLength(3);
  });

  // ─── 19. DELETE by non-owner returns 403 ───
  it('user B cannot update computed node on user A canvas', async () => {
    const otherUserId = 'user-other-put';
    const otherDaId = 'da-other-put';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'otherput@example.com',
      name: 'Other Put',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/computed/node-any`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ label: 'Hijacked' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── 20. codingquery with empty conditions returns zero matches ───
  it('codingquery run with empty conditions returns zero matches', async () => {
    const nodeId = 'node-cq-empty';
    setupCommonMocks();
    mockPrisma.canvasComputedNode.findUnique.mockResolvedValue({
      id: nodeId,
      canvasId,
      nodeType: 'codingquery',
      config: JSON.stringify({ conditions: [] }),
      result: '{}',
    });
    mockPrisma.canvasComputedNode.update.mockImplementation(async ({ data }) => ({
      id: nodeId,
      canvasId,
      nodeType: 'codingquery',
      config: JSON.stringify({ conditions: [] }),
      result: data.result,
    }));

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/computed/${nodeId}/run`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data.result.matches).toEqual([]);
    expect(res.body.data.result.totalMatches).toBe(0);
  });
});
