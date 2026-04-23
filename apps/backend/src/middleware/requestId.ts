import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Adds a correlation ID to every request so logs, error responses, and audit
// entries can be tied back to a single user action. Honors an incoming
// X-Request-ID header so upstream proxies / load balancers can set it.
//
// The header is echoed back on the response so the client can include it in
// bug reports — the ops side can then grep logs for the single ID.

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

const HEADER_NAME = 'x-request-id';

export function requestId(req: Request, res: Response, next: NextFunction) {
  // Accept an upstream-supplied ID but sanity-check it — untrusted clients
  // could inject arbitrary strings into logs otherwise.
  const incoming = req.headers[HEADER_NAME];
  const fromClient = typeof incoming === 'string' && /^[A-Za-z0-9_-]{6,128}$/.test(incoming) ? incoming : null;
  const id = fromClient ?? randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
