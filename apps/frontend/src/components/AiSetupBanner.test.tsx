import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// The banner reads from three Zustand stores via selectors. Back each with a
// mutable state object so individual tests can flip a single field.
const { authState, uiState, aiState } = vi.hoisted(() => ({
  authState: { plan: 'pro' as string, authType: 'email' as 'email' | 'legacy' | null },
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
    authState.authType = 'email';
    uiState.featureDiscovery.aiPromptSeen = false;
    aiState.configured = false;
    aiState.loaded = true;
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
});
