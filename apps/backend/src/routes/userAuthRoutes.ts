import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma.js';
import { signUserToken } from '../utils/jwt.js';
import { logAudit } from '../middleware/auditLog.js';
import { authLimiter } from '../middleware/authLimiter.js';
import { auth } from '../middleware/auth.js';
import { sha256 } from '../utils/hashing.js';
import { nanoid } from 'nanoid';
import { AppError } from '../middleware/errorHandler.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/email.js';

const BCRYPT_ROUNDS = 12;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

export const userAuthRoutes = Router();

// POST /api/auth/signup — email/password registration
userAuthRoutes.post('/auth/signup', authLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
      return res.status(400).json({ success: false, error: 'Name is required (1-100 characters)' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user + linked DashboardAccess in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name.trim(),
          plan: 'free',
        },
      });

      // Create a DashboardAccess for backward compat with existing canvas routes
      const accessCode = `USR-${nanoid(12)}`;
      const sha256Index = sha256(accessCode);
      const bcryptHash = await bcrypt.hash(accessCode, BCRYPT_ROUNDS);

      await tx.dashboardAccess.create({
        data: {
          accessCode: sha256Index,
          accessCodeHash: bcryptHash,
          name: name.trim(),
          role: 'researcher',
          expiresAt: new Date('2099-12-31'),
          userId: user.id,
        },
      });

      return user;
    });

    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = sha256(verifyToken);
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: result.id },
      data: { resetTokenHash: verifyTokenHash, resetTokenExpiry: verifyExpiry },
    });

    // Send verification email
    const appUrl = process.env.APP_URL || 'http://localhost:5174';
    const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}&email=${encodeURIComponent(normalizedEmail)}`;
    await sendVerificationEmail(normalizedEmail, verifyUrl);

    const jwt = signUserToken(result.id, result.role, result.plan);

    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    logAudit({
      action: 'auth.signup',
      resource: 'user',
      actorType: 'user',
      actorId: result.id,
      ip: sha256(rawIp),
      method: 'POST',
      path: '/api/auth/signup',
    });

    res.status(201).json({
      success: true,
      data: {
        jwt,
        user: {
          id: result.id,
          email: result.email,
          name: result.name,
          role: result.role,
          plan: result.plan,
          emailVerified: result.emailVerified,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/email-login — email/password login
userAuthRoutes.post('/auth/email-login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    const hashedIp = sha256(rawIp);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      logAudit({
        action: 'auth.failed',
        resource: 'user',
        actorType: 'anonymous',
        ip: hashedIp,
        method: 'POST',
        path: '/api/auth/email-login',
        meta: JSON.stringify({ reason: 'unknown_email' }),
      });
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logAudit({
        action: 'auth.failed',
        resource: 'user',
        actorType: 'anonymous',
        actorId: user.id,
        ip: hashedIp,
        method: 'POST',
        path: '/api/auth/email-login',
        meta: JSON.stringify({ reason: 'invalid_password' }),
      });
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Refresh plan from subscription status
    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    const currentPlan = subscription && ['active', 'trialing'].includes(subscription.status) ? user.plan : 'free';

    // Sync plan in DB if it differs
    if (currentPlan !== user.plan) {
      await prisma.user.update({ where: { id: user.id }, data: { plan: currentPlan } });
    }

    const jwt = signUserToken(user.id, user.role, currentPlan);

    logAudit({
      action: 'auth.login',
      resource: 'user',
      actorType: 'user',
      actorId: user.id,
      ip: hashedIp,
      method: 'POST',
      path: '/api/auth/email-login',
    });

    res.json({
      success: true,
      data: {
        jwt,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: currentPlan,
          emailVerified: user.emailVerified,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google — Google OAuth login/signup
userAuthRoutes.post('/auth/google', authLimiter, async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ success: false, error: 'Google credential is required' });
    }
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ success: false, error: 'Google OAuth is not configured' });
    }

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid Google credential' });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({ success: false, error: 'Unable to extract email from Google token' });
    }

    const { email, name: googleName, sub: googleId, email_verified: _email_verified } = payload;
    const normalizedEmail = email.toLowerCase().trim();
    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    const hashedIp = sha256(rawIp);

    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      // Create new user via Google OAuth
      user = await prisma.$transaction(async (tx: any) => {
        const newUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash: '',
            name: googleName || normalizedEmail.split('@')[0],
            plan: 'free',
            emailVerified: true,
          },
        });

        // Create a DashboardAccess for backward compat with existing canvas routes
        const accessCode = `USR-${nanoid(12)}`;
        const sha256Index = sha256(accessCode);
        const bcryptHash = await bcrypt.hash(accessCode, BCRYPT_ROUNDS);

        await tx.dashboardAccess.create({
          data: {
            accessCode: sha256Index,
            accessCodeHash: bcryptHash,
            name: googleName || normalizedEmail.split('@')[0],
            role: 'researcher',
            expiresAt: new Date('2099-12-31'),
            userId: newUser.id,
          },
        });

        return newUser;
      });

      logAudit({
        action: 'auth.signup',
        resource: 'user',
        actorType: 'user',
        actorId: user!.id,
        ip: hashedIp,
        method: 'POST',
        path: '/api/auth/google',
        meta: JSON.stringify({ provider: 'google', googleId }),
      });
    } else {
      logAudit({
        action: 'auth.login',
        resource: 'user',
        actorType: 'user',
        actorId: user.id,
        ip: hashedIp,
        method: 'POST',
        path: '/api/auth/google',
        meta: JSON.stringify({ provider: 'google' }),
      });
    }

    // user is guaranteed non-null (either found or created in transaction above)
    user = user!;

    // Refresh plan from subscription status
    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    const currentPlan = subscription && ['active', 'trialing'].includes(subscription.status) ? user.plan : 'free';

    if (currentPlan !== user.plan) {
      await prisma.user.update({ where: { id: user.id }, data: { plan: currentPlan } });
    }

    const jwt = signUserToken(user.id, user.role, currentPlan);

    res.json({
      success: true,
      data: {
        jwt,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: currentPlan,
          emailVerified: user.emailVerified,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password — initiate password reset
userAuthRoutes.post('/auth/forgot-password', authLimiter, async (req, res, next) => {
  const responseStart = Date.now();
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      // Generate a reset token (stored hashed, sent plain). Any prior unused
      // token is overwritten here — reissuing a reset invalidates older ones
      // so an attacker who captured an earlier link can't reuse it.
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = sha256(resetToken);
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash, resetTokenExpiry: resetExpiry },
      });

      const appUrl = process.env.APP_URL || 'http://localhost:5174';
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

      await sendPasswordResetEmail(normalizedEmail, resetUrl);
    }

    // Equalize timing so observers can't distinguish the "user exists" branch
    // (DB update + email send) from the "user does not exist" branch by
    // measuring response latency. 400ms is longer than either branch takes.
    const elapsed = Date.now() - responseStart;
    const targetMs = 400;
    if (elapsed < targetMs) {
      await new Promise((resolve) => setTimeout(resolve, targetMs - elapsed));
    }

    res.json({ success: true, message: 'If an account exists, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password — complete password reset
userAuthRoutes.post('/auth/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, token, and new password are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid reset request' });
    }

    const tokenHash = sha256(token);
    let tokenValid = false;
    try {
      if (user.resetTokenHash) {
        tokenValid = crypto.timingSafeEqual(Buffer.from(user.resetTokenHash), Buffer.from(tokenHash));
      }
    } catch {
      tokenValid = false;
    }
    if (!tokenValid || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Clear the reset token
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: null, resetTokenExpiry: null },
    });

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-email — verify email address
userAuthRoutes.post('/auth/verify-email', authLimiter, async (req, res, next) => {
  try {
    const { email, token } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid verification request' });
    }

    if (user.emailVerified) {
      return res.json({ success: true, message: 'Email is already verified' });
    }

    const tokenHash = sha256(token);
    let tokenValid = false;
    try {
      if (user.resetTokenHash) {
        tokenValid = crypto.timingSafeEqual(Buffer.from(user.resetTokenHash), Buffer.from(tokenHash));
      }
    } catch {
      tokenValid = false;
    }
    if (!tokenValid || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification token' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, resetTokenHash: null, resetTokenExpiry: null },
    });

    logAudit({
      action: 'auth.email_verified',
      resource: 'user',
      actorType: 'user',
      actorId: user.id,
      method: 'POST',
      path: '/api/auth/verify-email',
    });

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/resend-verification — resend verification email
userAuthRoutes.post('/auth/resend-verification', auth, async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email account required', 403);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    if (user.emailVerified) {
      return res.json({ success: true, message: 'Email is already verified' });
    }

    // Generate new verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = sha256(verifyToken);
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: verifyTokenHash, resetTokenExpiry: verifyExpiry },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:5174';
    const verifyUrl = `${appUrl}/verify-email?token=${verifyToken}&email=${encodeURIComponent(user.email)}`;
    await sendVerificationEmail(user.email, verifyUrl);

    res.json({ success: true, message: 'Verification email sent' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — current user profile + usage
userAuthRoutes.get('/auth/me', auth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const dashboardAccessId = req.dashboardAccessId;

    // Email-authenticated user
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });
      if (!user) throw new AppError('User not found', 404);

      // Validate plan matches subscription status (auto-downgrade if expired/canceled)
      const activeSub = user.subscription && ['active', 'trialing'].includes(user.subscription.status);
      const validPlan = activeSub ? user.plan : 'free';
      if (validPlan !== user.plan) {
        await prisma.user.update({ where: { id: userId }, data: { plan: validPlan } });
        user.plan = validPlan;
      }

      // Count resources for usage
      const [canvasCount, totalTranscripts, totalCodes, totalShares] = await Promise.all([
        prisma.codingCanvas.count({
          where: { OR: [{ userId }, ...(dashboardAccessId ? [{ dashboardAccessId }] : [])] },
        }),
        prisma.canvasTranscript.count({
          where: { canvas: { OR: [{ userId }, ...(dashboardAccessId ? [{ dashboardAccessId }] : [])] } },
        }),
        prisma.canvasQuestion.count({
          where: { canvas: { OR: [{ userId }, ...(dashboardAccessId ? [{ dashboardAccessId }] : [])] } },
        }),
        prisma.canvasShare.count({
          where: { canvas: { OR: [{ userId }, ...(dashboardAccessId ? [{ dashboardAccessId }] : [])] } },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            plan: user.plan,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
          },
          subscription: user.subscription
            ? {
                status: user.subscription.status,
                currentPeriodEnd: user.subscription.currentPeriodEnd,
                cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
              }
            : null,
          usage: { canvasCount, totalTranscripts, totalCodes, totalShares },
          authType: 'email',
        },
      });
    }

    // Legacy user
    if (dashboardAccessId) {
      const access = await prisma.dashboardAccess.findUnique({ where: { id: dashboardAccessId } });
      if (!access) throw new AppError('Account not found', 404);

      return res.json({
        success: true,
        data: {
          user: {
            name: access.name,
            role: access.role,
            plan: 'pro', // Grandfathered
          },
          subscription: null,
          usage: null,
          authType: 'legacy',
        },
      });
    }

    throw new AppError('Authentication required', 401);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/link-account — legacy user adds email to their account
userAuthRoutes.post('/auth/link-account', auth, async (req, res, next) => {
  try {
    const dashboardAccessId = req.dashboardAccessId;
    if (!dashboardAccessId) throw new AppError('Authentication required', 401);

    const { email, password, name } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    const access = await prisma.dashboardAccess.findUnique({ where: { id: dashboardAccessId } });
    if (!access) throw new AppError('Account not found', 404);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name?.trim() || access.name,
          plan: 'pro', // Grandfathered
        },
      });

      // Link DashboardAccess to User
      await tx.dashboardAccess.update({
        where: { id: dashboardAccessId },
        data: { userId: newUser.id },
      });

      // Link all canvases to the new user
      await tx.codingCanvas.updateMany({
        where: { dashboardAccessId },
        data: { userId: newUser.id },
      });

      return newUser;
    });

    const jwt = signUserToken(user.id, user.role, user.plan);

    res.json({
      success: true,
      data: {
        jwt,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/profile — update name/email
userAuthRoutes.put('/auth/profile', auth, async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email account required', 403);

    const { name, email } = req.body;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
        return res.status(400).json({ success: false, error: 'Name must be 1-100 characters' });
      }
      updateData.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Valid email is required' });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing && existing.id !== userId) {
        return res.status(409).json({ success: false, error: 'Email already in use' });
      }
      updateData.email = normalizedEmail;
      updateData.emailVerified = false; // Re-verify if email changed
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({
      success: true,
      data: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/change-password — change password
userAuthRoutes.put('/auth/change-password', auth, async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email account required', 403);

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new passwords are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/account — delete account
userAuthRoutes.delete('/auth/account', auth, async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email account required', 403);

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password confirmation required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) throw new AppError('User not found', 404);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Password is incorrect' });
    }

    // Cancel Stripe subscription if active
    if (user.subscription && user.stripeCustomerId) {
      try {
        const { getStripe } = await import('../lib/stripe.js');
        const stripe = getStripe();
        if (user.subscription.stripeSubscriptionId) {
          await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId);
        }
      } catch {
        // Continue with deletion even if Stripe fails
      }
    }

    // Cascade delete user (Prisma cascade handles related records)
    await prisma.user.delete({ where: { id: userId } });

    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/admin/seed-demo — seed demo access code (protected by admin secret)
userAuthRoutes.post('/auth/admin/seed-demo', async (req, res, next) => {
  try {
    const { secret } = req.body;
    if (!process.env.ADMIN_SEED_SECRET || secret !== process.env.ADMIN_SEED_SECRET) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    const demoCode = 'CANVAS-DEMO2025';
    const sha256Index = sha256(demoCode);
    const bcryptHash = await bcrypt.hash(demoCode, BCRYPT_ROUNDS);
    await prisma.dashboardAccess.upsert({
      where: { accessCode: sha256Index },
      update: {},
      create: {
        accessCode: sha256Index,
        accessCodeHash: bcryptHash,
        name: 'Demo Researcher',
        role: 'researcher',
        expiresAt: new Date('2027-12-31'),
      },
    });
    res.json({ success: true, message: 'Demo access code seeded' });
  } catch (err) {
    next(err);
  }
});
