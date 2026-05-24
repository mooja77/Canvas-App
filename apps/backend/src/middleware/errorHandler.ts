import type { Request, Response, NextFunction } from 'express';
import { logError, fieldsFromReq } from '../lib/logger.js';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Prisma raises PrismaClientKnownRequestError with a P-code for failed DB ops.
// Duck-type it (robust across @prisma/client versions and ESM/bundle module
// boundaries where instanceof can fail) and map the common codes to client
// errors so callers get a clear 4xx instead of an opaque 500.
function asPrismaKnownError(err: Error): (Error & { code: string; meta?: { target?: unknown } }) | null {
  const candidate = err as Error & { code?: unknown; meta?: { target?: unknown } };
  return err.name === 'PrismaClientKnownRequestError' && typeof candidate.code === 'string'
    ? (candidate as Error & { code: string; meta?: { target?: unknown } })
    : null;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const fields = fieldsFromReq(req);
  const requestId = fields.requestId;

  if (err instanceof AppError) {
    // Only log 5xx AppErrors — 4xx client errors are expected and would drown
    // the real signal. AppErrors still flow through logError so the optional
    // exception hook (e.g. Sentry) can see them if we choose.
    if (err.statusCode >= 500) {
      logError(err, { ...fields, statusCode: err.statusCode });
    }
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(requestId ? { requestId } : {}),
    });
  }

  // Translate known Prisma errors to client-facing 4xx. These are expected
  // outcomes (duplicate name, missing record), not server faults, so don't log
  // them as errors — that would drown the real signal like 4xx AppErrors do.
  const prismaErr = asPrismaKnownError(err);
  if (prismaErr) {
    if (prismaErr.code === 'P2002') {
      const target = prismaErr.meta?.target;
      const field = Array.isArray(target) ? target[target.length - 1] : typeof target === 'string' ? target : null;
      return res.status(409).json({
        success: false,
        error: field ? `A record with this ${field} already exists` : 'A record with these details already exists',
        ...(requestId ? { requestId } : {}),
      });
    }
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Record not found',
        ...(requestId ? { requestId } : {}),
      });
    }
    // Other Prisma codes are genuinely unexpected — fall through to log + 500.
  }

  // Unexpected errors — always log, always capture, never leak stack to client.
  logError(err, fields);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(requestId ? { requestId } : {}),
  });
}
