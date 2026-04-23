import type { Request } from 'express';

/**
 * Minimal structured logger.
 *
 * All logs are JSON-per-line so they're greppable / shippable to any log
 * aggregator without a parser. Callers pass a structured record, not a
 * format string, so we never lose fields to interpolation.
 *
 * An exception hook can be wired to Sentry / Datadog / etc. without
 * touching every call site — set `logger.onException = fn` at startup.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface BaseFields {
  requestId?: string;
  userId?: string;
  canvasId?: string;
  action?: string;
  // Arbitrary additional context. Prefer flat primitive fields over nested
  // objects so logs stay easy to filter.
  [key: string]: unknown;
}

// Hook — call sites can assign a function here at startup (e.g. Sentry init).
// Default is a no-op; errors are still logged via console.error.
export const logger = {
  onException: null as null | ((err: Error, fields: BaseFields) => void),
};

function emit(level: LogLevel, message: string, fields: BaseFields = {}) {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  };
  const payload = JSON.stringify(entry);
  if (level === 'error') {
    console.error(payload);
  } else if (level === 'warn') {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

export function logDebug(message: string, fields?: BaseFields) {
  // Only emit debug when explicitly enabled, otherwise it's noise.
  if (process.env.LOG_LEVEL === 'debug') emit('debug', message, fields);
}

export function logInfo(message: string, fields?: BaseFields) {
  emit('info', message, fields);
}

export function logWarn(message: string, fields?: BaseFields) {
  emit('warn', message, fields);
}

export function logError(err: Error | string, fields: BaseFields = {}) {
  const isErr = err instanceof Error;
  emit('error', isErr ? err.message : err, {
    ...fields,
    ...(isErr ? { stack: err.stack, errorType: err.constructor.name } : {}),
  });
  if (isErr && logger.onException) {
    try {
      logger.onException(err, fields);
    } catch {
      // Never let the exception hook itself crash the request.
    }
  }
}

/** Extract the common correlation fields from an Express request. */
export function fieldsFromReq(req: Request): BaseFields {
  return {
    requestId: req.requestId,
    userId: req.userId,
    dashboardAccessId: req.dashboardAccessId,
  };
}
