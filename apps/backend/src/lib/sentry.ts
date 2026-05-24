import * as Sentry from '@sentry/node';
import { logger } from './logger.js';

/**
 * Wire up backend error monitoring.
 *
 * No-op unless SENTRY_DSN is set, so local dev and tests stay quiet (and CI
 * without a DSN is unaffected). When enabled:
 *  - Sentry.init() registers global handlers for uncaughtException and
 *    unhandledRejection (default integrations), so process-level crashes —
 *    including the boot/runtime failures that were previously invisible — are
 *    captured.
 *  - We route the central logger's exception hook to captureException, so every
 *    handled error the app already passes through logError() (e.g. 500s from the
 *    errorHandler middleware) is reported too, without touching call sites.
 *
 * Returns true if Sentry was enabled, false otherwise.
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Error monitoring is the goal here, not performance tracing — keep the
    // sampling off so we don't add cost/quota. Can be raised later if needed.
    tracesSampleRate: 0,
  });

  logger.onException = (err, fields) => {
    Sentry.captureException(err, { extra: fields });
  };

  return true;
}
