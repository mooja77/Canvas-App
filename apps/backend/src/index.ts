import 'dotenv/config';

// Validate required environment variables (skip in test — tests mock env vars)
if (process.env.NODE_ENV !== 'test') {
  const REQUIRED_VARS = ['JWT_SECRET', 'DATABASE_URL'];
  const OPTIONAL_VARS = ['SMTP_HOST', 'ENCRYPTION_KEY'];

  for (const v of REQUIRED_VARS) {
    if (!process.env[v]) {
      console.error(`FATAL: Missing required environment variable: ${v}`);
      process.exit(1);
    }
  }

  for (const v of OPTIONAL_VARS) {
    if (!process.env[v]) {
      console.warn(`Warning: Optional environment variable not set: ${v}`);
    }
  }

  // Production-only hardening: fail fast on misconfigurations that silently
  // weaken security in prod (open CORS fallback, plaintext email links, etc.).
  if (process.env.NODE_ENV === 'production') {
    const origins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (origins.length === 0) {
      console.error('FATAL: ALLOWED_ORIGINS must be set in production to a comma-separated list of frontend origins.');
      process.exit(1);
    }

    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      console.error('FATAL: APP_URL must be set in production (used in verification / reset email links).');
      process.exit(1);
    }
    try {
      const parsed = new URL(appUrl);
      if (parsed.protocol !== 'https:') {
        console.error(`FATAL: APP_URL must use HTTPS in production (got ${parsed.protocol}).`);
        process.exit(1);
      }
    } catch {
      console.error(`FATAL: APP_URL is not a valid URL: ${appUrl}`);
      process.exit(1);
    }

    // If Stripe is wired up, the webhook secret is required to safely process
    // subscription events. Without it, webhooks fail open with 500s and
    // billing state drifts from Stripe's source of truth.
    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('FATAL: STRIPE_WEBHOOK_SECRET must be set when STRIPE_SECRET_KEY is configured.');
      process.exit(1);
    }
  }
}

import express from 'express';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { Router } from 'express';
import { auth } from './middleware/auth.js';
import { auditLog } from './middleware/auditLog.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { canvasRoutes, canvasPublicRoutes } from './routes/canvasRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { userAuthRoutes } from './routes/userAuthRoutes.js';
import { ethicsRoutes } from './routes/ethicsRoutes.js';
import { billingRoutes, handleStripeWebhook } from './routes/billingRoutes.js';
import { aiRoutes } from './routes/aiRoutes.js';
import { chatRoutes } from './routes/chatRoutes.js';
import { summaryRoutes } from './routes/summaryRoutes.js';
import { uploadRoutes } from './routes/uploadRoutes.js';
import { collaborationRoutes } from './routes/collaborationRoutes.js';
import { documentRoutes } from './routes/documentRoutes.js';
import { trainingRoutes } from './routes/trainingRoutes.js';
import { templateRoutes } from './routes/templateRoutes.js';
import { auditRoutes } from './routes/auditRoutes.js';
import { qdpxRoutes } from './routes/qdpxRoutes.js';
import { repositoryRoutes } from './routes/repositoryRoutes.js';
import { integrationRoutes } from './routes/integrationRoutes.js';
import { aiSettingsRoutes } from './routes/aiSettingsRoutes.js';
import { teamRoutes } from './routes/teamRoutes.js';
import { calendarRoutes } from './routes/calendarRoutes.js';
import { exportRoutes } from './routes/exportRoutes.js';
import { notificationRoutes } from './routes/notificationRoutes.js';
import { reportRoutes } from './routes/reportRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { lifecycleEmailRoutes, publicLifecycleEmailRoutes } from './routes/lifecycleEmailRoutes.js';
import { eventsRoutes } from './routes/eventsRoutes.js';
import { prisma } from './lib/prisma.js';
import { initSocketServer } from './lib/socket.js';
import { startReportScheduler, stopReportScheduler } from './jobs/reportScheduler.js';
import { startLifecycleEmailScheduler, stopLifecycleEmailScheduler } from './jobs/lifecycleEmailScheduler.js';
import { startStripeReconciliationScheduler, stopStripeReconciliationScheduler } from './jobs/stripeReconciliation.js';
import { corsOrigin } from './utils/origins.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3007', 10);

// Trust proxy (Railway/Vercel run behind reverse proxies)
app.set('trust proxy', 1);

// Assign a correlation ID to every request — echoed in X-Request-ID response
// header and available as req.requestId for logging / error responses.
app.use(requestId);

// Security headers
const isProduction = process.env.NODE_ENV === 'production';
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'https://accounts.google.com'],
        fontSrc: ["'self'"],
        frameSrc: ["'self'", 'https://accounts.google.com'],
        workerSrc: ["'self'", 'blob:'],
        childSrc: ["'self'", 'blob:'],
      },
    },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  }),
);

// CORS
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// Logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Stripe webhook — needs raw body BEFORE json parsing
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Body parsing — default limit for most routes
app.use(express.json({ limit: '1mb' }));

// Cookie parsing — populates req.cookies for auth middleware to read the
// httpOnly jwt cookie set by login endpoints.
app.use(cookieParser());

// ─── Request counter for /metrics ───
let requestCount = 0;
app.use((_req, _res, next) => {
  requestCount++;
  next();
});

// CSRF protection
app.use(csrfProtection);

// Rate limiting (skip in E2E/test environments)
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true';
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
});
app.use('/api', generalLimiter);

// Rate limiter for heavy computation endpoints
const computeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many computation requests, please try again later' },
  skip: () => isTestEnv,
});
app.use('/api/canvas/:id/computed/:nodeId/run', computeLimiter);

// Larger body limit for transcript/import routes
app.use('/api/canvas/:id/transcripts', express.json({ limit: '10mb' }));
app.use('/api/canvas/:id/import-narratives', express.json({ limit: '10mb' }));
app.use('/api/canvas/:id/import-from-canvas', express.json({ limit: '10mb' }));

// ─── Health check ───
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Service unavailable' });
  }
});

// ─── Readiness check ───
// Reports every external dependency. Optional services (Stripe, SMTP,
// encryption) are marked "degraded" rather than "not ready" — we don't want
// a Stripe blip to restart the container. Only the DB being down fails hard.
app.get('/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error' | 'skipped'> = {};
  const details: Record<string, string> = {};

  // DB — hard dependency
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.database = 'ok';
  } catch (err) {
    checks.database = 'error';
    details.database = (err as Error).message;
  }

  // Encryption key — silent in prod if key is wrong would mean every AI-key
  // save/load fails later. Verify we can round-trip something.
  try {
    if (process.env.ENCRYPTION_KEY) {
      const { encryptApiKey, decryptApiKey } = await import('./utils/encryption.js');
      const probe = encryptApiKey('probe');
      const round = decryptApiKey(probe.encrypted, probe.iv, probe.tag);
      checks.encryption = round === 'probe' ? 'ok' : 'error';
    } else {
      checks.encryption = 'skipped';
    }
  } catch (err) {
    checks.encryption = 'error';
    details.encryption = (err as Error).message;
  }

  // Stripe — optional, only if keys configured. We don't actually call
  // Stripe (avoid rate-limited external calls on every health probe) —
  // just confirm the SDK can be constructed.
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const { getStripe } = await import('./lib/stripe.js');
      getStripe();
      checks.stripe = 'ok';
    } catch (err) {
      checks.stripe = 'error';
      details.stripe = (err as Error).message;
    }
  } else {
    checks.stripe = 'skipped';
  }

  // SMTP — only if configured. We don't open a real TCP connection on
  // every probe; just verify config is present.
  checks.smtp = process.env.SMTP_HOST ? 'ok' : 'skipped';

  const dbDown = checks.database === 'error';
  const anyDegraded = Object.values(checks).some((v) => v === 'error');

  const status = dbDown ? 'not ready' : anyDegraded ? 'degraded' : 'ready';
  res.status(dbDown ? 503 : 200).json({
    status,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    checks,
    ...(Object.keys(details).length > 0 ? { details } : {}),
  });
});

// ─── Basic metrics ───
app.get('/metrics', (_req, res) => {
  res.json({
    uptime: process.uptime(),
    requestCount,
    memoryUsage: process.memoryUsage().heapUsed,
    timestamp: new Date().toISOString(),
  });
});

// Request timeout (30 seconds)
app.use((_req, res, next) => {
  res.setTimeout(30_000, () => {
    if (!res.headersSent) {
      res.status(408).json({ success: false, error: 'Request timeout' });
    }
  });
  next();
});

// ─── Build versioned API router ───
const v1Router = Router();

// Auth routes (no auth middleware needed for login/signup)
v1Router.use(authRoutes);
v1Router.use(userAuthRoutes);

// Public canvas routes (shared canvas viewing)
v1Router.use(canvasPublicRoutes);

// Protected billing routes
v1Router.use(billingRoutes);

// Public telemetry events sink — accepts anonymous + authenticated calls.
// MUST be registered before the first `v1Router.use(auth, ...)` below:
// Express runs router-level middleware in registration order, so the `auth`
// middleware attached to the protected routes would otherwise 401 anonymous
// telemetry posts (e.g. pricing_viewed from marketing pages). Live QA
// finding #7 — the frontend half (VITE_API_URL) was fixed in Sprint 0.
v1Router.use(eventsRoutes);

// Protected canvas routes
v1Router.use(auth, auditLog, canvasRoutes);

// Protected ethics & compliance routes
v1Router.use(auth, auditLog, ethicsRoutes);

// Protected AI routes
v1Router.use(auth, auditLog, aiRoutes);

// Protected research assistant & summary routes
v1Router.use(auth, auditLog, chatRoutes);
v1Router.use(auth, auditLog, summaryRoutes);

// Protected upload & transcription routes
v1Router.use(auth, auditLog, uploadRoutes);

// Protected collaboration routes
v1Router.use(auth, auditLog, collaborationRoutes);

// Protected document & region coding routes
v1Router.use(auth, auditLog, documentRoutes);

// Protected training center routes
v1Router.use(auth, auditLog, trainingRoutes);

// Protected template + onboarding routes
v1Router.use(auth, auditLog, templateRoutes);

// Protected audit-trail routes (Sprint E user-facing endpoint)
v1Router.use(auth, auditLog, auditRoutes);

// Protected QDPX export/import routes
v1Router.use(auth, auditLog, qdpxRoutes);

// Protected repository routes
v1Router.use(auth, auditLog, repositoryRoutes);

// Protected integration routes
v1Router.use(auth, auditLog, integrationRoutes);

// Protected AI settings routes
v1Router.use(auth, auditLog, aiSettingsRoutes);

// Protected team routes
v1Router.use(auth, auditLog, teamRoutes);

// Protected calendar routes
v1Router.use(auth, auditLog, calendarRoutes);

// Protected notification routes
v1Router.use(auth, auditLog, notificationRoutes);

// Protected report routes
v1Router.use(auth, auditLog, reportRoutes);

// Export routes (Excel)
v1Router.use(auth, auditLog, exportRoutes);

// Admin routes (own key-based auth, not JWT) — must be before v1Router
// so /api/admin/* doesn't get caught by /api/* prefix
app.use('/api/admin', adminRoutes);

// Public lifecycle email routes, e.g. unsubscribe links from email footers.
app.use('/api/email', publicLifecycleEmailRoutes);

// Protected lifecycle email preferences
v1Router.use(auth, auditLog, lifecycleEmailRoutes);

// Mount under /api/v1 (versioned) and /api (backwards compat)
app.use('/api/v1', v1Router);
app.use('/api', v1Router);

// ─── Production: serve frontend static build ───
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

const httpServer = createServer(app);
initSocketServer(httpServer);

const server = httpServer.listen(PORT, () => {
  console.log(`QualCanvas backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  // Start report scheduler in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    startReportScheduler();
    startLifecycleEmailScheduler();
    startStripeReconciliationScheduler();
  }
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`${signal} received — shutting down gracefully`);
  stopReportScheduler();
  stopLifecycleEmailScheduler();
  stopStripeReconciliationScheduler();
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Server closed');
    process.exit(0);
  });
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
