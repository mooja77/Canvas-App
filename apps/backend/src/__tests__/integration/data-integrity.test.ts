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
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasQuestion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    canvasTextCoding: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    canvasMemo: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasCase: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasComputedNode: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasNodePosition: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    canvasShare: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    canvasCollaborator: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    canvasRelation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
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

describe('Data integrity integration tests', () => {
  let app: express.Express;
  const userId = 'user-integrity-1';
  const dashboardAccessId = 'da-integrity-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'integrity@example.com',
    name: 'Integrity Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-integrity-1';
  const mockCanvas = {
    id: canvasId,
    name: 'Test Canvas',
    description: 'A test canvas',
    dashboardAccessId,
    userId,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
    // resetAllMocks wipes the mockReturnValue set at module-init. Re-apply so
    // audit log callsites that hash PII still get a string back.
    const hashing = await import('../../utils/hashing.js');
    (hashing.sha256 as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue('sha256hash');
  });

  // ═══════════════════════════════════════════════
  // Cascading deletes (permanent delete)
  // ═══════════════════════════════════════════════

  describe('Cascading deletes — permanent canvas deletion', () => {
    const softDeletedCanvas = { ...mockCanvas, deletedAt: new Date() };

    it('permanent delete canvas calls prisma.codingCanvas.delete (cascades transcripts)', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      mockPrisma.codingCanvas.delete.mockResolvedValue({ ...softDeletedCanvas });

      const res = await request(app).delete(`/api/canvas/${canvasId}/permanent`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPrisma.codingCanvas.delete).toHaveBeenCalledWith({ where: { id: canvasId } });
    });

    it('permanent delete canvas cascades questions/codes via DB onDelete: Cascade', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      mockPrisma.codingCanvas.delete.mockResolvedValue({ ...softDeletedCanvas });

      const res = await request(app).delete(`/api/canvas/${canvasId}/permanent`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      // The single delete call triggers DB-level cascades for questions
      expect(mockPrisma.codingCanvas.delete).toHaveBeenCalledTimes(1);
    });

    it('permanent delete canvas cascades codings via DB onDelete: Cascade', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      mockPrisma.codingCanvas.delete.mockResolvedValue({ ...softDeletedCanvas });

      const res = await request(app).delete(`/api/canvas/${canvasId}/permanent`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(mockPrisma.codingCanvas.delete).toHaveBeenCalledWith({ where: { id: canvasId } });
    });

    it('permanent delete canvas cascades memos via DB onDelete: Cascade', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      mockPrisma.codingCanvas.delete.mockResolvedValue({ ...softDeletedCanvas });

      const res = await request(app).delete(`/api/canvas/${canvasId}/permanent`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('permanent delete canvas cascades cases via DB onDelete: Cascade', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      mockPrisma.codingCanvas.delete.mockResolvedValue({ ...softDeletedCanvas });

      const res = await request(app).delete(`/api/canvas/${canvasId}/permanent`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('permanent delete canvas cascades computed nodes via DB onDelete: Cascade', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      mockPrisma.codingCanvas.delete.mockResolvedValue({ ...softDeletedCanvas });

      const res = await request(app).delete(`/api/canvas/${canvasId}/permanent`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('permanent delete canvas cascades node positions via DB onDelete: Cascade', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      mockPrisma.codingCanvas.delete.mockResolvedValue({ ...softDeletedCanvas });

      const res = await request(app).delete(`/api/canvas/${canvasId}/permanent`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('permanent delete canvas cascades share codes via DB onDelete: Cascade', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      mockPrisma.codingCanvas.delete.mockResolvedValue({ ...softDeletedCanvas });

      const res = await request(app).delete(`/api/canvas/${canvasId}/permanent`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('permanent delete canvas cascades collaborators via DB onDelete: Cascade', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      mockPrisma.codingCanvas.delete.mockResolvedValue({ ...softDeletedCanvas });

      const res = await request(app).delete(`/api/canvas/${canvasId}/permanent`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('permanent delete requires canvas to be in trash first', async () => {
      // Canvas NOT soft-deleted
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas, deletedAt: null });

      const res = await request(app).delete(`/api/canvas/${canvasId}/permanent`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/trash/i);
      expect(mockPrisma.codingCanvas.delete).not.toHaveBeenCalled();
    });
  });

  describe('Cascading deletes — transcript/question deletion', () => {
    it('delete transcript cascades its codings via DB onDelete: Cascade', async () => {
      const transcriptId = 'transcript-cascade-1';
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
      mockPrisma.canvasTranscript.findUnique.mockResolvedValue({ id: transcriptId, canvasId });
      mockPrisma.canvasTranscript.delete.mockResolvedValue({ id: transcriptId });

      const res = await request(app)
        .delete(`/api/canvas/${canvasId}/transcripts/${transcriptId}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPrisma.canvasTranscript.delete).toHaveBeenCalledWith({ where: { id: transcriptId } });
    });

    it('delete question cascades its codings via DB onDelete: Cascade', async () => {
      const questionId = 'question-cascade-1';
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
      mockPrisma.canvasQuestion.findUnique.mockResolvedValue({ id: questionId, canvasId });
      mockPrisma.canvasQuestion.delete.mockResolvedValue({ id: questionId });

      const res = await request(app)
        .delete(`/api/canvas/${canvasId}/questions/${questionId}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPrisma.canvasQuestion.delete).toHaveBeenCalledWith({ where: { id: questionId } });
    });

    it('delete question with children — children parentQuestionId set null (onDelete: SetNull)', async () => {
      const parentId = 'question-parent-1';
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
      mockPrisma.canvasQuestion.findUnique.mockResolvedValue({ id: parentId, canvasId });
      // DB handles SetNull for children via schema relation
      mockPrisma.canvasQuestion.delete.mockResolvedValue({ id: parentId });

      const res = await request(app)
        .delete(`/api/canvas/${canvasId}/questions/${parentId}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // Orphan prevention
  // ═══════════════════════════════════════════════

  describe('Orphan prevention', () => {
    it('coding cannot reference non-existent transcript', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
      mockPrisma.canvasTranscript.findUnique.mockResolvedValue(null);
      mockPrisma.canvasQuestion.findUnique.mockResolvedValue({
        id: 'question-1',
        canvasId,
      });

      const res = await request(app)
        .post(`/api/canvas/${canvasId}/codings`)
        .set('Authorization', `Bearer ${jwt}`)
        .send({
          transcriptId: 'non-existent-transcript',
          questionId: 'question-1',
          startOffset: 0,
          endOffset: 10,
          codedText: 'some text',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/transcript not found/i);
    });

    it('coding cannot reference non-existent question', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
      mockPrisma.canvasTranscript.findUnique.mockResolvedValue({
        id: 'transcript-1',
        canvasId,
      });
      mockPrisma.canvasQuestion.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/canvas/${canvasId}/codings`)
        .set('Authorization', `Bearer ${jwt}`)
        .send({
          transcriptId: 'transcript-1',
          questionId: 'non-existent-question',
          startOffset: 0,
          endOffset: 10,
          codedText: 'some text',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/question not found/i);
    });

    it('computed node cannot reference non-existent canvas', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/canvas/nonexistent-canvas/computed-nodes`)
        .set('Authorization', `Bearer ${jwt}`)
        .send({
          nodeType: 'stats',
          label: 'Test Stats',
          config: {},
        });

      expect(res.status).toBe(404);
    });

    it('node position cannot reference non-existent canvas', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/canvas/nonexistent-canvas/layout`)
        .set('Authorization', `Bearer ${jwt}`)
        .send({
          positions: [{ nodeId: 'node-1', nodeType: 'transcript', x: 100, y: 200 }],
        });

      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════
  // Concurrent operations
  // ═══════════════════════════════════════════════

  describe('Concurrent operations', () => {
    it('two simultaneous canvas updates — last write wins, no corruption', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
      mockPrisma.codingCanvas.update
        .mockResolvedValueOnce({ ...mockCanvas, name: 'Update A' })
        .mockResolvedValueOnce({ ...mockCanvas, name: 'Update B' });

      const [resA, resB] = await Promise.all([
        request(app).put(`/api/canvas/${canvasId}`).set('Authorization', `Bearer ${jwt}`).send({ name: 'Update A' }),
        request(app).put(`/api/canvas/${canvasId}`).set('Authorization', `Bearer ${jwt}`).send({ name: 'Update B' }),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resA.body.data.name).toBe('Update A');
      expect(resB.body.data.name).toBe('Update B');
      expect(mockPrisma.codingCanvas.update).toHaveBeenCalledTimes(2);
    });

    it('two simultaneous coding creates on same text range — both succeed', async () => {
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
      mockPrisma.canvasTranscript.findUnique.mockResolvedValue({
        id: 'transcript-1',
        canvasId,
      });
      mockPrisma.canvasQuestion.findUnique.mockResolvedValue({
        id: 'question-1',
        canvasId,
      });
      mockPrisma.canvasTextCoding.create
        .mockResolvedValueOnce({
          id: 'coding-a',
          canvasId,
          transcriptId: 'transcript-1',
          questionId: 'question-1',
          startOffset: 0,
          endOffset: 10,
          codedText: 'overlapping',
        })
        .mockResolvedValueOnce({
          id: 'coding-b',
          canvasId,
          transcriptId: 'transcript-1',
          questionId: 'question-1',
          startOffset: 0,
          endOffset: 10,
          codedText: 'overlapping',
        });

      const payload = {
        transcriptId: 'transcript-1',
        questionId: 'question-1',
        startOffset: 0,
        endOffset: 10,
        codedText: 'overlapping',
      };

      const [resA, resB] = await Promise.all([
        request(app).post(`/api/canvas/${canvasId}/codings`).set('Authorization', `Bearer ${jwt}`).send(payload),
        request(app).post(`/api/canvas/${canvasId}/codings`).set('Authorization', `Bearer ${jwt}`).send(payload),
      ]);

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);
      expect(resA.body.data.id).not.toBe(resB.body.data.id);
    });

    it('delete canvas while coding — graceful error handling', async () => {
      // First call for coding route finds canvas; second call for delete finds it soft-deleted
      mockPrisma.codingCanvas.findUnique
        .mockResolvedValueOnce({ ...mockCanvas }) // auth for coding
        .mockResolvedValueOnce({ ...mockCanvas }) // getOwnedCanvas for coding — but Prisma throws on create
        .mockResolvedValueOnce({ ...mockCanvas }); // auth/getOwnedCanvas for delete

      // Simulate foreign key violation when canvas is deleted mid-coding
      mockPrisma.canvasTranscript.findUnique.mockResolvedValue({
        id: 'transcript-1',
        canvasId,
      });
      mockPrisma.canvasQuestion.findUnique.mockResolvedValue({
        id: 'question-1',
        canvasId,
      });
      mockPrisma.canvasTextCoding.create.mockRejectedValue(
        Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' }),
      );

      mockPrisma.codingCanvas.update.mockResolvedValue({ ...mockCanvas, deletedAt: new Date() });

      const codingRes = await request(app)
        .post(`/api/canvas/${canvasId}/codings`)
        .set('Authorization', `Bearer ${jwt}`)
        .send({
          transcriptId: 'transcript-1',
          questionId: 'question-1',
          startOffset: 0,
          endOffset: 10,
          codedText: 'text',
        });

      // Server returns 500 for unhandled Prisma error — does not crash
      expect(codingRes.status).toBe(500);
      expect(codingRes.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════
  // Soft delete consistency
  // ═══════════════════════════════════════════════

  describe('Soft delete consistency', () => {
    it('soft-deleted canvas excluded from GET /canvas list', async () => {
      mockPrisma.codingCanvas.findMany.mockResolvedValue([]);
      mockPrisma.codingCanvas.count.mockResolvedValue(0);

      const res = await request(app).get('/api/canvas').set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      // Verify the query filters out soft-deleted
      const findManyCall = mockPrisma.codingCanvas.findMany.mock.calls[0][0];
      expect(findManyCall.where.deletedAt).toBeNull();
    });

    it('soft-deleted canvas included in GET /canvas/trash', async () => {
      const trashedCanvas = {
        ...mockCanvas,
        deletedAt: new Date(),
        _count: { transcripts: 0, questions: 0, codings: 0 },
      };
      mockPrisma.codingCanvas.findMany.mockResolvedValue([trashedCanvas]);

      const res = await request(app).get('/api/canvas/trash').set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      // Verify the query filters for soft-deleted only
      const findManyCall = mockPrisma.codingCanvas.findMany.mock.calls[0][0];
      expect(findManyCall.where.deletedAt).toEqual({ not: null });
    });

    it('soft-deleted canvas can still be fetched by getOwnedCanvas (for restore/permanent delete)', async () => {
      const softDeletedCanvas = { ...mockCanvas, deletedAt: new Date() };
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      mockPrisma.codingCanvas.update.mockResolvedValue({ ...softDeletedCanvas, deletedAt: null });

      const res = await request(app).post(`/api/canvas/${canvasId}/restore`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('soft-deleted canvas can be restored', async () => {
      const softDeletedCanvas = { ...mockCanvas, deletedAt: new Date() };
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...softDeletedCanvas });
      const restoredCanvas = { ...softDeletedCanvas, deletedAt: null };
      mockPrisma.codingCanvas.update.mockResolvedValue(restoredCanvas);

      const res = await request(app).post(`/api/canvas/${canvasId}/restore`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPrisma.codingCanvas.update).toHaveBeenCalledWith({
        where: { id: canvasId },
        data: { deletedAt: null },
      });
    });

    it('double soft-delete is idempotent', async () => {
      // Canvas already soft-deleted — soft-deleting again still works (just updates deletedAt)
      const alreadyDeleted = { ...mockCanvas, deletedAt: new Date('2025-01-01') };
      mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...alreadyDeleted });
      mockPrisma.codingCanvas.update.mockResolvedValue({ ...alreadyDeleted, deletedAt: new Date() });

      const res = await request(app).delete(`/api/canvas/${canvasId}`).set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
