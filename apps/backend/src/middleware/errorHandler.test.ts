import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler } from './errorHandler.js';

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
