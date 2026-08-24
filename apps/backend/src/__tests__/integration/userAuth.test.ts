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
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    codingCanvas: { count: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    canvasTranscript: { count: vi.fn() },
    canvasQuestion: { count: vi.fn() },
    canvasShare: { count: vi.fn() },
    auditLog: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    notification: { findMany: vi.fn().mockResolvedValue([]) },
    reportSchedule: { findMany: vi.fn().mockResolvedValue([]) },
    calendarEvent: { findMany: vi.fn().mockResolvedValue([]) },
    trainingAttempt: { findMany: vi.fn().mockResolvedValue([]) },
    researchRepository: { findMany: vi.fn().mockResolvedValue([]) },
    canvasTemplate: { findMany: vi.fn().mockResolvedValue([]) },
    emailPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
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

vi.mock('../../utils/fileCleanup.js', () => ({
  deleteStoredUploads: vi.fn().mockResolvedValue(0),
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
import { signUserToken, signResearcherToken } from '../../utils/jwt.js';
import { sha256 } from '../../utils/hashing.js';
import { logAudit } from '../../middleware/auditLog.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../lib/email.js';
import { getStripe } from '../../lib/stripe.js';

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
    mockPrisma.codingCanvas.findMany.mockResolvedValue([]);
    app = createApp();
    // Set GOOGLE_CLIENT_ID for Google OAuth tests
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  });

  // ─── POST /auth/signup ───────────────────────────────────────────────
  describe('POST /api/auth/signup', () => {
    const validPayload = { email: 'newuser@example.com', password: 'securepass123', name: 'Jane Doe' };

    it('creates a new user and returns an httpOnly session cookie', async () => {
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
      expect(res.body.data.jwt).toBeUndefined();
      expect(res.headers['set-cookie']?.[0]).toContain('jwt=');
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
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
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
              id: 'user-1',
              email: 'test@example.com',
              name: 'Test',
              role: 'researcher',
              plan: 'free',
              emailVerified: false,
            }),
          },
          dashboardAccess: { create: vi.fn().mockResolvedValue({}) },
        });
      });
      mockPrisma.user.update.mockResolvedValue({});

      await request(app).post('/api/auth/signup').send(validPayload);

      expect(bcrypt.hash).toHaveBeenCalledWith('securepass123', 12);
    });

    // Audit SB-12: "Signup collapses under modest concurrency: 20 simultaneous
    // requests, 20 HTTP 500s."
    //
    // Root cause, measured against the local Postgres rather than guessed: the
    // DashboardAccess access code was bcrypt-hashed (12 rounds, ~250ms of CPU
    // on one of libuv's 4 worker threads) BETWEEN `tx.user.create` and
    // `tx.dashboardAccess.create`. Under 20 concurrent signups that wait
    // exceeded Prisma's 5s interactive-transaction budget and every request
    // died with `P2028 Transaction already closed ... the timeout for this
    // transaction was 5000 ms, however 5093 ms passed`, rendered as a 500.
    // Verified end to end on the running stack: 20/20 500s before, 20/20 201s
    // after; the same workload driven straight at Postgres gave 0/20 then
    // 20/20, and 50/50 with the hashing moved out.
    it('does no bcrypt work inside the signup transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      let hashCallsAtTxStart = -1;
      let hashCallsAtTxEnd = -1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        hashCallsAtTxStart = (bcrypt.hash as ReturnType<typeof vi.fn>).mock.calls.length;
        const result = await fn({
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: 'newuser@example.com',
              name: 'Jane Doe',
              role: 'researcher',
              plan: 'free',
              emailVerified: false,
            }),
          },
          dashboardAccess: { create: vi.fn().mockResolvedValue({}) },
        });
        hashCallsAtTxEnd = (bcrypt.hash as ReturnType<typeof vi.fn>).mock.calls.length;
        return result;
      });

      const res = await request(app).post('/api/auth/signup').send(validPayload);

      expect(res.status).toBe(201);
      // Both hashes (password + access code) are already done when the
      // transaction opens, and none is issued while it is open.
      expect(hashCallsAtTxStart).toBe(2);
      expect(hashCallsAtTxEnd).toBe(hashCallsAtTxStart);
    });

    it('does no bcrypt work inside the Google-signup transaction either', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'googler@example.com',
          email_verified: true,
          name: 'Googler',
          sub: 'google-sub-1',
        }),
      });
      let hashCallsAtTxStart = -1;
      let hashCallsAtTxEnd = -1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        hashCallsAtTxStart = (bcrypt.hash as ReturnType<typeof vi.fn>).mock.calls.length;
        const result = await fn({
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-g1',
              email: 'googler@example.com',
              name: 'Googler',
              role: 'researcher',
              plan: 'free',
              legacyPricing: false,
              emailVerified: true,
            }),
          },
          dashboardAccess: { create: vi.fn().mockResolvedValue({}) },
        });
        hashCallsAtTxEnd = (bcrypt.hash as ReturnType<typeof vi.fn>).mock.calls.length;
        return result;
      });

      const res = await request(app).post('/api/auth/google').send({ credential: 'valid-credential' });

      expect(res.status).toBe(200);
      expect(hashCallsAtTxStart).toBe(1);
      expect(hashCallsAtTxEnd).toBe(hashCallsAtTxStart);
    });

    it('sends a verification email after signup', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: 'newuser@example.com',
              name: 'Jane',
              role: 'researcher',
              plan: 'free',
              emailVerified: false,
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
        expect.stringContaining('/verify-email#token='),
      );
    });

    it('normalizes email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'user-1',
              email: 'test@example.com',
              name: 'Test',
              role: 'researcher',
              plan: 'free',
              emailVerified: false,
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

    it('returns user data and an httpOnly session cookie on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app).post('/api/auth/email-login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jwt).toBeUndefined();
      expect(res.headers['set-cookie']?.[0]).toContain('jwt=');
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

    it('downgrades on login when the subscription row says the subscription lapsed', async () => {
      const proUser = { ...mockUser, plan: 'pro' };
      mockPrisma.user.findUnique.mockResolvedValue(proUser);
      mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'canceled' });
      mockPrisma.user.update.mockResolvedValue({});
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app).post('/api/auth/email-login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.plan).toBe('free');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { plan: 'free' },
      });
    });

    // Audit §3.2 item 3: "Login silently downgrades a paid plan."
    // The old rule was "no ACTIVE subscription => free", which also caught every
    // account whose paid tier was granted without a Stripe subscription at all
    // (comped, institutional, set by hand). Absence of a row is not evidence of
    // a lapse, and the rewrite left no trace anywhere.
    it('does NOT downgrade a paid plan that has no subscription row at all', async () => {
      const compedTeamUser = { ...mockUser, plan: 'team' };
      mockPrisma.user.findUnique.mockResolvedValue(compedTeamUser);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app).post('/api/auth/email-login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.plan).toBe('team');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('records an audit entry when a login downgrades the plan', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, plan: 'pro' });
      mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'past_due' });
      mockPrisma.user.update.mockResolvedValue({});
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      await request(app).post('/api/auth/email-login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.plan_downgraded',
          actorId: 'user-1',
          meta: expect.stringContaining('"from":"pro"'),
        }),
      );
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
        expect.stringContaining('/reset-password#token='),
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
        verificationTokenHash: 'sha256hash',
        verificationTokenExpiry: futureDate,
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
        data: { emailVerified: true, verificationTokenHash: null, verificationTokenExpiry: null },
      });
    });

    it('rejects expired or invalid verification token', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: false,
        verificationTokenHash: 'sha256hash',
        verificationTokenExpiry: pastDate,
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
      expect(res.body.data.jwt).toBeUndefined();
      expect(res.headers['set-cookie']?.[0]).toContain('jwt=');
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
        email: 'test@example.com',
        passwordHash: '$2a$12$hashedpassword',
        plan: 'free',
        role: 'researcher',
        dashboardAccess: null,
      });

      const res = await request(app).put('/api/auth/profile').set('Authorization', `Bearer ${jwt}`).send({});

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

      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser }).mockResolvedValueOnce(mockUser);
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
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'test@example.com',
          passwordHash: '$2a$12$hashedpassword',
          plan: 'free',
          role: 'researcher',
          dashboardAccess: null,
        })
        .mockResolvedValue({
          id: 'user-1',
          email: 'test@example.com',
          passwordHash: '$2a$12$hashedpassword',
          plan: 'free',
          role: 'researcher',
          dashboardAccess: null,
        });

      const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${jwt}`).send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/password/i);
    });

    it('cancels the subscription even when the Stripe customer id is missing', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: '$2a$12$hashedpassword',
        plan: 'pro',
        role: 'researcher',
        subscription: { stripeSubscriptionId: 'sub_123' },
        stripeCustomerId: null,
        dashboardAccess: null,
      };
      const jwt = signUserToken('user-1', 'researcher', 'pro');
      const cancel = vi.fn().mockResolvedValue({});
      (getStripe as ReturnType<typeof vi.fn>).mockReturnValue({ subscriptions: { cancel } });
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser }).mockResolvedValueOnce(mockUser);
      mockPrisma.user.delete.mockResolvedValue({});
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ password: 'password123' });

      expect(res.status).toBe(200);
      expect(cancel).toHaveBeenCalledWith('sub_123');
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    // Canvases owned only through a legacy access code are NOT cascaded by
    // account deletion - DashboardAccess.user is ON DELETE SET NULL. They are
    // research data, so they are kept unless the user explicitly asks for them.
    const legacyDeletionFixture = () => {
      const localUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: '$2a$12$hashedpassword',
        plan: 'free',
        role: 'researcher',
        subscription: null,
        stripeCustomerId: null,
        dashboardAccess: null,
      };
      mockPrisma.user.findUnique.mockResolvedValue(localUser);
      mockPrisma.codingCanvas.findMany.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.userId === null ? [{ id: 'legacy-1' }, { id: 'legacy-2' }] : [{ id: 'direct-1' }]),
      );
      mockPrisma.user.delete.mockResolvedValue({ id: 'user-1' });
      return signUserToken('user-1', 'researcher', 'free');
    };

    it('DELETE /api/auth/account keeps legacy access-code canvases by default', async () => {
      const jwt = legacyDeletionFixture();
      mockPrisma.codingCanvas.deleteMany.mockResolvedValue({ count: 0 });

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ password: 'correct-password' });

      expect(res.status).toBe(200);
      expect(res.body.legacyCanvasesRetained).toBe(2);
      expect(mockPrisma.codingCanvas.deleteMany).not.toHaveBeenCalled();
    });

    it('DELETE /api/auth/account removes legacy canvases when explicitly requested', async () => {
      const jwt = legacyDeletionFixture();
      mockPrisma.codingCanvas.deleteMany.mockResolvedValue({ count: 2 });

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ password: 'correct-password', deleteLegacyCanvases: true });

      expect(res.status).toBe(200);
      expect(res.body.legacyCanvasesDeleted).toBe(2);
      expect(mockPrisma.codingCanvas.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['legacy-1', 'legacy-2'] } },
      });
    });

    it('keeps the account when Stripe subscription cancellation fails', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: '$2a$12$hashedpassword',
        plan: 'pro',
        role: 'researcher',
        subscription: { stripeSubscriptionId: 'sub_123' },
        stripeCustomerId: null,
        dashboardAccess: null,
      };
      const jwt = signUserToken('user-1', 'researcher', 'pro');
      const cancel = vi.fn().mockRejectedValue(new Error('Stripe unavailable'));
      (getStripe as ReturnType<typeof vi.fn>).mockReturnValue({ subscriptions: { cancel } });
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...mockUser }).mockResolvedValueOnce(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ password: 'password123' });

      expect(res.status).toBe(500);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });
  });

  // ─── GET /auth/me ───────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    // The usage panel is what the user checks when the app tells them they are
    // at their cap. If it counts trashed canvases while the cap check does not,
    // the two disagree and the panel is the one that looks broken.
    it('reports usage over LIVE resources only, matching the cap checks', async () => {
      const jwt = signUserToken('user-usage-1', 'researcher', 'free');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-usage-1',
        email: 'usage@example.com',
        name: 'Usage Tester',
        role: 'researcher',
        plan: 'free',
        emailVerified: true,
        trialEndsAt: null,
        legacyPricing: false,
        createdAt: new Date(),
        passwordHash: 'x',
        subscription: null,
        dashboardAccess: null,
      });
      // 1 live canvas, 2 in the trash.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const liveOnly = (args: any) => Promise.resolve(args?.where?.deletedAt === null ? 1 : 3);
      mockPrisma.codingCanvas.count.mockImplementation(liveOnly);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const viaLiveCanvas = (args: any) => Promise.resolve(args?.where?.canvas?.deletedAt === null ? 4 : 9);
      mockPrisma.canvasTranscript.count.mockImplementation(viaLiveCanvas);
      mockPrisma.canvasQuestion.count.mockImplementation(viaLiveCanvas);
      mockPrisma.canvasShare.count.mockImplementation(viaLiveCanvas);

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(res.body.data.usage).toEqual({
        canvasCount: 1,
        totalTranscripts: 4,
        totalCodes: 4,
        totalShares: 4,
        // Count of access-code-owned canvases that survive account deletion;
        // the delete dialog needs it to offer the choice.
        legacyCanvasCount: expect.any(Number),
      });
    });
  });

  // ─── GET /auth/export ───────────────────────────────────────────────
  // Audit SB-9: the page promises "a portable JSON archive of your account,
  // canvases, research content, and audit history" and delivered neither the
  // reflexivity journal nor, for a linked legacy account, any audit history.
  describe('GET /api/auth/export', () => {
    const exportUser = {
      id: 'user-exp-1',
      email: 'exporter@example.com',
      name: 'Exporter',
      role: 'researcher',
      plan: 'pro',
      emailVerified: true,
      legacyPricing: false,
      trialEndsAt: null,
      createdAt: new Date(),
      passwordHash: 'x',
      subscription: null,
      dashboardAccess: null,
    };

    it('includes the reflexivity journal entries on every canvas', async () => {
      const jwt = signUserToken(exportUser.id, 'researcher', 'pro');
      mockPrisma.user.findUnique.mockResolvedValue(exportUser);
      mockPrisma.dashboardAccess.findUnique.mockResolvedValue(null);
      mockPrisma.codingCanvas.findMany.mockResolvedValue([
        { id: 'canvas-1', journalEntries: [{ id: 'j1', content: 'watch my assumption about mentoring' }] },
      ]);

      const res = await request(app).get('/api/auth/export').set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(mockPrisma.codingCanvas.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: expect.objectContaining({ journalEntries: true }) }),
      );
      expect(res.text).toContain('watch my assumption about mentoring');
    });

    it('includes audit rows keyed to the linked legacy access code, not just the user id', async () => {
      const jwt = signUserToken(exportUser.id, 'researcher', 'pro');
      mockPrisma.user.findUnique.mockResolvedValue(exportUser);
      mockPrisma.dashboardAccess.findUnique.mockResolvedValue({
        id: 'da-exp-1',
        name: 'Legacy Researcher',
        role: 'researcher',
        createdAt: new Date(),
        expiresAt: new Date('2099-12-31'),
      });
      mockPrisma.codingCanvas.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1', action: 'auth.success', actorId: 'da-exp-1' }]);

      const res = await request(app).get('/api/auth/export').set('Authorization', `Bearer ${jwt}`);

      expect(res.status).toBe(200);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { actorId: { in: ['user-exp-1', 'da-exp-1'] } } }),
      );
      expect(JSON.parse(res.text).auditLogs).toHaveLength(1);
    });

    it('includes the user-owned research repositories and templates', async () => {
      const jwt = signUserToken(exportUser.id, 'researcher', 'pro');
      mockPrisma.user.findUnique.mockResolvedValue(exportUser);
      mockPrisma.dashboardAccess.findUnique.mockResolvedValue(null);
      mockPrisma.codingCanvas.findMany.mockResolvedValue([]);
      mockPrisma.researchRepository.findMany.mockResolvedValue([{ id: 'repo-1', name: 'Field notes', insights: [] }]);
      mockPrisma.canvasTemplate.findMany.mockResolvedValue([{ id: 'tpl-1', name: 'My IPA template' }]);

      const res = await request(app).get('/api/auth/export').set('Authorization', `Bearer ${jwt}`);

      const archive = JSON.parse(res.text);
      expect(archive.researchRepositories).toHaveLength(1);
      expect(archive.canvasTemplates).toHaveLength(1);
    });

    // Audit §3.3 item 3: an access-code session got a flat
    // 403 "Email account required" here, so this class of user had no way to
    // obtain a copy of their own research data.
    it('serves an archive to an access-code-only session', async () => {
      const legacyJwt = signResearcherToken('da-legacy-1', 'researcher');
      mockPrisma.dashboardAccess.findFirst.mockResolvedValue({
        id: 'da-legacy-1',
        name: 'Legacy Only',
        role: 'researcher',
        expiresAt: new Date('2099-12-31'),
      });
      mockPrisma.dashboardAccess.findUnique.mockResolvedValue({
        id: 'da-legacy-1',
        name: 'Legacy Only',
        role: 'researcher',
        createdAt: new Date(),
        expiresAt: new Date('2099-12-31'),
      });
      mockPrisma.codingCanvas.findMany.mockResolvedValue([{ id: 'canvas-legacy-1', journalEntries: [] }]);
      mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1', action: 'auth.success' }]);

      const res = await request(app).get('/api/auth/export').set('Authorization', `Bearer ${legacyJwt}`);

      expect(res.status).toBe(200);
      const archive = JSON.parse(res.text);
      expect(archive.authType).toBe('legacy');
      expect(archive.canvases).toHaveLength(1);
      expect(archive.auditLogs).toHaveLength(1);
    });
  });

  // ─── Deletion leaves no live credential behind ──────────────────────
  // Audit §3.3 item 1: after DELETE /auth/account the DashboardAccess row
  // survived with the user's real name and a working accessCodeHash -
  // POST /auth with the original code still minted a session.
  describe('DELETE /api/auth/account — linked access code', () => {
    const deletableUser = {
      id: 'user-del-1',
      email: 'deleteme@example.com',
      passwordHash: '$2a$12$hashedpassword',
      plan: 'free',
      role: 'researcher',
      subscription: null,
      stripeCustomerId: null,
      dashboardAccess: null,
    };

    function arrangeDeletion(legacyCanvases: { id: string }[]) {
      mockPrisma.user.findUnique.mockResolvedValue(deletableUser);
      mockPrisma.codingCanvas.findMany.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.userId === null ? legacyCanvases : [{ id: 'direct-1' }]),
      );
      mockPrisma.codingCanvas.deleteMany.mockResolvedValue({ count: legacyCanvases.length });
      mockPrisma.user.delete.mockResolvedValue({ id: deletableUser.id });
      mockPrisma.dashboardAccess.findUnique.mockResolvedValue({ id: 'da-del-1' });
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      return signUserToken(deletableUser.id, 'researcher', 'free');
    }

    it('revokes the access code when nothing is retained', async () => {
      const jwt = arrangeDeletion([]);

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.accessCodeRevoked).toBe(true);
      expect(mockPrisma.dashboardAccess.delete).toHaveBeenCalledWith({ where: { id: 'da-del-1' } });
    });

    it('revokes the access code when the legacy canvases were deleted too', async () => {
      const jwt = arrangeDeletion([{ id: 'legacy-1' }]);

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ password: 'password123', deleteLegacyCanvases: true });

      expect(res.status).toBe(200);
      expect(res.body.accessCodeRevoked).toBe(true);
      expect(mockPrisma.dashboardAccess.delete).toHaveBeenCalledWith({ where: { id: 'da-del-1' } });
    });

    // The credential has to survive here — it is the only way back to the
    // canvases the user asked to keep — but the person's name must not.
    it('keeps the code but scrubs the name when legacy canvases are retained', async () => {
      const jwt = arrangeDeletion([{ id: 'legacy-1' }, { id: 'legacy-2' }]);

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.legacyCanvasesRetained).toBe(2);
      expect(res.body.accessCodeRevoked).toBe(false);
      expect(mockPrisma.dashboardAccess.delete).not.toHaveBeenCalled();
      expect(mockPrisma.dashboardAccess.update).toHaveBeenCalledWith({
        where: { id: 'da-del-1' },
        data: { name: 'Deleted account' },
      });
    });
  });

  // ─── Access-code-only erasure ───────────────────────────────────────
  // Audit §3.3 item 3: DELETE /auth/account answered 403 for these sessions,
  // so a legacy user could not erase their own participant data at all.
  describe('DELETE /api/auth/account — access-code session', () => {
    function arrangeLegacySession() {
      mockPrisma.dashboardAccess.findFirst.mockResolvedValue({
        id: 'da-legacy-2',
        name: 'Legacy Only',
        role: 'researcher',
        expiresAt: new Date('2099-12-31'),
      });
      mockPrisma.dashboardAccess.findUnique.mockResolvedValue({ id: 'da-legacy-2', userId: null });
      mockPrisma.codingCanvas.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      mockPrisma.dashboardAccess.delete.mockResolvedValue({ id: 'da-legacy-2' });
      return signResearcherToken('da-legacy-2', 'researcher');
    }

    it('erases the access-code account and its canvases', async () => {
      const jwt = arrangeLegacySession();

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ confirmation: 'DELETE' });

      expect(res.status).toBe(200);
      expect(res.body.canvasesDeleted).toBe(2);
      expect(res.body.accessCodeRevoked).toBe(true);
      expect(mockPrisma.dashboardAccess.delete).toHaveBeenCalledWith({ where: { id: 'da-legacy-2' } });
    });

    it('requires the typed confirmation', async () => {
      const jwt = arrangeLegacySession();

      const res = await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${jwt}`).send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/DELETE/);
      expect(mockPrisma.dashboardAccess.delete).not.toHaveBeenCalled();
    });

    it('refuses when the access code belongs to an email account', async () => {
      const jwt = arrangeLegacySession();
      mockPrisma.dashboardAccess.findUnique.mockResolvedValue({ id: 'da-legacy-2', userId: 'user-owner' });

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ confirmation: 'DELETE' });

      expect(res.status).toBe(409);
      expect(mockPrisma.dashboardAccess.delete).not.toHaveBeenCalled();
    });
  });
});
