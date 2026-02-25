import 'dotenv/config';
import express from 'express';
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
import { ethicsRoutes } from './routes/ethicsRoutes.js';
import { prisma } from './lib/prisma.js';
import { hashAccessCode } from './utils/hashing.js';
import { signResearcherToken } from './utils/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3007', 10);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
    },
  },
}));

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : false)
    : ['http://localhost:5174', 'http://localhost:3007'],
  credentials: true,
}));

// Logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));

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

// ─── Auth route (no auth middleware needed) ───
app.use('/api', authRoutes);

// ─── Public canvas routes (shared canvas viewing) ───
app.use('/api', canvasPublicRoutes);

// ─── Protected canvas routes ───
app.use('/api', auth, auditLog, canvasRoutes);

// ─── Protected ethics & compliance routes ───
app.use('/api', auth, auditLog, ethicsRoutes);

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

app.listen(PORT, () => {
  console.log(`Canvas App backend running on port ${PORT}`);
});

export default app;
