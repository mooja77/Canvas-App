/**
 * Tiny in-memory LRU cache for AI suggestions (Sprint H inline suggester).
 *
 * Process-local — fine for a single Railway dyno. If we scale horizontally
 * later, swap the implementation for Redis without changing the call sites.
 *
 * Why not pull in `lru-cache`? Adding a dependency for ~30 LOC is overkill
 * and the call surface is tiny. Trade-off: this implementation doesn't
 * track real recency on read (it just renews TTL); good enough for our
 * "did the user re-highlight the same thing?" pattern.
 */

import { createHash } from 'crypto';

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 1000;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

const store = new Map<string, Entry<unknown>>();

export function aiCacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  // Refresh insertion order so LRU eviction picks something colder.
  store.delete(key);
  store.set(key, entry);
  return entry.value as T;
}

export function aiCacheSet<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  // Evict oldest if at capacity. Map preserves insertion order so the first
  // key returned by keys() is the oldest.
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function aiCacheKey(parts: (string | number)[]): string {
  const joined = parts.join('|');
  // Hash so log lines / error messages don't leak the selection text.
  return createHash('sha256').update(joined).digest('hex').slice(0, 32);
}

export function aiCacheStats() {
  return { size: store.size, max: MAX_ENTRIES };
}

// Test-only — clear cache between integration tests.
export function _clearAiCache() {
  store.clear();
}
