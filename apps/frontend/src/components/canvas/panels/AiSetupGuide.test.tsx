import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// AiSetupGuide reads authType from the auth store via a selector and talks to
// the ai-config store. Back each with a mutable object so a test can flip a
// single field, mirroring AiSetupBanner.test.tsx.
const { authState } = vi.hoisted(() => ({
  authState: { authType: 'email' as 'email' | 'legacy' | null },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));
vi.mock('../../../stores/aiConfigStore', () => ({
  useAiConfigStore: () => ({ setConfigured: vi.fn() }),
}));
vi.mock('../../../services/api', () => ({
  aiSettingsApi: { updateSettings: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import AiSetupGuide from './AiSetupGuide';

const renderGuide = () =>
  render(
    <MemoryRouter>
      <AiSetupGuide onClose={vi.fn()} trigger="AI Auto-Code" />
    </MemoryRouter>,
  );

const GATE_CTA = 'Link your email account';

describe('AiSetupGuide', () => {
  beforeEach(() => {
    authState.authType = 'email';
  });

  it('shows the link-account gate for legacy (access-code) users instead of the key-entry steps', () => {
    // Legacy users are grandfathered to Pro so AI features are visible, but the
    // key-save endpoint (PUT /ai-settings) 401s without an email account. Show
    // the gate, not a provider chooser that dead-ends on "Connect & Verify".
    authState.authType = 'legacy';
    renderGuide();
    expect(screen.getByText(GATE_CTA)).toBeInTheDocument();
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument();
  });

  it('routes legacy users to the account page to link an email', () => {
    authState.authType = 'legacy';
    renderGuide();
    expect(screen.getByRole('link', { name: new RegExp(GATE_CTA, 'i') })).toHaveAttribute('href', '/account');
  });

  it('lets email-auth users pick a provider with no gate', () => {
    authState.authType = 'email';
    renderGuide();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.queryByText(GATE_CTA)).not.toBeInTheDocument();
  });
});
