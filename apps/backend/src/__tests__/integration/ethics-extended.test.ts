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
      update: vi.fn(),
    },
    canvasTranscript: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    canvasTextCoding: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    consentRecord: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
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

// Track whether ethicsAccess blocks or allows
let ethicsAccessBlocked = false;

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
  checkEthicsAccess: () => (_req: Request, res: Response, next: NextFunction) => {
    if (ethicsAccessBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Ethics features require a Pro plan or higher',
        code: 'PLAN_LIMIT_EXCEEDED',
        upgrade: true,
      });
    }
    next();
  },
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

import request from 'supertest';
import express from 'express';
import { auth } from '../../middleware/auth.js';
import { ethicsRoutes } from '../../routes/ethicsRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', auth, ethicsRoutes);
  app.use(errorHandler);
  return app;
}

describe('Ethics extended integration tests', () => {
  let app: express.Express;
  const userId = 'user-ethics-1';
  const dashboardAccessId = 'da-ethics-1';
  let jwt: string;

  const mockUser = {
    id: userId,
    email: 'ethics@example.com',
    name: 'Ethics Tester',
    role: 'researcher',
    plan: 'pro',
    passwordHash: '$2a$12$hashedpassword',
    dashboardAccess: { id: dashboardAccessId },
  };

  const canvasId = 'canvas-eth-1';
  const mockCanvas = {
    id: canvasId,
    name: 'Ethics Test Canvas',
    description: 'Canvas for ethics tests',
    dashboardAccessId,
    userId,
    ethicsApprovalId: null,
    ethicsStatus: null,
    dataRetentionDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeAll(() => {
    jwt = signUserToken(userId, 'researcher', 'pro');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    ethicsAccessBlocked = false;
    app = createApp();
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
    mockPrisma.codingCanvas.findUnique.mockResolvedValue({ ...mockCanvas });
  });

  // ─── 1. GET /canvas/:canvasId/ethics — returns ethics config ───
  it('GET /canvas/:canvasId/ethics returns ethics config with consent records', async () => {
    const now = new Date();
    mockPrisma.consentRecord.findMany.mockResolvedValue([
      { id: 'cr-1', canvasId, participantId: 'P001', consentType: 'informed', consentStatus: 'granted', createdAt: now },
    ]);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/ethics`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.consentRecords).toHaveLength(1);
    expect(res.body.data.ethicsApprovalId).toBeNull();
  });

  // ─── 2. PUT /canvas/:canvasId/ethics — updates ethics settings ───
  it('PUT /canvas/:canvasId/ethics updates ethics approval and status', async () => {
    mockPrisma.codingCanvas.update.mockResolvedValue({
      ...mockCanvas,
      ethicsApprovalId: 'IRB-2024-001',
      ethicsStatus: 'approved',
      dataRetentionDate: null,
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/ethics`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        ethicsApprovalId: 'IRB-2024-001',
        ethicsStatus: 'approved',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ethicsApprovalId).toBe('IRB-2024-001');
    expect(res.body.data.ethicsStatus).toBe('approved');
  });

  // ─── 3. PUT /canvas/:canvasId/ethics — sets data retention date ───
  it('PUT /canvas/:canvasId/ethics sets data retention date', async () => {
    const retentionDate = '2025-12-31T00:00:00.000Z';
    mockPrisma.codingCanvas.update.mockResolvedValue({
      ...mockCanvas,
      dataRetentionDate: new Date(retentionDate),
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/ethics`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ dataRetentionDate: retentionDate });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dataRetentionDate).toBeTruthy();
  });

  // ─── 4. POST /canvas/:canvasId/consent — creates consent record ───
  it('POST /canvas/:canvasId/consent creates consent record', async () => {
    const now = new Date();
    mockPrisma.consentRecord.create.mockResolvedValue({
      id: 'cr-new-1',
      canvasId,
      participantId: 'P002',
      consentType: 'informed',
      consentStatus: 'granted',
      ethicsProtocol: 'IRB-2024-001',
      notes: 'Verbal consent obtained',
      createdAt: now,
    });

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/consent`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        participantId: 'P002',
        consentType: 'informed',
        ethicsProtocol: 'IRB-2024-001',
        notes: 'Verbal consent obtained',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.participantId).toBe('P002');
    expect(res.body.data.consentType).toBe('informed');
  });

  // ─── 5. POST /canvas/:canvasId/consent — duplicate participant returns 409 ───
  it('POST /canvas/:canvasId/consent returns 409 for duplicate participant', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: any = new Error('Unique constraint failed');
    err.code = 'P2002';
    mockPrisma.consentRecord.create.mockRejectedValue(err);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/consent`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        participantId: 'P001',
        consentType: 'informed',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already exists/);
  });

  // ─── 6. GET /canvas/:canvasId/consent — lists consent records ───
  it('GET /canvas/:canvasId/consent lists all consent records', async () => {
    const now = new Date();
    mockPrisma.consentRecord.findMany.mockResolvedValue([
      { id: 'cr-1', canvasId, participantId: 'P001', consentType: 'informed', consentStatus: 'granted', createdAt: now },
      { id: 'cr-2', canvasId, participantId: 'P002', consentType: 'written', consentStatus: 'granted', createdAt: now },
    ]);

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/consent`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  // ─── 7. PUT /canvas/:canvasId/consent/:consentId/withdraw — withdraws consent ───
  it('PUT /canvas/:canvasId/consent/:consentId/withdraw marks consent as withdrawn', async () => {
    const consentId = 'cr-withdraw-1';
    mockPrisma.consentRecord.findUnique.mockResolvedValue({
      id: consentId,
      canvasId,
      participantId: 'P003',
      consentType: 'informed',
      consentStatus: 'granted',
      notes: 'Original notes',
    });

    const now = new Date();
    mockPrisma.consentRecord.update.mockResolvedValue({
      id: consentId,
      canvasId,
      participantId: 'P003',
      consentType: 'informed',
      consentStatus: 'withdrawn',
      withdrawalDate: now,
      notes: 'Participant requested withdrawal',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/consent/${consentId}/withdraw`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ notes: 'Participant requested withdrawal' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.consentStatus).toBe('withdrawn');
    expect(res.body.data.withdrawalDate).toBeTruthy();
  });

  // ─── 8. PUT /canvas/:canvasId/consent/:consentId/withdraw — already withdrawn returns 400 ───
  it('PUT /canvas/:canvasId/consent/:consentId/withdraw returns 400 if already withdrawn', async () => {
    const consentId = 'cr-already-withdrawn';
    mockPrisma.consentRecord.findUnique.mockResolvedValue({
      id: consentId,
      canvasId,
      participantId: 'P004',
      consentType: 'informed',
      consentStatus: 'withdrawn',
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/consent/${consentId}/withdraw`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already been withdrawn/);
  });

  // ─── 9. PUT /canvas/:canvasId/consent/:consentId/withdraw — not found returns 404 ───
  it('PUT /canvas/:canvasId/consent/:consentId/withdraw returns 404 for missing record', async () => {
    mockPrisma.consentRecord.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/consent/cr-nonexistent/withdraw`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({});

    expect(res.status).toBe(404);
  });

  // ─── 10. POST /canvas/:canvasId/transcripts/:transcriptId/anonymize — replaces PII ───
  it('POST /canvas/:canvasId/transcripts/:transcriptId/anonymize replaces PII', async () => {
    const transcriptId = 'tr-anon-1';
    mockPrisma.canvasTranscript.findUnique.mockResolvedValue({
      id: transcriptId,
      canvasId,
      title: 'Interview with John',
      content: 'John said he lives in Springfield. John works at the clinic.',
    });

    mockPrisma.canvasTextCoding.findMany.mockResolvedValue([
      { id: 'coding-1', transcriptId, codedText: 'John said he lives in Springfield', note: null },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockResolvedValue([{}, {}] as any);

    const updatedTranscript = {
      id: transcriptId,
      canvasId,
      title: 'Interview with John',
      content: '[Participant] said he lives in [City]. [Participant] works at the clinic.',
      isAnonymized: true,
    };
    mockPrisma.canvasTranscript.findUnique
      .mockResolvedValueOnce({
        id: transcriptId,
        canvasId,
        title: 'Interview with John',
        content: 'John said he lives in Springfield. John works at the clinic.',
      })
      .mockResolvedValueOnce(updatedTranscript);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts/${transcriptId}/anonymize`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        replacements: [
          { find: 'John', replace: '[Participant]' },
          { find: 'Springfield', replace: '[City]' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isAnonymized).toBe(true);
  });

  // ─── 11. POST /canvas/:canvasId/transcripts/:transcriptId/anonymize — transcript not found ───
  it('POST /canvas/:canvasId/transcripts/:transcriptId/anonymize returns 404 for missing transcript', async () => {
    mockPrisma.canvasTranscript.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/canvas/${canvasId}/transcripts/tr-ghost/anonymize`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        replacements: [{ find: 'name', replace: '[REDACTED]' }],
      });

    expect(res.status).toBe(404);
  });

  // ─── 12. GET /audit-log — returns audit trail entries ───
  it('GET /audit-log returns audit trail entries for the authenticated user', async () => {
    const now = new Date();
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { id: 'al-1', action: 'ethics.update', resource: 'canvas', resourceId: canvasId, actorId: dashboardAccessId, timestamp: now },
      { id: 'al-2', action: 'consent.create', resource: 'consent', resourceId: 'cr-1', actorId: dashboardAccessId, timestamp: now },
    ]);
    mockPrisma.auditLog.count.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/audit-log')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.entries).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
  });

  // ─── 13. GET /audit-log — supports filtering by action ───
  it('GET /audit-log filters by action parameter', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([
      { id: 'al-1', action: 'consent.create', resource: 'consent', resourceId: 'cr-1', actorId: dashboardAccessId, timestamp: new Date() },
    ]);
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/audit-log?action=consent.create')
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(1);
    expect(res.body.data.entries[0].action).toBe('consent.create');
  });

  // ─── 14. Ethics panel requires Pro plan ───
  it('GET /canvas/:canvasId/ethics returns 403 for Free plan users', async () => {
    ethicsAccessBlocked = true;

    const res = await request(app)
      .get(`/api/canvas/${canvasId}/ethics`)
      .set('Authorization', `Bearer ${jwt}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    expect(res.body.upgrade).toBe(true);
  });

  // ─── 15. PUT /canvas/:canvasId/ethics — non-owner returns 403 ───
  it('PUT /canvas/:canvasId/ethics returns 403 for non-owner', async () => {
    const otherUserId = 'user-other-ethics';
    const otherDaId = 'da-other-ethics';
    const otherJwt = signUserToken(otherUserId, 'researcher', 'pro');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: otherUserId,
      email: 'other-ethics@example.com',
      name: 'Other Ethics User',
      role: 'researcher',
      plan: 'pro',
      dashboardAccess: { id: otherDaId },
    });

    const res = await request(app)
      .put(`/api/canvas/${canvasId}/ethics`)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send({ ethicsApprovalId: 'IRB-HACK' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
