import { describe, it, expect, beforeEach } from 'vitest';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { canvasClient } from './api';
import { useAuthStore } from '../stores/authStore';

/**
 * The X-User-Plan response header carries the EFFECTIVE plan — the backend
 * stamps it after applying the free-trial overlay (middleware/auth.ts). Writing
 * it into authStore.plan conflated "actually on Pro" with "Free user in trial",
 * which is exactly what made the trial banner lie about paid tiers.
 */
function respondWithPlan(plan: string | undefined) {
  canvasClient.defaults.adapter = async (config: InternalAxiosRequestConfig) =>
    ({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: plan ? { 'x-user-plan': plan } : {},
      config,
    }) as AxiosResponse;
}

describe('X-User-Plan sync interceptor', () => {
  beforeEach(() => {
    useAuthStore.setState({
      authenticated: true,
      authType: 'email',
      plan: 'free',
      effectivePlan: 'free',
      trialEndsAt: '2099-01-01T00:00:00.000Z',
    });
  });

  it('does not overwrite the real plan with the trial-overlaid one', async () => {
    respondWithPlan('pro');
    await canvasClient.get('/canvas');
    expect(useAuthStore.getState().plan).toBe('free');
  });

  it('records the overlay in effectivePlan, which is what gating reads', async () => {
    respondWithPlan('pro');
    await canvasClient.get('/canvas');
    expect(useAuthStore.getState().effectivePlan).toBe('pro');
  });

  it('leaves trialEndsAt untouched so the banner keeps its countdown', async () => {
    respondWithPlan('pro');
    await canvasClient.get('/canvas');
    expect(useAuthStore.getState().trialEndsAt).toBe('2099-01-01T00:00:00.000Z');
  });

  it('is a no-op when the header is absent', async () => {
    respondWithPlan(undefined);
    await canvasClient.get('/canvas');
    expect(useAuthStore.getState().plan).toBe('free');
    expect(useAuthStore.getState().effectivePlan).toBe('free');
  });
});
