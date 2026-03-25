import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    dashboardAccess: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    codingCanvas: {
      findUnique: vi.fn(),
    },
    canvasTranscript: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    canvasQuestion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    canvasTextCoding: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    canvasMemo: {
      findMany: vi.fn(),
    },
    aiSuggestion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    aiUsage: {
      create: vi.fn(),
    },
    userAiConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    chatMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    textEmbedding: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    summary: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
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
  checkAiAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  checkEthicsAccess: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('ABCD1234'),
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

// Mock the AI config middleware to attach a mock llmProvider
const mockLlmProvider = {
  name: 'openai',
  complete: vi.fn(),
  embedBatch: vi.fn(),
};

vi.mock('../../middleware/aiConfig.js', () => ({
  resolveAiConfig: () => (req: Request, _res: Response, next: NextFunction) => {
    req.llmProvider = mockLlmProvider as unknown as Request['llmProvider'];
    next();
  },
}));

vi.mock('../../utils/aiPrompts.js', () => ({
  buildSuggestCodesPrompt: vi.fn().mockReturnValue([
    { role: 'system', content: 'You are a coding assistant.' },
    { role: 'user', content: 'Suggest codes.' },
  ]),
  buildAutoCodeTranscriptPrompt: vi.fn().mockReturnValue([
    { role: 'system', content: 'You are a coding assistant.' },
    { role: 'user', content: 'Auto-code this transcript.' },
  ]),
}));

vi.mock('../../utils/embeddings.js', () => ({
  chunkText: vi.fn().mockImplementation((text: string) => [
    { index: 0, text: text.slice(0, 200) },
  ]),
}));

vi.mock('../../utils/rag.js', () => ({
  ragQuery: vi.fn().mockResolvedValue({
    answer: 'Based on the transcript, the key theme is resilience.',
    citations: [{ sourceType: 'transcript', sourceId: 'tr-1', text: 'resilience' }],
    model: 'gpt-4',
    inputTokens: 100,
    outputTokens: 50,
  }),
}));

vi.mock('../../utils/encryption.js', () => ({
  encryptApiKey: vi.fn().mockReturnValue({ encrypted: 'enc', iv: 'iv', tag: 'tag' }),
  decryptApiKey: vi.fn().mockReturnValue('sk-test-key'),
}));

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { aiRoutes } from '../../routes/aiRoutes.js';
import { chatRoutes } from '../../routes/chatRoutes.js';
import { summaryRoutes } from '../../routes/summaryRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, aiRoutes);
  app.use('/api', auth, chatRoutes);
  app.use('/api', auth, summaryRoutes);
  app.use(errorHandler);
  return app;
}

describe('AI features integration tests', () => {
  let app: express.Express;
  const userId = 'user-ai-1';
  const dashboardAccessId = 'da-ai-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'ai-tester@example.com',
    name: 'AI Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-ai-1';
  const mockCanvas = {
    id: canvasId,
    name: 'AI Test Canvas',
    description: 'Canvas for AI tests',
    dashboardAccessId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const transcriptId = 'tr-ai-1';
  const mockTranscript = {
    id: transcriptId,
    canvasId,
    title: 'Interview A',
    content: 'The participant described resilience in the face of adversity and mentioned coping strategies.',
    sortOrder: 0,
  };

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
  });

  // ─── 1. POST /canvas/:id/ai/suggest-codes — returns code suggestions with confidence scores ───
  it('POST /canvas/:id/ai/suggest-codes returns code suggestions with confidence scores', async () => {
    mockPrisma.canvasTranscript.findFirst.mockResolvedValue({ ...mockTranscript });
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([
      { id: 'q-1', text: 'Resilience', color: '#FF0000' },
    ]);

    mockLlmProvider.complete.mockResolvedValue({
      content: JSON.stringify({
        suggestions: [
          { questionId: 'q-1', suggestedText: 'Resilience', confidence: 0.92, reasoning: 'Direct mention of resilience' },
          { questionId: null, suggestedText: 'Coping', confidence: 0.78, reasoning: 'Coping strategies discussed' },
        ],
      }),
      model: 'gpt-4',
      inputTokens: 200,
      outputTokens: 100,
    });

    mockPrisma.aiUsage.create.mockResolvedValue({});
    mockPrisma.aiSuggestion.create
      .mockResolvedValueOnce({ id: 'sug-1', suggestedText: 'Resilience', confidence: 0.92, status: 'pending' })
      .mockResolvedValueOnce({ id: 'sug-2', suggestedText: 'Coping', confidence: 0.78, status: 'pending' });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/suggest-codes`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        transcriptId,
        codedText: 'resilience in the face of adversity',
        startOffset: 30,
        endOffset: 65,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].confidence).toBe(0.92);
  });

  // ─── 2. POST /canvas/:id/ai/suggest-codes — LLM provider failure returns 500 ───
  it('POST /canvas/:id/ai/suggest-codes with LLM failure returns 500', async () => {
    mockPrisma.canvasTranscript.findFirst.mockResolvedValue({ ...mockTranscript });
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([]);

    mockLlmProvider.complete.mockResolvedValue({
      content: 'NOT JSON',
      model: 'gpt-4',
      inputTokens: 100,
      outputTokens: 10,
    });
    mockPrisma.aiUsage.create.mockResolvedValue({});

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/suggest-codes`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        transcriptId,
        codedText: 'some text',
        startOffset: 0,
        endOffset: 9,
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Failed to parse AI response/);
  });

  // ─── 3. POST /canvas/:id/ai/suggest-codes — non-owner returns 403 ───
  it('POST /canvas/:id/ai/suggest-codes on another user canvas returns 403', async () => {
    const otherUserId = 'user-other-ai';
    const otherDaId = 'da-other-ai';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'other@example.com',
      name: 'Other User',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/suggest-codes`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({
        transcriptId,
        codedText: 'test',
        startOffset: 0,
        endOffset: 4,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ─── 4. POST /canvas/:id/ai/auto-code-transcript — applies AI-based codes ───
  it('POST /canvas/:id/ai/auto-code-transcript applies AI-based codes', async () => {
    mockPrisma.canvasTranscript.findFirst.mockResolvedValue({ ...mockTranscript });
    mockPrisma.canvasQuestion.findMany.mockResolvedValue([
      { id: 'q-1', text: 'Resilience' },
    ]);

    mockLlmProvider.complete.mockResolvedValue({
      content: JSON.stringify({
        codings: [
          {
            questionId: 'q-1',
            suggestedText: 'Resilience',
            startOffset: 30,
            endOffset: 65,
            codedText: 'resilience in the face of adversity',
            confidence: 0.88,
          },
        ],
      }),
      model: 'gpt-4',
      inputTokens: 500,
      outputTokens: 200,
    });

    mockPrisma.aiUsage.create.mockResolvedValue({});
    mockPrisma.aiSuggestion.create.mockResolvedValue({
      id: 'sug-auto-1',
      suggestedText: 'Resilience',
      confidence: 0.88,
      status: 'pending',
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/auto-code-transcript`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ transcriptId, instructions: 'Focus on emotional themes' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.valid).toBe(1);
    expect(res.body.data.suggestions).toHaveLength(1);
  });

  // ─── 5. POST /canvas/:id/ai/auto-code-transcript — invalid transcript returns 404 ───
  it('POST /canvas/:id/ai/auto-code-transcript with invalid transcript returns 404', async () => {
    mockPrisma.canvasTranscript.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/auto-code-transcript`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ transcriptId: 'tr-nonexistent', instructions: 'code it' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Transcript not found/);
  });

  // ─── 6. PUT /canvas/:id/ai/suggestions/:sid — accepted creates coding ───
  it('PUT /canvas/:id/ai/suggestions/:sid with status=accepted creates coding', async () => {
    const suggestionId = 'sug-accept-1';
    mockPrisma.aiSuggestion.findFirst.mockResolvedValue({
      id: suggestionId,
      canvasId,
      transcriptId,
      questionId: 'q-1',
      suggestedText: 'Resilience',
      startOffset: 30,
      endOffset: 65,
      codedText: 'resilience in the face of adversity',
      confidence: 0.92,
      status: 'pending',
    });
    mockPrisma.canvasTextCoding.create.mockResolvedValue({ id: 'coding-new-1' });
    mockPrisma.aiSuggestion.update.mockResolvedValue({
      id: suggestionId,
      status: 'accepted',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/ai/suggestions/${suggestionId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('accepted');
    expect(mockPrisma.canvasTextCoding.create).toHaveBeenCalled();
  });

  // ─── 7. PUT /canvas/:id/ai/suggestions/:sid — accepted without questionId creates new code ───
  it('PUT /canvas/:id/ai/suggestions/:sid with accepted and no questionId creates new code', async () => {
    const suggestionId = 'sug-accept-2';
    mockPrisma.aiSuggestion.findFirst.mockResolvedValue({
      id: suggestionId,
      canvasId,
      transcriptId,
      questionId: null,
      suggestedText: 'New Theme',
      startOffset: 0,
      endOffset: 20,
      codedText: 'new theme discussed',
      confidence: 0.75,
      status: 'pending',
    });
    mockPrisma.canvasQuestion.create.mockResolvedValue({ id: 'q-new-1' });
    mockPrisma.canvasTextCoding.create.mockResolvedValue({ id: 'coding-new-2' });
    mockPrisma.aiSuggestion.update.mockResolvedValue({
      id: suggestionId,
      status: 'accepted',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/ai/suggestions/${suggestionId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockPrisma.canvasQuestion.create).toHaveBeenCalled();
    expect(mockPrisma.canvasTextCoding.create).toHaveBeenCalled();
  });

  // ─── 8. PUT /canvas/:id/ai/suggestions/:sid — rejected marks rejected ───
  it('PUT /canvas/:id/ai/suggestions/:sid with status=rejected marks rejected', async () => {
    const suggestionId = 'sug-reject-1';
    mockPrisma.aiSuggestion.findFirst.mockResolvedValue({
      id: suggestionId,
      canvasId,
      transcriptId,
      questionId: 'q-1',
      suggestedText: 'Resilience',
      status: 'pending',
    });
    mockPrisma.aiSuggestion.update.mockResolvedValue({
      id: suggestionId,
      status: 'rejected',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/ai/suggestions/${suggestionId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ status: 'rejected' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('rejected');
    expect(mockPrisma.canvasTextCoding.create).not.toHaveBeenCalled();
  });

  // ─── 9. PUT /canvas/:id/ai/suggestions/:sid — not found returns 404 ───
  it('PUT /canvas/:id/ai/suggestions/:sid returns 404 for missing suggestion', async () => {
    mockPrisma.aiSuggestion.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/ai/suggestions/sug-nonexistent`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ─── 10. GET /canvas/:id/ai/suggestions — returns suggestions list ───
  it('GET /canvas/:id/ai/suggestions returns pending suggestions', async () => {
    mockPrisma.aiSuggestion.findMany.mockResolvedValue([
      { id: 'sug-1', suggestedText: 'Theme A', status: 'pending', confidence: 0.9 },
      { id: 'sug-2', suggestedText: 'Theme B', status: 'pending', confidence: 0.7 },
    ]);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/ai/suggestions`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  // ─── 11. POST /canvas/:id/ai/suggestions/bulk-action — bulk accept ───
  it('POST /canvas/:id/ai/suggestions/bulk-action accepts multiple suggestions', async () => {
    mockPrisma.aiSuggestion.findMany.mockResolvedValue([
      { id: 'sug-b1', canvasId, transcriptId, questionId: 'q-1', suggestedText: 'Theme', startOffset: 0, endOffset: 10, codedText: 'some text', status: 'pending' },
    ]);
    mockPrisma.canvasTextCoding.create.mockResolvedValue({ id: 'coding-b1' });
    mockPrisma.aiSuggestion.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/suggestions/bulk-action`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ suggestionIds: ['sug-b1'], action: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updated).toBe(1);
  });

  // ─── 12. POST /canvas/:id/ai/chat — returns AI response with citations ───
  it('POST /canvas/:id/ai/chat returns AI response with citations', async () => {
    mockPrisma.chatMessage.create
      .mockResolvedValueOnce({ id: 'msg-user-1', role: 'user', content: 'What themes emerge?' })
      .mockResolvedValueOnce({
        id: 'msg-asst-1',
        role: 'assistant',
        content: 'Based on the transcript, the key theme is resilience.',
        citations: JSON.stringify([{ sourceType: 'transcript', sourceId: 'tr-1', text: 'resilience' }]),
        createdAt: new Date(),
      });
    mockPrisma.aiUsage.create.mockResolvedValue({});

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/chat`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ message: 'What themes emerge?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('assistant');
    expect(res.body.data.content).toContain('resilience');
    expect(res.body.data.citations).toHaveLength(1);
  });

  // ─── 13. POST /canvas/:id/ai/chat — missing message body returns 400 ───
  it('POST /canvas/:id/ai/chat without message body returns 400', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/chat`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(400);
  });

  // ─── 14. POST /canvas/:id/ai/embed — indexes transcript chunks ───
  it('POST /canvas/:id/ai/embed indexes transcript chunks', async () => {
    mockPrisma.canvasTranscript.findMany.mockResolvedValue([
      { id: 'tr-1', title: 'Interview', content: 'Some qualitative data content here.' },
    ]);
    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([]);
    mockPrisma.canvasMemo.findMany.mockResolvedValue([]);
    mockPrisma.textEmbedding.deleteMany.mockResolvedValue({ count: 0 });

    mockLlmProvider.embedBatch.mockResolvedValue([
      { embedding: [0.1, 0.2, 0.3], inputTokens: 15 },
    ]);

    mockPrisma.textEmbedding.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.aiUsage.create.mockResolvedValue({});

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/embed`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.embedded).toBe(1);
  });

  // ─── 15. GET /canvas/:id/ai/chat/history — returns chat history ───
  it('GET /canvas/:id/ai/chat/history returns chat history', async () => {
    const now = new Date();
    mockPrisma.chatMessage.findMany.mockResolvedValue([
      { id: 'msg-1', canvasId, userId, role: 'user', content: 'Hello', citations: null, createdAt: now },
      { id: 'msg-2', canvasId, userId: null, role: 'assistant', content: 'Hi there', citations: '[]', createdAt: now },
    ]);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/ai/chat/history`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].role).toBe('user');
    expect(res.body.data[1].role).toBe('assistant');
  });

  // ─── 16. POST /canvas/:id/ai/summarize — returns summary ───
  it('POST /canvas/:id/ai/summarize returns summary', async () => {
    mockPrisma.canvasTranscript.findFirst.mockResolvedValue({ ...mockTranscript });

    mockLlmProvider.complete.mockResolvedValue({
      content: 'The participant discussed resilience and coping mechanisms.',
      model: 'gpt-4',
      inputTokens: 300,
      outputTokens: 50,
    });

    const now = new Date();
    mockPrisma.summary.create.mockResolvedValue({
      id: 'sum-1',
      canvasId,
      sourceType: 'transcript',
      sourceId: transcriptId,
      summaryText: 'The participant discussed resilience and coping mechanisms.',
      summaryType: 'paraphrase',
      createdAt: now,
      updatedAt: now,
    });
    mockPrisma.aiUsage.create.mockResolvedValue({});

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/summarize`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ sourceType: 'transcript', sourceId: transcriptId, summaryType: 'paraphrase' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summaryType).toBe('paraphrase');
    expect(res.body.data.summaryText).toBeTruthy();
  });

  // ─── 17. POST /canvas/:id/ai/summarize — with type=thematic ───
  it('POST /canvas/:id/ai/summarize with type=thematic returns thematic analysis', async () => {
    mockPrisma.canvasTranscript.findFirst.mockResolvedValue({ ...mockTranscript });

    mockLlmProvider.complete.mockResolvedValue({
      content: '1. Resilience\n2. Coping Strategies\n3. Adversity',
      model: 'gpt-4',
      inputTokens: 300,
      outputTokens: 80,
    });

    const now = new Date();
    mockPrisma.summary.create.mockResolvedValue({
      id: 'sum-2',
      canvasId,
      sourceType: 'transcript',
      sourceId: transcriptId,
      summaryText: '1. Resilience\n2. Coping Strategies\n3. Adversity',
      summaryType: 'thematic',
      createdAt: now,
      updatedAt: now,
    });
    mockPrisma.aiUsage.create.mockResolvedValue({});

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/ai/summarize`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ sourceType: 'transcript', sourceId: transcriptId, summaryType: 'thematic' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summaryType).toBe('thematic');
  });

  // ─── 18. GET /canvas/:id/summaries — returns summaries list ───
  it('GET /canvas/:id/summaries returns summaries list', async () => {
    const now = new Date();
    mockPrisma.summary.findMany.mockResolvedValue([
      { id: 'sum-1', canvasId, sourceType: 'transcript', sourceId: transcriptId, summaryText: 'Summary 1', summaryType: 'paraphrase', createdAt: now, updatedAt: now },
      { id: 'sum-2', canvasId, sourceType: 'transcript', sourceId: transcriptId, summaryText: 'Summary 2', summaryType: 'thematic', createdAt: now, updatedAt: now },
    ]);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/summaries`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  // ─── 19. PUT /canvas/:id/summaries/:sid — edits summary ───
  it('PUT /canvas/:id/summaries/:sid edits summary text', async () => {
    const now = new Date();
    mockPrisma.summary.findFirst.mockResolvedValue({
      id: 'sum-1',
      canvasId,
      sourceType: 'transcript',
      sourceId: transcriptId,
      summaryText: 'Original',
      summaryType: 'paraphrase',
    });
    mockPrisma.summary.update.mockResolvedValue({
      id: 'sum-1',
      canvasId,
      sourceType: 'transcript',
      sourceId: transcriptId,
      summaryText: 'Edited summary text',
      summaryType: 'paraphrase',
      createdAt: now,
      updatedAt: now,
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/summaries/sum-1`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ summaryText: 'Edited summary text' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summaryText).toBe('Edited summary text');
  });

  // ─── 20. PUT /canvas/:id/summaries/:sid — not found returns 404 ───
  it('PUT /canvas/:id/summaries/:sid returns 404 for missing summary', async () => {
    mockPrisma.summary.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/summaries/sum-nonexistent`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ summaryText: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
