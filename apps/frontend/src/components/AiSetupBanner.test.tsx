import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// The banner reads from three Zustand stores via selectors. Back each with a
// mutable state object so individual tests can flip a single field.
const { authState, uiState, aiState } = vi.hoisted(() => ({
  authState: {
    plan: 'pro' as string,
    effectivePlan: null as string | null,
    authType: 'email' as 'email' | 'legacy' | null,
  },
  uiState: { featureDiscovery: { aiPromptSeen: false }, markFeatureSeen: vi.fn() },
  aiState: { configured: false, loaded: true, fetchConfig: vi.fn() },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));
vi.mock('../stores/uiStore', () => ({
  useUIStore: (selector: (s: typeof uiState) => unknown) => selector(uiState),
}));
vi.mock('../stores/aiConfigStore', () => ({
  useAiConfigStore: () => aiState,
}));

import AiSetupBanner from './AiSetupBanner';

const CTA = 'Add an OpenAI or Anthropic key';

describe('AiSetupBanner', () => {
  beforeEach(() => {
    authState.plan = 'pro';
    authState.effectivePlan = null;
    authState.authType = 'email';
    uiState.featureDiscovery.aiPromptSeen = false;
    aiState.configured = false;
    aiState.loaded = true;
    aiState.fetchConfig.mockClear();
  });

  it('shows the add-a-key CTA for Pro email users without a key', () => {
    render(<AiSetupBanner />);
    const link = screen.getByText(CTA);
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/account#ai');
  });

  it('does not render for legacy (access-code) users — AI keys need an email account', () => {
    // Legacy users are grandfathered to Pro but cannot configure a key, so the
    // CTA would dead-end on /account. This is the regression this fix prevents.
    authState.authType = 'legacy';
    render(<AiSetupBanner />);
    expect(screen.queryByText(CTA)).not.toBeInTheDocument();
  });

  it('does not render for free users', () => {
    authState.plan = 'free';
    render(<AiSetupBanner />);
    expect(screen.queryByText(CTA)).not.toBeInTheDocument();
  });

  it('does not render once a key is already configured', () => {
    aiState.configured = true;
    render(<AiSetupBanner />);
    expect(screen.queryByText(CTA)).not.toBeInTheDocument();
  });

  it('renders for Student, a tier sold with full AI', () => {
    // Student has aiEnabled: true in backend plans.ts and is billed for it.
    // The banner used to list the eligible tiers by name and never gained the
    // Student entry, so the whole tier was silently skipped.
    authState.plan = 'student';
    render(<AiSetupBanner />);
    expect(screen.getByText(CTA)).toBeInTheDocument();
  });

  it('fetches the AI config for Student too', () => {
    authState.plan = 'student';
    render(<AiSetupBanner />);
    expect(aiState.fetchConfig).toHaveBeenCalled();
  });

  it('follows the effective plan so a Free user on an active Pro trial still sees it', () => {
    // authStore.plan holds what the user actually pays for; effectivePlan holds
    // the trial overlay. AI entitlement follows the overlay (resolveRequestPlan).
    authState.plan = 'free';
    authState.effectivePlan = 'pro';
    render(<AiSetupBanner />);
    expect(screen.getByText(CTA)).toBeInTheDocument();
  });
});
