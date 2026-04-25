import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mock Prisma before any imports that use it ───
// vi.mock factories are hoisted, so we must use vi.hoisted for shared references
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    dashboardAccess: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    codingCanvas: { count: vi.fn() },
    canvasTranscript: { count: vi.fn() },
    canvasQuestion: { count: vi.fn() },
    canvasShare: { count: vi.fn() },
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Mock bcrypt for speed
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(),
  },
}));

// Mock rate limiter to be a pass-through
vi.mock('../../middleware/authLimiter.js', () => ({
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Mock audit logging
vi.mock('../../middleware/auditLog.js', () => ({
  logAudit: vi.fn(),
  auditLog: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Mock hashing utils
vi.mock('../../utils/hashing.js', () => ({
  sha256: vi.fn().mockReturnValue('sha256hash'),
  verifyAccessCode: vi.fn().mockResolvedValue(false),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock12nanoid'),
}));

// Mock stripe
vi.mock('../../lib/stripe.js', () => ({
  getStripe: vi.fn().mockReturnValue({
    subscriptions: { cancel: vi.fn() },
  }),
}));

import bcrypt from 'bcryptjs';
import request from 'supertest';
import express from 'express';
import { userAuthRoutes } from '../../routes/userAuthRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';

// Build a minimal Express app with the auth routes
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', userAuthRoutes);
  app.use(errorHandler);
  return app;
}

describe('Auth routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  // ─── POST /auth/signup ───
  describe('POST /api/auth/signup', () => {
    it('creates a new user and returns JWT', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const createdUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'researcher',
        plan: 'free',
        passwordHash: '$2a$12$hashedpassword',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          user: { create: vi.fn().mockResolvedValue(createdUser) },
          dashboardAccess: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jwt).toBeDefined();
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.user.plan).toBe('free');
    });

    it('rejects duplicate email with 409', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'short', name: 'Test User' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/8 characters/);
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name/i);
    });

    it('sets trialEndsAt 14 days in the future on new email signup', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const userCreate = vi.fn().mockResolvedValue({
        id: 'trial-user',
        email: 'trial@example.com',
        name: 'Trial User',
        role: 'researcher',
        plan: 'free',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          user: { create: userCreate },
          dashboardAccess: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      const before = Date.now();
      await request(app)
        .post('/api/auth/signup')
        .send({ email: 'trial@example.com', password: 'password123', name: 'Trial User' });
      const after = Date.now();

      expect(userCreate).toHaveBeenCalledTimes(1);
      const data = userCreate.mock.calls[0][0].data;
      expect(data.plan).toBe('free');
      expect(data.trialEndsAt).toBeInstanceOf(Date);
      const trialMs = data.trialEndsAt.getTime();
      const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
      // Allow a small drift for test execution time.
      expect(trialMs).toBeGreaterThanOrEqual(before + FOURTEEN_DAYS_MS - 1000);
      expect(trialMs).toBeLessThanOrEqual(after + FOURTEEN_DAYS_MS + 1000);
    });
  });

  // ─── POST /auth/email-login ───
  describe('POST /api/auth/email-login', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'researcher',
      plan: 'free',
      passwordHash: '$2a$12$hashedpassword',
    };

    it('returns JWT on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/email-login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jwt).toBeDefined();
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('returns 401 on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const res = await request(app)
        .post('/api/auth/email-login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('returns 401 for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/email-login')
        .send({ email: 'nobody@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });
  });

  // ─── POST /auth/forgot-password ───
  describe('POST /api/auth/forgot-password', () => {
    it('returns success message regardless of email existence', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/reset link/i);
    });

    it('returns same message for existing email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/reset link/i);
    });
  });

  // ─── GET /auth/me ───
  describe('GET /api/auth/me', () => {
    it('returns user profile with usage for authenticated user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'researcher',
        plan: 'free',
        emailVerified: false,
        createdAt: new Date(),
        subscription: null,
        dashboardAccess: null,
      };

      const jwt = signUserToken('user-1', 'researcher', 'free');

      // Auth middleware lookup, then /me handler lookup
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ ...mockUser }) // auth middleware (include dashboardAccess)
        .mockResolvedValueOnce({ ...mockUser }); // /me handler (include subscription)
      mockPrisma.codingCanvas.count.mockResolvedValue(1);
      mockPrisma.canvasTranscript.count.mockResolvedValue(2);
      mockPrisma.canvasQuestion.count.mockResolvedValue(3);
      mockPrisma.canvasShare.count.mockResolvedValue(0);

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.usage).toEqual({
        canvasCount: 1,
        totalTranscripts: 2,
        totalCodes: 3,
        totalShares: 0,
      });
      expect(res.body.data.authType).toBe('email');
    });
  });

  // ─── PUT /auth/change-password ───
  describe('PUT /api/auth/change-password', () => {
    it('changes password with correct current password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: '$2a$12$hashedpassword',
        plan: 'free',
        role: 'researcher',
        dashboardAccess: null,
      };
      const jwt = signUserToken('user-1', 'researcher', 'free');

      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ ...mockUser }) // auth middleware
        .mockResolvedValueOnce(mockUser); // change-password handler
      mockPrisma.user.update.mockResolvedValue({});
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ currentPassword: 'oldpass123', newPassword: 'newpass1234' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/changed/i);
    });

    it('rejects wrong current password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: '$2a$12$hashedpassword',
        plan: 'free',
        role: 'researcher',
        dashboardAccess: null,
      };
      const jwt = signUserToken('user-1', 'researcher', 'free');

      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser }).mockResolvedValueOnce(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ currentPassword: 'wrongpass', newPassword: 'newpass1234' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/incorrect/i);
    });
  });

  // ─── DELETE /auth/account ───
  describe('DELETE /api/auth/account', () => {
    it('deletes account with correct password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: '$2a$12$hashedpassword',
        plan: 'free',
        role: 'researcher',
        subscription: null,
        stripeCustomerId: null,
        dashboardAccess: null,
      };
      const jwt = signUserToken('user-1', 'researcher', 'free');

      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ ...mockUser }) // auth middleware
        .mockResolvedValueOnce(mockUser); // delete handler
      mockPrisma.user.delete.mockResolvedValue({});
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it('rejects with wrong password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: '$2a$12$hashedpassword',
        plan: 'free',
        role: 'researcher',
        subscription: null,
        stripeCustomerId: null,
        dashboardAccess: null,
      };
      const jwt = signUserToken('user-1', 'researcher', 'free');

      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser }).mockResolvedValueOnce(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/incorrect/i);
    });

    it('rejects without password', async () => {
      const mockUser = {
        id: 'user-1',
        plan: 'free',
        role: 'researcher',
        dashboardAccess: null,
      };
      const jwt = signUserToken('user-1', 'researcher', 'free');

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${jwt}`).send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/password/i);
    });
  });
});
