import { describe, expect, it } from 'vitest';
import { buildReadinessPayload } from './readiness.js';

const snapshot = {
  status: 'degraded' as const,
  version: '1.2.3',
  uptime: 42,
  checks: { database: 'ok' as const, smtp: 'error' as const },
  details: { smtp: 'connection refused' },
};

describe('buildReadinessPayload', () => {
  it('returns only the aggregate status in production', () => {
    expect(buildReadinessPayload(snapshot, true)).toEqual({ status: 'degraded' });
  });

  it('retains dependency diagnostics outside production', () => {
    expect(buildReadinessPayload(snapshot, false)).toEqual({
      status: 'degraded',
      version: '1.2.3',
      uptime: 42,
      checks: { database: 'ok', smtp: 'error' },
      details: { smtp: 'connection refused' },
    });
  });

  it('omits an empty details object outside production', () => {
    expect(buildReadinessPayload({ ...snapshot, details: {} }, false)).not.toHaveProperty('details');
  });
});
