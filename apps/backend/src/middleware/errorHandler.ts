import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    // Only log 5xx AppErrors with stack trace
    if (err.statusCode >= 500) {
      console.error(JSON.stringify({ level: 'error', message: err.message, stack: err.stack }));
    }
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Unexpected errors — log full stack
  console.error(JSON.stringify({ level: 'error', message: err.message, stack: err.stack, type: err.constructor.name }));

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}
