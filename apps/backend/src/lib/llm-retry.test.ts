import { describe, it, expect, vi } from 'vitest';
import { withLlmRetry } from './llm-retry.js';

describe('withLlmRetry', () => {
  it('returns the first successful value without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withLlmRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 then succeeds', async () => {
    const fn = vi.fn().mockRejectedValueOnce({ status: 429, message: 'rate limited' }).mockResolvedValueOnce('ok');
    const onRetry = vi.fn();
    const result = await withLlmRetry(fn, { baseDelayMs: 1, onRetry });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('retries on 5xx then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 503, message: 'service unavailable' })
      .mockRejectedValueOnce({ status: 502, message: 'bad gateway' })
      .mockResolvedValueOnce('ok');
    const result = await withLlmRetry(fn, { baseDelayMs: 1, maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 4xx other than 429', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 401, message: 'unauthorized' });
    await expect(withLlmRetry(fn, { baseDelayMs: 1 })).rejects.toMatchObject({ status: 401 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503, message: 'down' });
    await expect(withLlmRetry(fn, { baseDelayMs: 1, maxAttempts: 2 })).rejects.toMatchObject({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('honors retry-after header (capped at 60s)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 429, headers: { 'retry-after': '0' }, message: 'rl' })
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();
    await withLlmRetry(fn, { baseDelayMs: 1000, onRetry });
    // retry-after: 0 → delay 0, beats the 1000ms base.
    expect(onRetry).toHaveBeenCalledWith(1, expect.anything(), 0);
  });

  it('retries on network-shaped errors with no status', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fetch failed')).mockResolvedValueOnce('ok');
    const result = await withLlmRetry(fn, { baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-network errors with no status', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('TypeError: undefined.foo'));
    await expect(withLlmRetry(fn, { baseDelayMs: 1 })).rejects.toThrow(/TypeError/);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
