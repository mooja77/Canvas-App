import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTelemetryDisabled, trackJmsEvent } from './jms-events.js';

describe('telemetry guard', () => {
  const saved = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    process.env.ADMIN_API_KEY = 'fake-key';
    delete process.env.JMS_TELEMETRY_ENABLED;
    delete process.env.JMS_EVENTS_ENABLED;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...saved };
  });

  it('makes no network call in test mode even with an admin key set', async () => {
    process.env.NODE_ENV = 'test';
    await trackJmsEvent({ name: 'x', email: 'a@b.ie' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still sends in production mode', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VITEST;
    delete process.env.CI;
    await trackJmsEvent({ name: 'x', email: 'a@b.ie' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('decision table', () => {
    expect(isTelemetryDisabled({ NODE_ENV: 'test' })).toBe(true);
    expect(isTelemetryDisabled({ VITEST: 'true' })).toBe(true);
    expect(isTelemetryDisabled({ CI: 'true' })).toBe(true);
    expect(isTelemetryDisabled({ NODE_ENV: 'production' })).toBe(false);
    expect(isTelemetryDisabled({ NODE_ENV: 'test', JMS_TELEMETRY_ENABLED: '1' })).toBe(false);
    expect(isTelemetryDisabled({ NODE_ENV: 'production', JMS_TELEMETRY_ENABLED: '0' })).toBe(true);
  });
});
