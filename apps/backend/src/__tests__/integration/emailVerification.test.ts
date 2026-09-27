import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { randomBytes, createHash } from 'crypto';

// Email verification that asks before it acts (routes/emailVerificationRoutes.ts).
// Prisma is mocked; the point here is which writes each request makes. The
// same flows run against a real database in e2e/fullstack/09-verify-email-confirm.spec.ts.

const { mockPrisma, tx } = vi.hoisted(() => {
  const tx = {
    user: { update: vi.fn(), updateMany: vi.fn() },
    dashboardAccess: { updateMany: vi.fn() },
    canvasCollaborator: { deleteMany: vi.fn() },
    canvasShare: { deleteMany: vi.fn() },
    teamMember: { deleteMany: vi.fn() },
    userAiConfig: { deleteMany: vi.fn() },
  };
  const mockPrisma = {
    user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    emailPreference: { findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { mockPrisma, tx };
});

vi.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2a$12$fresh-access-code-hash'), compare: vi.fn() },
}));
vi.mock('../../middleware/authLimiter.js', () => ({
  authLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../middleware/auditLog.js', () => ({ logAudit: vi.fn() }));
vi.mock('../../lib/email.js', () => ({ sendPasswordResetEmail: vi.fn().mockResolvedValue(true) }));
vi.mock('../../lib/lifecycleEmail.js', () => ({
  isLifecycleSendingEnabledFor: vi.fn().mockReturnValue(false),
  lifecycleTemplate: vi.fn(),
  sendLifecycleEmail: vi.fn(),
}));
vi.mock('../../utils/teamBilling.js', () => ({ syncTeamSeatQuantity: vi.fn().mockResolvedValue(undefined) }));

import bcrypt from 'bcryptjs';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { emailVerificationRoutes } from '../../routes/emailVerificationRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { signUserToken } from '../../utils/jwt.js';
import { logAudit } from '../../middleware/auditLog.js';
import { sendPasswordResetEmail } from '../../lib/email.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', emailVerificationRoutes);
  app.use(errorHandler);
  return app;
}

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
// Generated per run: no token-shaped literal lives in the repository.
const freshToken = () => randomBytes(32).toString('hex');

function pendingUser(token: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-pending',
    email: 'owner@example.com',
    name: 'Chosen at sign-up',
    role: 'researcher',
    plan: 'free',
    emailVerified: false,
    passwordHash: '$2a$12$registrants-password',
    createdAt: new Date('2026-09-27T09:15:00Z'),
    signupDevice: 'Firefox on Linux',
    sessionsInvalidAt: null,
    verificationTokenHash: sha(token),
    verificationTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  };
}

/** Every mocked write the routes could make. */
function writeCalls(): number {
  return (
    mockPrisma.user.update.mock.calls.length +
    mockPrisma.user.updateMany.mock.calls.length +
    mockPrisma.emailPreference.updateMany.mock.calls.length +
    mockPrisma.$transaction.mock.calls.length
  );
}

describe('email verification asks before it acts', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockPrisma.emailPreference.findUnique.mockResolvedValue(null);
    mockPrisma.emailPreference.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue({});
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.user.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 'user-pending',
      ...args.data,
    }));
    tx.dashboardAccess.updateMany.mockResolvedValue({ count: 1 });
    tx.canvasCollaborator.deleteMany.mockResolvedValue({ count: 1 });
    tx.canvasShare.deleteMany.mockResolvedValue({ count: 2 });
    tx.teamMember.deleteMany.mockResolvedValue({ count: 0 });
    tx.userAiConfig.deleteMany.mockResolvedValue({ count: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
  });

  describe('prefetch safety: nothing but a POST from the page changes state', () => {
    it('GET on the verification endpoints (what a link scanner does) is not served and writes nothing', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      const q = `?token=${token}&email=owner%40example.com`;
      for (const path of ['/api/auth/verify-email', '/api/auth/verify-email/details']) {
        const res = await request(app).get(path + q);
        expect(res.status).toBe(404);
        const head = await request(app).head(path + q);
        expect(head.status).toBe(404);
      }
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(writeCalls()).toBe(0);
    });

    it('the details lookup the page makes on load returns what it shows and writes nothing', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      const res = await request(app).post('/api/auth/verify-email/details').send({ email: 'Owner@Example.com', token });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        email: 'owner@example.com',
        signedUpAt: '2026-09-27T09:15:00.000Z',
        signupDevice: 'Firefox on Linux',
        signedInHere: false,
        hasPassword: true,
      });
      // Called repeatedly (a scanner rendering the page, a reload): still nothing.
      await request(app).post('/api/auth/verify-email/details').send({ email: 'owner@example.com', token });
      expect(writeCalls()).toBe(0);
      expect(logAudit).not.toHaveBeenCalled();
    });

    it('details gives one generic answer for a wrong token, an unknown address and a verified account', async () => {
      const token = freshToken();
      const answers: string[] = [];
      mockPrisma.user.findUnique.mockResolvedValueOnce(pendingUser(token));
      answers.push(
        (
          await request(app)
            .post('/api/auth/verify-email/details')
            .send({ email: 'owner@example.com', token: freshToken() })
        ).body.error,
      );
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      answers.push(
        (await request(app).post('/api/auth/verify-email/details').send({ email: 'nobody@example.com', token })).body
          .error,
      );
      mockPrisma.user.findUnique.mockResolvedValueOnce(pendingUser(token, { emailVerified: true }));
      answers.push(
        (await request(app).post('/api/auth/verify-email/details').send({ email: 'owner@example.com', token })).body
          .error,
      );
      expect(new Set(answers).size).toBe(1);
      expect(answers[0]).toMatch(/already been used or has expired/);
    });

    it('regression: the old one-click request (email + token, no answer) no longer verifies', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      const res = await request(app).post('/api/auth/verify-email').send({ email: 'owner@example.com', token });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('CONFIRMATION_REQUIRED');
      expect(writeCalls()).toBe(0);
    });
  });

  describe('"Yes, I created it"', () => {
    it('verifies at once when this browser holds a live session for the same account', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      const cookie = `jwt=${signUserToken('user-pending', 'researcher', 'free')}`;
      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Cookie', cookie)
        .send({ email: 'owner@example.com', token, decision: 'yes' });
      expect(res.status).toBe(200);
      expect(res.body.data.outcome).toBe('verified');
      const call = mockPrisma.user.updateMany.mock.calls[0][0];
      // Compare-and-set on the exact token: the link acts at most once.
      expect(call.where).toEqual({ id: 'user-pending', emailVerified: false, verificationTokenHash: sha(token) });
      expect(call.data).toMatchObject({ emailVerified: true, verificationTokenHash: null });
      expect(call.data.sessionsInvalidAt).toBeUndefined();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('regression: a victim who presses Yes by mistake cannot verify the account someone else registered', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      // No session here, no password: the victim does not know the attacker's password.
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'owner@example.com', token, decision: 'yes' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PASSWORD_REQUIRED');
      // A guess is refused too, and the link keeps working for the other choices.
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const guess = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'owner@example.com', token, decision: 'yes', password: 'a-guess' });
      expect(guess.status).toBe(400);
      expect(guess.body.code).toBe('PASSWORD_INCORRECT');
      expect(writeCalls()).toBe(0);
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.email_verification_password_failed' }),
      );
    });

    it('a session for a DIFFERENT account in this browser does not count', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Cookie', `jwt=${signUserToken('someone-else', 'researcher', 'free')}`)
        .send({ email: 'owner@example.com', token, decision: 'yes' });
      expect(res.body.code).toBe('PASSWORD_REQUIRED');
      expect(writeCalls()).toBe(0);
    });

    it('a session revoked before now (sessionsInvalidAt) does not count', async () => {
      const token = freshToken();
      const cookie = `jwt=${signUserToken('user-pending', 'researcher', 'free')}`;
      mockPrisma.user.findUnique.mockResolvedValue(
        pendingUser(token, { sessionsInvalidAt: new Date(Date.now() + 1000) }),
      );
      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Cookie', cookie)
        .send({ email: 'owner@example.com', token, decision: 'yes' });
      expect(res.body.code).toBe('PASSWORD_REQUIRED');
    });

    it('with the right password: verifies and signs this browser in', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'owner@example.com', token, decision: 'yes', password: 'the-real-one' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ outcome: 'verified', signedIn: true });
      expect(String(res.headers['set-cookie'])).toMatch(/jwt=/);
      expect(mockPrisma.user.updateMany).toHaveBeenCalledTimes(1);
    });

    it('an account with no password is verified and every existing session ended', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token, { passwordHash: '' }));
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'owner@example.com', token, decision: 'yes' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ outcome: 'verified', signedIn: false });
      expect(mockPrisma.user.updateMany.mock.calls[0][0].data.sessionsInvalidAt).toBeInstanceOf(Date);
    });
  });

  describe('single use', () => {
    it('a token already consumed by a concurrent request is refused (compare-and-set lost)', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Cookie', `jwt=${signUserToken('user-pending', 'researcher', 'free')}`)
        .send({ email: 'owner@example.com', token, decision: 'yes' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already been used/);
    });

    it('replaying a link after it was used is refused for every decision', async () => {
      const token = freshToken();
      // After any decision the token hash is cleared (and, for yes/no, the address is verified).
      mockPrisma.user.findUnique.mockResolvedValue(
        pendingUser(token, { verificationTokenHash: null, verificationTokenExpiry: null }),
      );
      for (const decision of ['yes', 'no', 'reset']) {
        const res = await request(app)
          .post('/api/auth/verify-email')
          .set('Cookie', `jwt=${signUserToken('user-pending', 'researcher', 'free')}`)
          .send({ email: 'owner@example.com', token, decision });
        expect(res.status).toBe(400);
      }
      expect(writeCalls()).toBe(0);
    });

    it('an expired link is refused', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(
        pendingUser(token, { verificationTokenExpiry: new Date(Date.now() - 1000) }),
      );
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'owner@example.com', token, decision: 'no' });
      expect(res.status).toBe(400);
      expect(writeCalls()).toBe(0);
    });

    it('"No" consumes the token inside the claim transaction; losing that race rolls the claim back', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      tx.user.updateMany.mockResolvedValue({ count: 0 });
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'owner@example.com', token, decision: 'no' });
      expect(res.status).toBe(400);
      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-pending', emailVerified: false, verificationTokenHash: sha(token) },
        data: { verificationTokenHash: null, verificationTokenExpiry: null },
      });
      // Nothing after the failed consume ran.
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.canvasShare.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.emailPreference.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('"No, this wasn\'t me"', () => {
    it('revokes everything the registrant holds, withdraws their marketing consent and logs it', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      const res = await request(app)
        .post('/api/auth/verify-email')
        .set('Cookie', `jwt=${signUserToken('user-pending', 'researcher', 'free')}`)
        .send({ email: 'owner@example.com', token, decision: 'no' });
      expect(res.status).toBe(200);
      expect(res.body.data.outcome).toBe('secured');
      const data = tx.user.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ passwordHash: '', resetTokenHash: null, verificationTokenHash: null });
      expect(data.sessionsInvalidAt).toBeInstanceOf(Date);
      expect(data.lifecycleCohortStartedAt).toBeNull();
      expect(tx.dashboardAccess.updateMany).toHaveBeenCalled();
      expect(tx.canvasCollaborator.deleteMany).toHaveBeenCalled();
      expect(tx.canvasShare.deleteMany).toHaveBeenCalled();
      expect(tx.teamMember.deleteMany).toHaveBeenCalled();
      expect(tx.userAiConfig.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-pending' } });
      expect(mockPrisma.emailPreference.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-pending' },
        data: expect.objectContaining({ lifecycle: false, productUpdates: false, unsubscribedAt: expect.any(Date) }),
      });
      // This browser's cookie is cleared as well.
      expect(String(res.headers['set-cookie'])).toMatch(/jwt=;/);
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.email_verification_disowned', actorId: 'user-pending' }),
      );
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('"I don\'t know this password"', () => {
    it('secures the account like "No" and emails a reset link to the inbox', async () => {
      const token = freshToken();
      mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ email: 'owner@example.com', token, decision: 'reset' });
      expect(res.status).toBe(200);
      expect(res.body.data.outcome).toBe('reset_sent');
      expect(tx.user.update.mock.calls[0][0].data.passwordHash).toBe('');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-pending' },
        data: { resetTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/), resetTokenExpiry: expect.any(Date) },
      });
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'owner@example.com',
        expect.stringContaining('/reset-password#token='),
      );
      // Consent is left as the account holder set it.
      expect(mockPrisma.emailPreference.updateMany).not.toHaveBeenCalled();
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.email_verification_secured_for_reset' }),
      );
    });
  });

  it('rejects an unknown decision without touching anything', async () => {
    const token = freshToken();
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser(token));
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: 'owner@example.com', token, decision: 'maybe' });
    expect(res.status).toBe(400);
    expect(writeCalls()).toBe(0);
  });
});
