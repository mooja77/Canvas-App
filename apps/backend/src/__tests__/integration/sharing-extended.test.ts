import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma before any imports that use it ───
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    dashboardAccess: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    codingCanvas: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    canvasTranscript: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    canvasQuestion: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    canvasTextCoding: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    canvasMemo: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    canvasShare: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    canvasCase: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    canvasRelation: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    canvasComputedNode: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    canvasCollaborator: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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
  nanoid: vi.fn().mockReturnValue('UNIQ1234'),
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
import { shareRoutes, canvasPublicRoutes } from '../../routes/shareRoutes.js';
import { collaborationRoutes } from '../../routes/collaborationRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  // Public routes (no auth)
  app.use('/api', canvasPublicRoutes);
  // Protected routes — single auth call for all protected routers
  app.use('/api', auth, shareRoutes, collaborationRoutes);
  app.use(errorHandler);
  return app;
}

describe('Sharing extended integration tests', () => {
  let app: express.Express;
  const userId = 'user-share-ext-1';
  const dashboardAccessId = 'da-share-ext-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'share-ext@example.com',
    name: 'Share Extended Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-se-1';
  const mockCanvas = {
    id: canvasId,
    name: 'Sharing Extended Canvas',
    description: 'Canvas for extended sharing tests',
    dashboardAccessId,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
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

  // ─── 1. Share code generation creates unique code ───
  it('POST /canvas/:id/share creates a unique share code', async () => {
    mockPrisma.canvasShare.create.mockResolvedValue({
      id: 'share-unique-1',
      canvasId,
      shareCode: 'SHARE-UNIQ1234',
      createdBy: dashboardAccessId,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/share`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(201);
    expect(res.body.data.shareCode).toMatch(/^SHARE-/);
    expect(res.body.data.shareCode.length).toBeGreaterThan(6);
  });

  // ─── 2. Share code with expiry expires correctly ───
  it('GET /canvas/shared/:code returns 410 for expired share code', async () => {
    const pastDate = new Date('2020-01-01');
    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: 'share-exp-1',
      canvasId,
      shareCode: 'SHARE-EXPIRED99',
      expiresAt: pastDate,
    });

    const res = await request(app)
      .get('/api/canvas/shared/SHARE-EXPIRED99');

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
  });

  // ─── 3. Clone via share code creates full canvas copy ───
  it('POST /canvas/clone/:code creates full canvas copy including transcripts, codes, codings', async () => {
    const shareCode = 'SHARE-CLONE01';

    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: 'share-clone-1',
      canvasId,
      shareCode,
      expiresAt: null,
    });

    const sourceCanvas = {
      ...mockCanvas,
      transcripts: [
        { id: 'tr-src-1', title: 'Interview 1', content: 'Content here', sortOrder: 0, caseId: null },
      ],
      questions: [
        { id: 'q-src-1', text: 'Resilience', color: '#FF0000', sortOrder: 0, parentQuestionId: null },
      ],
      memos: [
        { id: 'm-src-1', title: 'Note', content: 'A memo', color: '#FFFF00' },
      ],
      codings: [
        { id: 'c-src-1', transcriptId: 'tr-src-1', questionId: 'q-src-1', startOffset: 0, endOffset: 10, codedText: 'Content he', note: null, annotation: null },
      ],
      cases: [],
      relations: [],
      computedNodes: [],
    };

    // Clone route calls codingCanvas.findUnique for source canvas (with include), then for unique name check
    mockPrisma.codingCanvas.findUnique
      .mockResolvedValueOnce(sourceCanvas) // source canvas with includes
      .mockResolvedValueOnce(null); // unique name check

    const clonedCanvas = {
      id: 'canvas-cloned-ext',
      name: 'Sharing Extended Canvas (Clone)',
      description: mockCanvas.description,
      dashboardAccessId,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        codingCanvas: { create: vi.fn().mockResolvedValue(clonedCanvas) },
        canvasTranscript: { create: vi.fn().mockResolvedValue({ id: 'tr-new-1' }) },
        canvasQuestion: { create: vi.fn().mockResolvedValue({ id: 'q-new-1' }), update: vi.fn() },
        canvasMemo: { create: vi.fn() },
        canvasTextCoding: { create: vi.fn() },
        canvasCase: { create: vi.fn() },
        canvasRelation: { create: vi.fn() },
        canvasComputedNode: { create: vi.fn() },
        canvasShare: { update: vi.fn() },
      };
      return fn(tx);
    });

    const res = await request(app)
      .post(`/api/canvas/clone/${shareCode}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toContain('Clone');
  });

  // ─── 4. Clone increments cloneCount on share record ───
  it('POST /canvas/clone/:code increments cloneCount on share record', async () => {
    const shareCode = 'SHARE-COUNT01';

    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: 'share-count-1',
      canvasId,
      shareCode,
      expiresAt: null,
      cloneCount: 5,
    });

    const sourceCanvas = {
      ...mockCanvas,
      transcripts: [],
      questions: [],
      memos: [],
      codings: [],
      cases: [],
      relations: [],
      computedNodes: [],
    };

    // Clone route calls codingCanvas.findUnique for source canvas, then for unique name check
    mockPrisma.codingCanvas.findUnique
      .mockResolvedValueOnce(sourceCanvas) // source canvas
      .mockResolvedValueOnce(null); // unique name check

    let shareUpdateCalled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        codingCanvas: { create: vi.fn().mockResolvedValue({ id: 'canvas-count-clone', name: 'Clone', dashboardAccessId }) },
        canvasTranscript: { create: vi.fn() },
        canvasQuestion: { create: vi.fn(), update: vi.fn() },
        canvasMemo: { create: vi.fn() },
        canvasTextCoding: { create: vi.fn() },
        canvasCase: { create: vi.fn() },
        canvasRelation: { create: vi.fn() },
        canvasComputedNode: { create: vi.fn() },
        canvasShare: {
          update: vi.fn().mockImplementation(() => {
            shareUpdateCalled = true;
            return Promise.resolve({});
          }),
        },
      };
      return fn(tx);
    });

    const res = await request(app)
      .post(`/api/canvas/clone/${shareCode}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(201);
    expect(shareUpdateCalled).toBe(true);
  });

  // ─── 5. Revoke share code prevents further cloning ───
  it('DELETE /canvas/:id/share/:shareId revokes share, then clone returns 404', async () => {
    const shareId = 'share-revoke-1';
    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: shareId,
      canvasId,
      shareCode: 'SHARE-REVOKE01',
    });
    mockPrisma.canvasShare.delete.mockResolvedValue({ id: shareId });

    const revokeRes = await request(app)
      .delete(`/api/canvas/${canvasId}/share/${shareId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(revokeRes.status).toBe(200);

    // Now try to clone with the revoked code
    mockPrisma.canvasShare.findUnique.mockResolvedValue(null);

    const cloneRes = await request(app)
      .post('/api/canvas/clone/SHARE-REVOKE01')
      .set('Authorization', `Bearer ${jwt}`);

    expect(cloneRes.status).toBe(404);
  });

  // ─── 6. Share code from deleted canvas returns error ───
  it('POST /canvas/clone/:code returns 404 when source canvas deleted', async () => {
    mockPrisma.canvasShare.findUnique.mockResolvedValue({
      id: 'share-del-1',
      canvasId: 'canvas-deleted',
      shareCode: 'SHARE-DELETED01',
      expiresAt: null,
    });
    // Clone route calls codingCanvas.findUnique for the source canvas
    mockPrisma.codingCanvas.findUnique.mockResolvedValueOnce(null); // source canvas not found

    const res = await request(app)
      .post('/api/canvas/clone/SHARE-DELETED01')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
  });

  // ─── 7. Collaborator add with role=editor ───
  it('POST /canvas/:id/collaborators adds editor collaborator', async () => {
    const targetUserId = 'user-collab-editor';
    mockPrisma.canvasCollaborator.count.mockResolvedValue(0);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser }) // auth lookup
      .mockResolvedValueOnce({ id: targetUserId, name: 'Editor User', email: 'editor@example.com', plan: 'pro', role: 'researcher', dashboardAccess: null }); // target user
    mockPrisma.canvasCollaborator.upsert.mockResolvedValue({
      id: 'collab-1',
      canvasId,
      userId: targetUserId,
      role: 'editor',
      invitedBy: userId,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/collaborators`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ userId: targetUserId, role: 'editor' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('editor');
  });

  // ─── 8. Collaborator add with role=viewer ───
  it('POST /canvas/:id/collaborators adds viewer collaborator', async () => {
    const targetUserId = 'user-collab-viewer';
    mockPrisma.canvasCollaborator.count.mockResolvedValue(0);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser })
      .mockResolvedValueOnce({ id: targetUserId, name: 'Viewer User', email: 'viewer@example.com', plan: 'pro', role: 'researcher', dashboardAccess: null });
    mockPrisma.canvasCollaborator.upsert.mockResolvedValue({
      id: 'collab-2',
      canvasId,
      userId: targetUserId,
      role: 'viewer',
      invitedBy: userId,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/collaborators`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ userId: targetUserId, role: 'viewer' });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('viewer');
  });

  // ─── 9. Cannot add yourself as collaborator ───
  it('POST /canvas/:id/collaborators returns 400 when adding yourself', async () => {
    mockPrisma.canvasCollaborator.count.mockResolvedValue(0);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/collaborators`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ userId, role: 'editor' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot add yourself/);
  });

  // ─── 10. Collaborator add with non-existent user returns 404 ───
  it('POST /canvas/:id/collaborators returns 404 for non-existent user', async () => {
    mockPrisma.canvasCollaborator.count.mockResolvedValue(0);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...mockUser }) // auth lookup
      .mockResolvedValueOnce(null); // target user not found

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/collaborators`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ userId: 'user-nonexistent', role: 'editor' });

    expect(res.status).toBe(404);
  });

  // ─── 11. Remove collaborator revokes access ───
  it('DELETE /canvas/:id/collaborators/:userId removes collaborator', async () => {
    const targetUserId = 'user-collab-remove';
    mockPrisma.canvasCollaborator.findUnique.mockResolvedValue({
      id: 'collab-remove-1',
      canvasId,
      userId: targetUserId,
      role: 'editor',
    });
    mockPrisma.canvasCollaborator.delete.mockResolvedValue({ id: 'collab-remove-1' });

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/collaborators/${targetUserId}`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/removed/i);
  });

  // ─── 12. Remove non-existent collaborator returns 404 ───
  it('DELETE /canvas/:id/collaborators/:userId returns 404 for non-existent', async () => {
    mockPrisma.canvasCollaborator.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/canvas/${canvasId}/collaborators/user-ghost`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(404);
  });

  // ─── 13. List collaborators returns all with roles ───
  it('GET /canvas/:id/collaborators returns all collaborators with roles', async () => {
    mockPrisma.canvasCollaborator.findMany.mockResolvedValue([
      { id: 'c1', canvasId, userId: 'u1', role: 'editor', createdAt: new Date() },
      { id: 'c2', canvasId, userId: 'u2', role: 'viewer', createdAt: new Date() },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'Editor', email: 'editor@test.com' },
      { id: 'u2', name: 'Viewer', email: 'viewer@test.com' },
    ]);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/collaborators`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].userName).toBe('Editor');
    expect(res.body.data[1].role).toBe('viewer');
  });

  // ─── 14. POST /canvas/:id/collaborators without userId returns 400 ───
  it('POST /canvas/:id/collaborators without userId returns 400', async () => {
    const res = await request(app)
      .post(`/api/canvas/${canvasId}/collaborators`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ role: 'editor' });

    expect(res.status).toBe(400);
  });

  // ─── 15. Non-owner cannot add collaborators ───
  it('POST /canvas/:id/collaborators returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-collab';
    const otherDaId = 'da-other-collab';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'other-collab@example.com',
      name: 'Other Collab',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/collaborators`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ userId: 'some-user', role: 'editor' });

    expect(res.status).toBe(403);
  });
});
