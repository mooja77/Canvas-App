/**
 * Reliability fix #3 — retry wrapper for LLM provider calls.
 *
 * Every 429/503 from OpenAI/Anthropic/Google was previously surfacing as a
 * raw 500 to the user, with Auto-Code on large transcripts especially
 * vulnerable since it makes a single fragile long-running call. This wraps
 * any provider call in exponential backoff with retry-after honoring.
 *
 * Rules:
 * - Retry on: 429 (rate limit), 5xx (server error), or network/timeout errors
 *   that don't surface a status
 * - Don't retry: 4xx other than 429 (the request is broken, retrying won't help)
 * - Respect `retry-after` header if present, otherwise exponential backoff
 *   with jitter (1s, 2s, 4s, …)
 * - Default 3 attempts (1 original + 2 retries)
 *
 * Telemetry hook intentionally minimal — providers can log via console; the
 * frontend doesn't see retries (just final success/failure).
 */

interface LikeError {
  status?: number;
  response?: { status?: number; headers?: Record<string, string | number | undefined> };
  headers?: Record<string, string | number | undefined>;
  code?: string;
  message?: string;
}

function getStatus(err: unknown): number | undefined {
  const e = err as LikeError | undefined;
  return e?.status ?? e?.response?.status;
}

function getRetryAfterMs(err: unknown): number | undefined {
  const e = err as LikeError | undefined;
  const raw = e?.headers?.['retry-after'] ?? e?.response?.headers?.['retry-after'];
  if (raw === undefined || raw === null) return undefined;
  const parsed = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < 0) return undefined;
  // Header is in seconds; cap at 60s so a misbehaving provider can't park us.
  return Math.min(parsed, 60) * 1000;
}

function isRetryable(err: unknown): boolean {
  const status = getStatus(err);
  if (status === 429) return true;
  if (status !== undefined && status >= 500) return true;
  // No status means a network/timeout/abort — retryable. Plain JS errors
  // thrown by SDK type-guards aren't, but we can't distinguish reliably;
  // treat them as retryable and let max-attempts bound the blast.
  if (status === undefined) {
    const e = err as LikeError;
    const msg = (e?.message ?? '').toLowerCase();
    // Heuristic: explicit fetch/abort/timeout signals retry; JSON-parse and
    // type-shape errors should not retry (but we can't always tell).
    return /timeout|econnreset|enotfound|fetch failed|abort|network/.test(msg);
  }
  return false;
}

export interface WithRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  // Hook for tests + telemetry. Called before each retry attempt.
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
}

export async function withLlmRetry<T>(fn: () => Promise<T>, opts: WithRetryOptions = {}): Promise<T> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 1000;

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts - 1) break; // out of attempts
      if (!isRetryable(err)) throw err; // unretryable — fail fast
      const retryAfter = getRetryAfterMs(err);
      const backoff = retryAfter ?? baseDelayMs * 2 ** attempt + Math.random() * 300;
      opts.onRetry?.(attempt + 1, err, backoff);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}
