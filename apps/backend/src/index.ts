import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { auth } from './middleware/auth.js';
import { auditLog } from './middleware/auditLog.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
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
import { qdpxRoutes } from './routes/qdpxRoutes.js';
import { repositoryRoutes } from './routes/repositoryRoutes.js';
import { integrationRoutes } from './routes/integrationRoutes.js';
import { aiSettingsRoutes } from './routes/aiSettingsRoutes.js';
import { prisma } from './lib/prisma.js';
import { initSocketServer } from './lib/socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3007', 10);

// Trust proxy (Railway/Vercel run behind reverse proxies)
app.set('trust proxy', 1);

// Security headers
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      fontSrc: ["'self'"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
    },
  },
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : false)
    : ['http://localhost:5174', 'http://localhost:3007'],
  credentials: true,
}));

// Logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Stripe webhook — needs raw body BEFORE json parsing
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Body parsing — default limit for most routes
app.use(express.json({ limit: '1mb' }));

// CSRF protection
app.use(csrfProtection);

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

// Rate limiter for heavy computation endpoints
const computeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many computation requests, please try again later' },
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
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
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

// ─── Auth routes (no auth middleware needed for login/signup) ───
app.use('/api', authRoutes);
app.use('/api', userAuthRoutes);

// ─── Public canvas routes (shared canvas viewing) ───
app.use('/api', canvasPublicRoutes);

// ─── Protected billing routes ───
app.use('/api', billingRoutes);

// ─── Protected canvas routes ───
app.use('/api', auth, auditLog, canvasRoutes);

// ─── Protected ethics & compliance routes ───
app.use('/api', auth, auditLog, ethicsRoutes);

// ─── Protected AI routes ───
app.use('/api', auth, auditLog, aiRoutes);

// ─── Protected research assistant & summary routes ───
app.use('/api', auth, auditLog, chatRoutes);
app.use('/api', auth, auditLog, summaryRoutes);

// ─── Protected upload & transcription routes ───
app.use('/api', auth, auditLog, uploadRoutes);

// ─── Protected collaboration routes ───
app.use('/api', auth, auditLog, collaborationRoutes);

// ─── Protected document & region coding routes ───
app.use('/api', auth, auditLog, documentRoutes);

// ─── Protected training center routes ───
app.use('/api', auth, auditLog, trainingRoutes);

// ─── Protected QDPX export/import routes ───
app.use('/api', auth, auditLog, qdpxRoutes);

// ─── Protected repository routes ───
app.use('/api', auth, auditLog, repositoryRoutes);

// ─── Protected integration routes ───
app.use('/api', auth, auditLog, integrationRoutes);

// ─── Protected AI settings routes ───
app.use('/api', auth, aiSettingsRoutes);

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
  console.log(`Canvas App backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`${signal} received — shutting down gracefully`);
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
