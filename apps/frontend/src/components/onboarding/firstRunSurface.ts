import type { AuthType } from '../../stores/authStore';

export type FirstRunSurface = 'loading' | 'none' | 'legacy_setup' | 'onboarding_v2';

interface FirstRunSurfaceInput {
  authenticated: boolean;
  authType: AuthType | null;
  onboardingV2Enabled: boolean;
  canvasesLoaded: boolean;
  canvasCount: number;
  onboardingStateLoaded: boolean;
  onboardingV2Complete: boolean;
  setupWizardComplete: boolean;
}

/**
 * Select exactly one first-run surface. The v2 experience replaces the legacy
 * setup wizard for email-authenticated users; it must never be layered on top
 * of it or mounted before account-scoped server state is available.
 */
export function resolveFirstRunSurface({
  authenticated,
  authType,
  onboardingV2Enabled,
  canvasesLoaded,
  canvasCount,
  onboardingStateLoaded,
  onboardingV2Complete,
  setupWizardComplete,
}: FirstRunSurfaceInput): FirstRunSurface {
  if (!authenticated || !canvasesLoaded) return 'loading';
  if (canvasCount > 0) return 'none';

  const useV2 = onboardingV2Enabled && authType === 'email';
  if (useV2) {
    if (!onboardingStateLoaded) return 'loading';
    return onboardingV2Complete ? 'none' : 'onboarding_v2';
  }

  return setupWizardComplete ? 'none' : 'legacy_setup';
}

