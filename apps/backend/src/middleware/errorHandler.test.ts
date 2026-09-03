import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler } from './errorHandler.js';
import { logger } from '../lib/logger.js';

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

const req = {} as Request;
const next = vi.fn() as NextFunction;

describe('AppError', () => {
  it('stores message and statusCode', () => {
    const err = new AppError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('errorHandler', () => {
  it('does not write a second response after a request timeout has already replied', () => {
    const res = mockRes();
    // A timeout that replied with res.status(408).json(...) has both sent
    // headers and ended the body.
    Object.defineProperty(res, 'headersSent', { value: true });
    Object.defineProperty(res, 'writableEnded', { value: true });
    const destroy = vi.fn();
    Object.defineProperty(res, 'destroy', { value: destroy });

    expect(() => errorHandler(new Error('late database failure'), req, res, next)).not.toThrow();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  it('tears the connection down when headers are out but the body never finished', () => {
    const res = mockRes();
    Object.defineProperty(res, 'headersSent', { value: true });
    Object.defineProperty(res, 'writableEnded', { value: false });
    const destroy = vi.fn();
    Object.defineProperty(res, 'destroy', { value: destroy });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      errorHandler(new Error('failed mid-stream'), req, res, next);
    } finally {
      consoleError.mockRestore();
    }
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('does not leave a client hanging when a route fails after writing part of the body', async () => {
    // Bug hunt 2026-09-02: with a bare `if (res.headersSent) return` the
    // response was never ended or destroyed. Measured with this exact route:
    // the client waited for its own 2,000 ms deadline (ECONNABORTED) instead
    // of seeing the connection close.
    const app = express();
    app.get('/stream', (_req, res, nextFn) => {
      res.setHeader('Content-Type', 'application/json');
      res.write('{"partial":');
      nextFn(new Error('boom mid-stream'));
    });
    app.use(errorHandler);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const started = Date.now();
    let failure: (Error & { code?: string }) | null = null;
    try {
      await request(app).get('/stream').timeout({ deadline: 5_000 });
    } catch (err) {
      failure = err as Error & { code?: string };
    } finally {
      consoleError.mockRestore();
    }

    // The request must fail (a broken response, not a stalled one), promptly,
    // and not because the client gave up waiting.
    expect(failure).not.toBeNull();
    expect(failure!.code).not.toBe('ECONNABORTED');
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('returns statusCode and message for AppError', () => {
    const res = mockRes();
    const err = new AppError('Canvas not found', 404);
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Canvas not found' });
  });

  it('returns 500 with generic message for unknown errors', () => {
    const res = mockRes();
    const err = new Error('Something unexpected');
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Internal server error' });
  });

  it('returns correct status for 400 AppError', () => {
    const res = mockRes();
    const err = new AppError('Validation failed', 400);
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns correct status for 401 AppError', () => {
    const res = mockRes();
    const err = new AppError('Unauthorized', 401);
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns correct status for 403 AppError', () => {
    const res = mockRes();
    const err = new AppError('Forbidden', 403);
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// Prisma surfaces failed DB operations as PrismaClientKnownRequestError with a
// P-code. Without translation these fall through to a generic 500 — e.g.
// creating a canvas with a duplicate name (unique constraint on
// dashboardAccessId+name) returned "Internal server error" instead of a clear
// "already exists". Map the common codes to proper 4xx responses.
function prismaError(code: string, meta?: Record<string, unknown>): Error {
  const err = new Error(`Prisma ${code}`) as Error & { code?: string; meta?: unknown };
  err.name = 'PrismaClientKnownRequestError';
  err.code = code;
  if (meta) err.meta = meta;
  return err;
}

describe('errorHandler — Prisma errors', () => {
  it('maps P2002 unique-constraint violation to 409 naming the field', () => {
    const res = mockRes();
    errorHandler(prismaError('P2002', { target: ['dashboardAccessId', 'name'] }), req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/name already exists/i) }),
    );
  });

  it('maps P2002 with no field metadata to a generic 409', () => {
    const res = mockRes();
    errorHandler(prismaError('P2002'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/already exists/i) }),
    );
  });

  it('maps P2025 record-not-found to 404', () => {
    const res = mockRes();
    errorHandler(prismaError('P2025'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/not found/i) }),
    );
  });

  it('does not leak the message for an unmapped Prisma code (falls through to 500)', () => {
    const res = mockRes();
    errorHandler(prismaError('P2034'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Internal server error' }));
  });
});

// body-parser rejects malformed / oversized bodies with an http-errors object.
// These used to fall through to the blanket 500 branch: the caller got
// "Internal server error" for their own truncated JSON, and every one of them
// was logged as a server fault (and so paged through the Sentry hook).
function bodyParserError(type: string, status: number, message: string): Error {
  const err = new Error(message) as Error & { type?: string; status?: number; statusCode?: number; expose?: boolean };
  err.name = 'SyntaxError';
  err.type = type;
  err.status = status;
  err.statusCode = status;
  err.expose = true;
  return err;
}

describe('errorHandler — malformed and oversized request bodies', () => {
  it('maps entity.parse.failed to 400 with a message naming the real problem', () => {
    const res = mockRes();
    errorHandler(bodyParserError('entity.parse.failed', 400, 'Unexpected end of JSON input'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Malformed JSON in request body' }),
    );
  });

  it('maps entity.too.large to 413, not 500', () => {
    const res = mockRes();
    errorHandler(bodyParserError('entity.too.large', 413, 'request entity too large'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Request body is too large' }),
    );
  });

  it('maps request.aborted to 400', () => {
    const res = mockRes();
    errorHandler(bodyParserError('request.aborted', 400, 'request aborted'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('honours an exposed 4xx status on a non-AppError, non-body-parser error', () => {
    const res = mockRes();
    const err = new Error('Unsupported media type') as Error & { status?: number; expose?: boolean };
    err.status = 415;
    err.expose = true;
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unsupported media type' }));
  });

  it('still returns 500 for a 5xx http-errors object (a genuine server fault)', () => {
    const res = mockRes();
    const err = new Error('upstream exploded') as Error & { status?: number; expose?: boolean };
    err.status = 502;
    err.expose = false;
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Internal server error' }));
  });

  it('does not report a client body error to the exception hook (no Sentry page)', () => {
    const res = mockRes();
    const onException = vi.fn();
    const previous = logger.onException;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.onException = onException;
    try {
      errorHandler(bodyParserError('entity.too.large', 413, 'request entity too large'), req, res, next);
      errorHandler(bodyParserError('entity.parse.failed', 400, 'Unexpected end of JSON input'), req, res, next);
      expect(onException).not.toHaveBeenCalled();
      // Control: a genuine unexpected error still reaches the hook.
      errorHandler(new Error('boom'), req, res, next);
      expect(onException).toHaveBeenCalledTimes(1);
    } finally {
      logger.onException = previous;
      consoleError.mockRestore();
    }
  });
});
