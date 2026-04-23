import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId;
  if (err instanceof AppError) {
    // Only log 5xx AppErrors with stack trace
    if (err.statusCode >= 500) {
      console.error(JSON.stringify({ level: 'error', message: err.message, stack: err.stack, requestId }));
    }
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(requestId ? { requestId } : {}),
    });
  }

  // Unexpected errors — log full stack
  console.error(
    JSON.stringify({
      level: 'error',
      message: err.message,
      stack: err.stack,
      type: err.constructor.name,
      requestId,
    }),
  );

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(requestId ? { requestId } : {}),
  });
}
