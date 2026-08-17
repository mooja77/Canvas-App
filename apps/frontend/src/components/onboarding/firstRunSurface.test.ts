import { describe, expect, it } from 'vitest';
import { resolveFirstRunSurface } from './firstRunSurface';

const base = {
  authenticated: true,
  authType: 'email' as const,
  onboardingV2Enabled: true,
  canvasesLoaded: true,
  canvasCount: 0,
  onboardingStateLoaded: true,
  onboardingV2Complete: false,
  setupWizardComplete: false,
};

describe('resolveFirstRunSurface', () => {
  it('selects onboarding v2 instead of stacking the legacy wizard', () => {
    expect(resolveFirstRunSurface(base)).toBe('onboarding_v2');
  });

  it('does not mount onboarding before canvases and account state are loaded', () => {
    expect(resolveFirstRunSurface({ ...base, canvasesLoaded: false })).toBe('loading');
    expect(resolveFirstRunSurface({ ...base, onboardingStateLoaded: false })).toBe('loading');
  });

  it('shows no first-run surface after server-backed v2 completion', () => {
    expect(resolveFirstRunSurface({ ...base, onboardingV2Complete: true })).toBe('none');
  });

  it('shows no first-run surface when a canvas already exists', () => {
    expect(resolveFirstRunSurface({ ...base, canvasCount: 1, onboardingStateLoaded: false })).toBe('none');
  });

  it('retains the legacy setup wizard when v2 is unavailable', () => {
    expect(resolveFirstRunSurface({ ...base, onboardingV2Enabled: false })).toBe('legacy_setup');
    expect(resolveFirstRunSurface({ ...base, authType: 'legacy' })).toBe('legacy_setup');
  });
});
