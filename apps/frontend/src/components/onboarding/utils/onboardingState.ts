// Client-side helper for the Sprint F onboarding flow. The screens themselves
// keep step state locally (useState in OnboardingFlow), but completion + the
// JIT-tooltip dismissal set are persisted server-side so the experience is
// consistent across browsers. This module handles the fire-and-forget patch.

import { onboardingApi } from '../../../services/api';

export interface PersistedOnboardingState {
  currentStep?: number;
  dismissedTooltips?: string[];
  checklistComplete?: string[];
  startedAt?: string;
  templateChoice?: { id: string; name: string } | null;
  personalization?: {
    researchTopic?: string;
    method?: string;
    solo?: boolean;
  };
}

let pending: Promise<unknown> | null = null;

export async function patchOnboardingState(patch: PersistedOnboardingState): Promise<void> {
  // Coalesce in-flight patches so rapid step changes don't fight each other.
  // The server merges shallowly, so the last write wins on conflicting keys.
  if (pending) {
    await pending.catch(() => {});
  }
  pending = onboardingApi.patch(patch as Record<string, unknown>).finally(() => {
    pending = null;
  });
  await pending.catch(() => {
    // best-effort: onboarding still works without server sync
  });
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await onboardingApi.complete();
  } catch {
    // best-effort
  }
}
