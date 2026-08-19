import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { authState, uiState } = vi.hoisted(() => ({
  authState: {
    trialEndsAt: null as string | null,
    plan: 'free' as string | null,
    authType: 'email' as 'email' | 'legacy' | null,
  },
  uiState: { lastTrialBannerDismissalDate: null as string | null, dismissTrialBannerToday: vi.fn() },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));
vi.mock('../stores/uiStore', () => ({
  useUIStore: (selector: (s: typeof uiState) => unknown) => selector(uiState),
}));
vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

import TrialBanner from './TrialBanner';

const daysFromNow = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();
const EXPIRED_COPY = /Your Pro trial ended/;

describe('TrialBanner', () => {
  beforeEach(() => {
    authState.trialEndsAt = null;
    authState.plan = 'free';
    authState.authType = 'email';
    uiState.lastTrialBannerDismissalDate = null;
  });

  it('never tells a paying Student subscriber their trial ended', () => {
    // Student is a paid tier. The backend trial overlay only ever applies to
    // plan === 'free' (auth.ts + planLimits.ts), so a Student with a leftover
    // trialEndsAt is NOT limited to Free and must not be told that they are.
    authState.plan = 'student';
    authState.trialEndsAt = daysFromNow(-1);
    render(<TrialBanner />);
    expect(screen.queryByText(EXPIRED_COPY)).not.toBeInTheDocument();
  });

  it('does not nag a paying Student mid-trial-window either', () => {
    authState.plan = 'student';
    authState.trialEndsAt = daysFromNow(3);
    render(<TrialBanner />);
    expect(screen.queryByText(/left of your Pro trial/)).not.toBeInTheDocument();
  });

  it('stays silent for Pro and Team', () => {
    for (const plan of ['pro', 'team']) {
      authState.plan = plan;
      authState.trialEndsAt = daysFromNow(-1);
      const { unmount } = render(<TrialBanner />);
      expect(screen.queryByText(EXPIRED_COPY)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('still warns a Free user whose trial expired', () => {
    authState.plan = 'free';
    authState.trialEndsAt = daysFromNow(-1);
    render(<TrialBanner />);
    expect(screen.getByText(EXPIRED_COPY)).toBeInTheDocument();
  });

  it('still counts down for a Free user mid-trial', () => {
    authState.plan = 'free';
    authState.trialEndsAt = daysFromNow(3);
    render(<TrialBanner />);
    expect(screen.getByText(/left of your Pro trial/)).toBeInTheDocument();
  });
});
