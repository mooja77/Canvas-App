import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Sentry SDK so the test never opens a network transport.
const initMock = vi.fn();
const captureMock = vi.fn();
vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => initMock(...args),
  captureException: (...args: unknown[]) => captureMock(...args),
}));

import { initSentry } from './sentry.js';
import { logger, logError } from './logger.js';

describe('initSentry', () => {
  beforeEach(() => {
    initMock.mockClear();
    captureMock.mockClear();
    logger.onException = null;
    delete process.env.SENTRY_DSN;
  });

  it('is a no-op when SENTRY_DSN is not set', () => {
    const enabled = initSentry();
    expect(enabled).toBe(false);
    expect(initMock).not.toHaveBeenCalled();
    expect(logger.onException).toBeNull();
  });

  it('initializes Sentry with the DSN and wires the logger exception hook', () => {
    process.env.SENTRY_DSN = 'https://abc@o1.ingest.de.sentry.io/2';
    const enabled = initSentry();
    expect(enabled).toBe(true);
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock.mock.calls[0][0]).toMatchObject({ dsn: 'https://abc@o1.ingest.de.sentry.io/2' });
    expect(typeof logger.onException).toBe('function');
  });

  it('routes logError exceptions to Sentry.captureException once wired', () => {
    process.env.SENTRY_DSN = 'https://abc@o1.ingest.de.sentry.io/2';
    initSentry();
    const err = new Error('boom');
    logError(err, { requestId: 'req-1' });
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock.mock.calls[0][0]).toBe(err);
  });
});
