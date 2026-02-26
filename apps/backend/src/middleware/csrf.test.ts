import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { csrfProtection } from './csrf.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('csrfProtection', () => {
  const next: NextFunction = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;
    delete process.env.FRONTEND_URL;
  });

  it('allows GET requests without any checks', () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows HEAD requests without any checks', () => {
    const req = mockReq({ method: 'HEAD' });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows POST in development (no allowed origins)', () => {
    const req = mockReq({ method: 'POST' });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows POST with matching origin header', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const req = mockReq({
      method: 'POST',
      headers: { origin: 'https://app.example.com' },
    });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects POST with non-matching origin header', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const req = mockReq({
      method: 'POST',
      headers: { origin: 'https://evil.com' },
    });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('origin not allowed') }),
    );
  });

  it('allows POST with same-origin Sec-Fetch-Site when no Origin header', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const req = mockReq({
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin' },
    });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows POST with same-site Sec-Fetch-Site when no Origin header', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const req = mockReq({
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-site' },
    });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows POST with matching Referer fallback', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const req = mockReq({
      method: 'POST',
      headers: { referer: 'https://app.example.com/some/page' },
    });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects POST with no Origin, no Sec-Fetch-Site, no Referer in production', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const req = mockReq({ method: 'POST', headers: {} });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('unable to verify') }),
    );
  });

  it('rejects PUT with cross-site Sec-Fetch-Site and no other verification', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const req = mockReq({
      method: 'PUT',
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects DELETE with mismatched Referer', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const req = mockReq({
      method: 'DELETE',
      headers: { referer: 'https://evil.com/attack' },
    });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('supports CORS_ORIGIN env variable', () => {
    process.env.CORS_ORIGIN = 'https://cors.example.com';
    const req = mockReq({
      method: 'POST',
      headers: { origin: 'https://cors.example.com' },
    });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('supports FRONTEND_URL env variable', () => {
    process.env.FRONTEND_URL = 'https://frontend.example.com';
    const req = mockReq({
      method: 'POST',
      headers: { origin: 'https://frontend.example.com' },
    });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('handles invalid Referer URL gracefully', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const req = mockReq({
      method: 'POST',
      headers: { referer: 'not-a-url' },
    });
    const res = mockRes();
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
