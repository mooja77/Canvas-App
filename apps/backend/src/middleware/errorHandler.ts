import type { Request, Response, NextFunction } from 'express';
import { logError, fieldsFromReq } from '../lib/logger.js';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
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

  // Unexpected errors — always log, always capture, never leak stack to client.
  logError(err, fields);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(requestId ? { requestId } : {}),
  });
}
