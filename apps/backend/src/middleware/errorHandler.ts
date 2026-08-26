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

// body-parser (express.json) rejects a request by calling next(err) with an
// http-errors object carrying `type`, `status`/`statusCode` and `expose`.
// These are client mistakes — a truncated payload, a body over the limit, an
// unsupported charset — not server faults. Without this branch they fell
// through to logError + a blanket 500, which both hid the real reason from
// the caller and paged the team through the Sentry exception hook.
interface BodyParserError extends Error {
  type?: unknown;
  status?: unknown;
  statusCode?: unknown;
  expose?: unknown;
}

const BODY_PARSER_MESSAGES: Record<string, string> = {
  'entity.parse.failed': 'Malformed JSON in request body',
  'entity.too.large': 'Request body is too large',
  'request.aborted': 'Request aborted before the body was received',
  'request.size.invalid': 'Request body size did not match Content-Length',
  'encoding.unsupported': 'Unsupported content encoding',
  'charset.unsupported': 'Unsupported charset',
  'parameters.too.many': 'Too many parameters in request body',
};

function asClientRequestError(err: Error): { statusCode: number; message: string } | null {
  const candidate = err as BodyParserError;
  const type = typeof candidate.type === 'string' ? candidate.type : null;

  const rawStatus = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode;
  const status = typeof rawStatus === 'number' ? rawStatus : null;

  if (type && BODY_PARSER_MESSAGES[type]) {
    // Trust body-parser's own status where it gave one (413 for too.large,
    // 400 for parse.failed, 415 for unsupported encodings) and fall back to
    // 400 for anything it left unset.
    return { statusCode: status && status >= 400 && status < 500 ? status : 400, message: BODY_PARSER_MESSAGES[type] };
  }

  // Any other http-errors-style client error that explicitly marked itself
  // safe to expose (`expose: true` is only set for 4xx) — honour its status
  // and message rather than masking it as a 500.
  if (status !== null && status >= 400 && status < 500 && candidate.expose === true) {
    return { statusCode: status, message: err.message || 'Bad request' };
  }

  return null;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  // A request timeout can finish the response while an in-flight database or
  // storage operation is still unwinding. Route-level catch blocks still call
  // next(err) in that situation; attempting a second JSON response produces
  // ERR_HTTP_HEADERS_SENT and turns a handled timeout into a noisy server
  // error. The response already has its final status, so there is nothing left
  // for this middleware to write.
  if (res.headersSent || res.writableEnded) return;

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

  // Malformed / oversized / aborted request bodies are client errors. Answer
  // with the real 4xx and don't log — logging them would page on traffic we
  // cannot act on.
  const clientErr = asClientRequestError(err);
  if (clientErr) {
    return res.status(clientErr.statusCode).json({
      success: false,
      error: clientErr.message,
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
