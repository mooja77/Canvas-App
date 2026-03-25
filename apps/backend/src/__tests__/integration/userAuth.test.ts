import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Set GOOGLE_CLIENT_ID before module load (captured at top-level in userAuthRoutes)
vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
});

// ─── Mock Prisma before any imports that use it ───
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
      upsert: vi.fn(),
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

// Mock email
vi.mock('../../lib/email.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

// Mock google-auth-library
const { mockVerifyIdToken } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
}));

vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: class MockOAuth2Client {
      verifyIdToken = mockVerifyIdToken;
    },
  };
});

import bcrypt from 'bcryptjs';
import request from 'supertest';
import express from 'express';
import { userAuthRoutes } from '../../routes/userAuthRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';
import { sha256 } from '../../utils/hashing.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../lib/email.js';

// Build a minimal Express app with the auth routes
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', userAuthRoutes);
  app.use(errorHandler);
  return app;
}

describe('User auth integration tests', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    // Set GOOGLE_CLIENT_ID for Google OAuth tests
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  });

  // ─── POST /auth/signup ───────────────────────────────────────────────
  describe('POST /api/auth/signup', () => {
    const validPayload = { email: 'newuser@example.com', password: 'securepass123', name: 'Jane Doe' };

    it('creates a new user with correct fields and returns 201 + JWT', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const createdUser = {
        id: 'user-new',
        email: 'newuser@example.com',
        name: 'Jane Doe',
        role: 'researcher',
        plan: 'free',
        emailVerified: false,
        passwordHash: '$2a$12$hashedpassword',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          user: { create: vi.fn().mockResolvedValue(createdUser) },
          dashboardAccess: { create: vi.fn().mockResolvedValue({}) },
        });
      });
      mockPrisma.user.update.mockResolvedValue({});

      const res = await request(app).post('/api/auth/signup').send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jwt).toBeDefined();
      expect(res.body.data.user.email).toBe('newuser@example.com');
      expect(res.body.data.user.name).toBe('Jane Doe');
      expect(res.body.data.user.plan).toBe('free');
    });

    it('rejects duplicate email with 409', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'newuser@example.com' });

      const res = await request(app).post('/api/auth/signup').send(validPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('rejects invalid email without @ symbol', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'notanemail',
        password: 'securepass123',
        name: 'Test',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/email/i);
    });

    it('rejects empty string email', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: '',
        password: 'securepass123',
        name: 'Test',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/email/i);
    });

    it('rejects password shorter than 8 characters', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'test@example.com',
        password: 'short',
        name: 'Test User',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/8 characters/);
    });

    it('rejects missing name', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'test@example.com',
        password: 'securepass123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name/i);
    });

    it('rejects name longer than 100 characters', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'test@example.com',
        password: 'securepass123',
        name: 'A'.repeat(101),
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/name/i);
    });

    it('hashes password with bcrypt before storing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-1', email: 'test@example.com', name: 'Test', role: 'researcher', plan: 'free', emailVerified: false,
            }),
          },
          dashboardAccess: { create: vi.fn().mockResolvedValue({}) },
        });
      });
      mockPrisma.user.update.mockResolvedValue({});

      await request(app).post('/api/auth/signup').send(validPayload);

      expect(bcrypt.hash).toHaveBeenCalledWith('securepass123', 12);
    });

    it('sends a verification email after signup', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-1', email: 'newuser@example.com', name: 'Jane', role: 'researcher', plan: 'free', emailVerified: false,
            }),
          },
          dashboardAccess: { create: vi.fn().mockResolvedValue({}) },
        });
      });
      mockPrisma.user.update.mockResolvedValue({});

      await request(app).post('/api/auth/signup').send(validPayload);

      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        'newuser@example.com',
        expect.stringContaining('/verify-email?token='),
      );
    });

    it('normalizes email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-1', email: 'test@example.com', name: 'Test', role: 'researcher', plan: 'free', emailVerified: false,
            }),
          },
          dashboardAccess: { create: vi.fn().mockResolvedValue({}) },
        });
      });
      mockPrisma.user.update.mockResolvedValue({});

      const res = await request(app).post('/api/auth/signup').send({
        email: 'TEST@Example.COM',
        password: 'securepass123',
        name: 'Test',
      });

      expect(res.status).toBe(201);
      // findUnique should be called with lowercased email
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  // ─── POST /auth/email-login ──────────────────────────────────────────
  describe('POST /api/auth/email-login', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'researcher',
      plan: 'free',
      passwordHash: '$2a$12$hashedpassword',
      emailVerified: true,
    };

    it('returns JWT and user data on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app).post('/api/auth/email-login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jwt).toBeDefined();
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.user.plan).toBe('free');
    });

    it('returns 401 on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const res = await request(app).post('/api/auth/email-login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('returns 401 for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/email-login').send({
        email: 'nobody@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('normalizes email to lowercase before lookup', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      await request(app).post('/api/auth/email-login').send({
        email: 'TEST@Example.COM',
        password: 'password123',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('syncs plan from subscription status on login', async () => {
      const proUser = { ...mockUser, plan: 'pro' };
      mockPrisma.user.findUnique.mockResolvedValue(proUser);
      mockPrisma.subscription.findUnique.mockResolvedValue(null); // No active subscription
      mockPrisma.user.update.mockResolvedValue({});
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app).post('/api/auth/email-login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      // Plan should be downgraded to free since no active subscription
      expect(res.body.data.user.plan).toBe('free');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { plan: 'free' },
      });
    });
  });

  // ─── POST /auth/forgot-password ─────────────────────────────────────
  describe('POST /api/auth/forgot-password', () => {
    it('returns success and sends reset email for valid existing email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
      mockPrisma.user.update.mockResolvedValue({});

      const res = await request(app).post('/api/auth/forgot-password').send({
        email: 'test@example.com',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/reset link/i);
      expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('/reset-password?token='),
      );
    });

    it('returns 200 for unknown email to prevent enumeration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/forgot-password').send({
        email: 'unknown@example.com',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/reset link/i);
      // Should NOT send email for non-existent account
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  // ─── POST /auth/reset-password ──────────────────────────────────────
  describe('POST /api/auth/reset-password', () => {
    it('resets password with valid token', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        resetTokenHash: 'sha256hash', // matches our mocked sha256
        resetTokenExpiry: futureDate,
      });
      mockPrisma.user.update.mockResolvedValue({});
      (sha256 as ReturnType<typeof vi.fn>).mockReturnValue('sha256hash');

      const res = await request(app).post('/api/auth/reset-password').send({
        email: 'test@example.com',
        token: 'valid-reset-token',
        newPassword: 'newpassword123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/reset successfully/i);
      // Should hash the new password
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
    });

    it('rejects expired token', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        resetTokenHash: 'sha256hash',
        resetTokenExpiry: pastDate,
      });
      (sha256 as ReturnType<typeof vi.fn>).mockReturnValue('sha256hash');

      const res = await request(app).post('/api/auth/reset-password').send({
        email: 'test@example.com',
        token: 'expired-token',
        newPassword: 'newpassword123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });

    it('rejects invalid token (hash mismatch)', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        resetTokenHash: 'different-hash',
        resetTokenExpiry: futureDate,
      });
      (sha256 as ReturnType<typeof vi.fn>).mockReturnValue('sha256hash');

      const res = await request(app).post('/api/auth/reset-password').send({
        email: 'test@example.com',
        token: 'wrong-token',
        newPassword: 'newpassword123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });

    it('rejects short new password', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        email: 'test@example.com',
        token: 'some-token',
        newPassword: 'short',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/8 characters/);
    });

    it('rejects missing required fields', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        email: 'test@example.com',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });
  });

  // ─── POST /auth/verify-email ────────────────────────────────────────
  describe('POST /api/auth/verify-email', () => {
    it('verifies email with valid token', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        resetTokenHash: 'sha256hash',
        resetTokenExpiry: futureDate,
      });
      mockPrisma.user.update.mockResolvedValue({});
      (sha256 as ReturnType<typeof vi.fn>).mockReturnValue('sha256hash');

      const res = await request(app).post('/api/auth/verify-email').send({
        email: 'test@example.com',
        token: 'valid-verify-token',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/verified successfully/i);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerified: true, resetTokenHash: null, resetTokenExpiry: null },
      });
    });

    it('rejects expired or invalid verification token', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        resetTokenHash: 'sha256hash',
        resetTokenExpiry: pastDate,
      });
      (sha256 as ReturnType<typeof vi.fn>).mockReturnValue('sha256hash');

      const res = await request(app).post('/api/auth/verify-email').send({
        email: 'test@example.com',
        token: 'expired-token',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });

    it('returns success for already verified email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
      });

      const res = await request(app).post('/api/auth/verify-email').send({
        email: 'test@example.com',
        token: 'any-token',
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/already verified/i);
    });
  });

  // ─── POST /auth/google ──────────────────────────────────────────────
  describe('POST /api/auth/google', () => {
    it('logs in existing user with valid Google credential', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'google@example.com',
          name: 'Google User',
          sub: 'google-sub-123',
          email_verified: true,
        }),
      });
      const existingUser = {
        id: 'user-g1',
        email: 'google@example.com',
        name: 'Google User',
        role: 'researcher',
        plan: 'free',
        emailVerified: true,
      };
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/google').send({
        credential: 'valid-google-id-token',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jwt).toBeDefined();
      expect(res.body.data.user.email).toBe('google@example.com');
    });

    it('rejects invalid Google credential', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const res = await request(app).post('/api/auth/google').send({
        credential: 'invalid-token',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid google credential/i);
    });

    it('rejects missing credential field', async () => {
      const res = await request(app).post('/api/auth/google').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/credential is required/i);
    });
  });

  // ─── PUT /auth/profile ──────────────────────────────────────────────
  describe('PUT /api/auth/profile', () => {
    it('updates user name', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Old Name',
        plan: 'free',
        role: 'researcher',
        dashboardAccess: null,
      };
      const jwt = signUserToken('user-1', 'researcher', 'free');

      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser }); // auth middleware
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'New Name',
        emailVerified: true,
      });

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Name');
    });

    it('rejects empty update body', async () => {
      const jwt = signUserToken('user-1', 'researcher', 'free');
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        plan: 'free',
        role: 'researcher',
        dashboardAccess: null,
      });

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${jwt}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no fields/i);
    });
  });

  // ─── DELETE /auth/account ───────────────────────────────────────────
  describe('DELETE /api/auth/account', () => {
    it('deletes account with correct password confirmation', async () => {
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
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('rejects deletion with wrong password', async () => {
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
        .mockResolvedValueOnce({ ...mockUser })
        .mockResolvedValueOnce(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/incorrect/i);
    });

    it('rejects deletion without password', async () => {
      const jwt = signUserToken('user-1', 'researcher', 'free');
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        plan: 'free',
        role: 'researcher',
        dashboardAccess: null,
      });

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/password/i);
    });
  });

  // ─── GET /auth/me ───────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });
  });
});
