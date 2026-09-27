import { Router } from 'express';
import type { Request } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { signUserToken, verifyToken, isUserPayload, tokenIssuedAtMs } from '../utils/jwt.js';
import { setAuthCookie, clearAuthCookie } from '../utils/authCookie.js';
import { logAudit } from '../middleware/auditLog.js';
import { authLimiter } from '../middleware/authLimiter.js';
import { sha256 } from '../utils/hashing.js';
import { sendPasswordResetEmail } from '../lib/email.js';
import { isLifecycleSendingEnabledFor, lifecycleTemplate, sendLifecycleEmail } from '../lib/lifecycleEmail.js';
import { logError } from '../lib/logger.js';
import {
  claimUnverifiedAccount,
  mintReplacementAccessCode,
  VerificationTokenAlreadyUsedError,
} from '../lib/accountClaim.js';
import { releaseUnusedSeats } from '../utils/seats.js';

/**
 * Email verification that asks before it acts.
 *
 * The attack this closes. Anyone can sign up with anyone's address. The
 * verification email then goes to the real owner of that address, and one
 * click on its link used to verify the account. The person who chose the
 * password (the attacker) kept their session and their password, and now held
 * a verified account in the victim's name.
 *
 * The design:
 *
 *  1. The link opens /verify-email in the web app. The token and address are in
 *     the URL fragment, which browsers never send to a server, and that page
 *     does nothing on load except read the account's sign-up time and device
 *     (POST /auth/verify-email/details, which never writes). Link scanners that
 *     prefetch or even render the page therefore change nothing. There is no
 *     GET endpoint that takes a verification token.
 *
 *  2. The page asks "Did you create this QualCanvas account?" and only a POST
 *     from it (POST /auth/verify-email with a `decision`) changes state. CSRF:
 *     the global Origin check (middleware/csrf.ts) applies, and the POST must
 *     carry the token itself, which only the inbox has. Replay: the token is
 *     consumed with a compare-and-set, so it acts at most once.
 *
 *  3. "Yes" proves inbox ownership, but not that the clicker is the person who
 *     chose the password; a victim can press Yes by mistake. So Yes verifies
 *     only when the clicker also proves they are the account holder:
 *       - this browser holds a live session for this same account (the usual
 *         case: sign up, then open the email on the same machine), or
 *       - they type the account's password (the other usual case: opened the
 *         email on their phone). Wrong password: nothing changes, the link
 *         still works.
 *     A victim who clicked Yes by mistake cannot supply either, so the attacker
 *     never gets a verified account. The page offers them "I don't know the
 *     password": that secures the account exactly like "No" (below) and emails
 *     a password-reset link to the inbox they just proved they own.
 *     The one account with no password (a Google-only account whose address was
 *     changed) has no second factor to ask for; it is verified and every
 *     existing session is ended, so only the inbox owner can get back in.
 *
 *  4. "No" hands the account to the inbox owner the same way a Google sign-in
 *     does (lib/accountClaim.ts): every session, the password, reset/verify
 *     links, the access code, collaborators, share links, team members and a
 *     bring-your-own AI key are revoked. Marketing consent given at sign-up is
 *     withdrawn: the person who ticked it was not the owner of the address.
 *     The owner can later use Google sign-in or "Forgot password" on this
 *     address, or ignore it. Each outcome is written to the audit log.
 */
export const emailVerificationRoutes = Router();

type VerifyUser = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

const LINK_UNUSABLE = 'This link has already been used or has expired. If you already confirmed, just sign in.';

function tokenMatches(user: VerifyUser, token: string): boolean {
  if (!user.verificationTokenHash || !user.verificationTokenExpiry) return false;
  if (user.verificationTokenExpiry < new Date()) return false;
  const a = Buffer.from(user.verificationTokenHash);
  const b = Buffer.from(sha256(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Look up the account a verification link belongs to. Every failure returns the
 * same message, so the endpoint does not reveal whether an address has an
 * account or whether it is verified.
 */
async function resolveLink(body: unknown): Promise<{ user: VerifyUser; token: string } | { error: string }> {
  const { email, token } = (body ?? {}) as { email?: unknown; token?: unknown };
  if (typeof email !== 'string' || !email || typeof token !== 'string' || !token || token.length > 256) {
    return { error: 'Invalid verification link. Please check your email and try again.' };
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || user.emailVerified || !tokenMatches(user, token)) return { error: LINK_UNUSABLE };
  return { user, token };
}

/**
 * True when the request carries a live session (cookie, or bearer for API
 * clients) for this exact account: signed, unexpired, and issued after the
 * account's last session revocation. Mirrors middleware/auth.ts.
 */
function hasLiveSessionFor(req: Request, user: VerifyUser): boolean {
  const cookieJwt = (req as Request & { cookies?: Record<string, string> }).cookies?.jwt;
  const header = req.headers.authorization;
  const raw = cookieJwt || (typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '');
  if (!raw) return false;
  const payload = verifyToken(raw);
  if (!payload || !isUserPayload(payload) || payload.userId !== user.id) return false;
  const issued = tokenIssuedAtMs(payload);
  if (user.sessionsInvalidAt && (issued === null || issued < user.sessionsInvalidAt.getTime())) return false;
  return true;
}

function hashedIp(req: Request): string {
  return sha256(req.ip || req.socket.remoteAddress || 'unknown');
}

// POST /api/auth/verify-email/details — read-only: what the confirmation page shows.
emailVerificationRoutes.post('/auth/verify-email/details', authLimiter, async (req, res, next) => {
  try {
    const link = await resolveLink(req.body);
    if ('error' in link) return res.status(400).json({ success: false, error: link.error });
    const { user } = link;
    res.json({
      success: true,
      data: {
        email: user.email,
        signedUpAt: user.createdAt,
        signupDevice: user.signupDevice ?? null,
        // Lets the page skip the password step when this browser is already
        // signed in to this account.
        signedInHere: hasLiveSessionFor(req, user),
        hasPassword: user.passwordHash !== '',
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-email — the only request that acts on a verification link.
emailVerificationRoutes.post('/auth/verify-email', authLimiter, async (req, res, next) => {
  try {
    const decision = (req.body ?? {}).decision;
    if (decision !== 'yes' && decision !== 'no' && decision !== 'reset') {
      // Also what an out-of-date page (one that verified on load) receives.
      return res.status(400).json({
        success: false,
        code: 'CONFIRMATION_REQUIRED',
        error: 'Please reload this page and tell us whether you created this account.',
      });
    }

    const link = await resolveLink(req.body);
    if ('error' in link) return res.status(400).json({ success: false, error: link.error });
    const { user, token } = link;
    const tokenHash = sha256(token);
    const ip = hashedIp(req);

    if (decision === 'yes') {
      const signedInHere = hasLiveSessionFor(req, user);
      let confirmedBy: 'session' | 'password' | 'no_password_on_account';
      if (signedInHere) {
        confirmedBy = 'session';
      } else if (user.passwordHash !== '') {
        const password = (req.body ?? {}).password;
        if (typeof password !== 'string' || password.length === 0) {
          return res.status(400).json({
            success: false,
            code: 'PASSWORD_REQUIRED',
            error: 'Enter the password chosen when this account was created.',
          });
        }
        if (!(await bcrypt.compare(password, user.passwordHash))) {
          logAudit({
            action: 'auth.email_verification_password_failed',
            resource: 'user',
            actorType: 'anonymous',
            actorId: user.id,
            ip,
            method: 'POST',
            path: '/api/auth/verify-email',
          });
          return res.status(400).json({
            success: false,
            code: 'PASSWORD_INCORRECT',
            error: 'That password is not correct. Your link still works; try again or choose another option.',
          });
        }
        confirmedBy = 'password';
      } else {
        confirmedBy = 'no_password_on_account';
      }

      const preference = await prisma.emailPreference.findUnique({ where: { userId: user.id } });
      // Compare-and-set: the token acts once, even under concurrent submits.
      const now = new Date();
      const consumed = await prisma.user.updateMany({
        where: { id: user.id, emailVerified: false, verificationTokenHash: tokenHash },
        data: {
          emailVerified: true,
          verificationTokenHash: null,
          verificationTokenExpiry: null,
          lifecycleCohortStartedAt: preference?.lifecycle ? now : null,
          // No second factor exists on a passwordless account, so nobody who
          // is not the inbox owner may keep a way in.
          ...(confirmedBy === 'no_password_on_account' ? { sessionsInvalidAt: now } : {}),
        },
      });
      if (consumed.count !== 1) return res.status(400).json({ success: false, error: LINK_UNUSABLE });

      // They proved both the inbox and the password: sign this browser in.
      if (confirmedBy === 'password') setAuthCookie(res, signUserToken(user.id, user.role, user.plan));
      if (confirmedBy === 'no_password_on_account') clearAuthCookie(res);

      if (isLifecycleSendingEnabledFor(user.email)) {
        void sendLifecycleEmail(user, lifecycleTemplate('welcome', user)).catch((error) =>
          logError(error as Error, { action: 'lifecycleEmail.welcome', userId: user.id }),
        );
      }
      logAudit({
        action: 'auth.email_verified',
        resource: 'user',
        actorType: 'user',
        actorId: user.id,
        ip,
        method: 'POST',
        path: '/api/auth/verify-email',
        meta: JSON.stringify({ confirmedBy }),
      });
      return res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
          outcome: 'verified',
          signedIn: confirmedBy !== 'no_password_on_account',
          // The page signs this browser in to the app after a password confirm.
          ...(confirmedBy === 'password'
            ? {
                user: {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  role: user.role,
                  plan: user.plan,
                  emailVerified: true,
                },
              }
            : {}),
        },
      });
    }

    // "No" and "I don't know the password": secure the account for the inbox owner.
    const freshAccessCode = await mintReplacementAccessCode();
    let claim;
    try {
      claim = await claimUnverifiedAccount(user, freshAccessCode, null, { consumeVerificationTokenHash: tokenHash });
    } catch (error) {
      if (error instanceof VerificationTokenAlreadyUsedError) {
        return res.status(400).json({ success: false, error: LINK_UNUSABLE });
      }
      throw error;
    }
    // Revoked team members and coder grants free paid seats: credit them
    // back (best effort; never throws, reconciliation retries).
    void releaseUnusedSeats(user.id);

    if (decision === 'no') {
      // Consent to optional email was given by whoever signed up, who has just
      // been shown not to be the owner of this address.
      await prisma.emailPreference.updateMany({
        where: { userId: user.id },
        data: {
          lifecycle: false,
          productUpdates: false,
          trainingTips: false,
          inactivityNudges: false,
          unsubscribedAt: new Date(),
        },
      });
    } else {
      // A reset link to the inbox that was just proven. claimUnverifiedAccount
      // cleared any earlier reset token, so this is the only one that works.
      const resetToken = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: sha256(resetToken), resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const appUrl = process.env.APP_URL || 'http://localhost:5174';
      await sendPasswordResetEmail(
        user.email,
        `${appUrl}/reset-password#token=${resetToken}&email=${encodeURIComponent(user.email)}`,
      );
    }

    // Whatever session this browser had on the account is revoked too.
    clearAuthCookie(res);
    logAudit({
      action: decision === 'no' ? 'auth.email_verification_disowned' : 'auth.email_verification_secured_for_reset',
      resource: 'user',
      actorType: 'anonymous',
      actorId: user.id,
      ip,
      method: 'POST',
      path: '/api/auth/verify-email',
      meta: JSON.stringify(claim.result),
    });
    return res.json({
      success: true,
      data: { outcome: decision === 'no' ? 'secured' : 'reset_sent' },
    });
  } catch (err) {
    next(err);
  }
});
