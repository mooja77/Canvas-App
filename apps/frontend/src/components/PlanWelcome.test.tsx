import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { authState, uiState } = vi.hoisted(() => ({
  authState: { plan: 'free' as string | null, effectivePlan: null as string | null },
  uiState: { markFeatureSeen: vi.fn() },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));
vi.mock('../stores/uiStore', () => ({
  useUIStore: (selector: (s: typeof uiState) => unknown) => selector(uiState),
}));

import PlanWelcome from './PlanWelcome';

describe('PlanWelcome', () => {
  beforeEach(() => {
    authState.plan = 'free';
    authState.effectivePlan = null;
  });

  it('welcomes a Student to Student, not to the free plan', () => {
    // Student had no branch at all, so a paying Student subscriber was shown
    // "Your free plan is ready to go" with the Free caps listed.
    authState.plan = 'student';
    render(<PlanWelcome onClose={vi.fn()} />);
    expect(screen.getByText('Welcome to Student')).toBeInTheDocument();
    expect(screen.queryByText(/Your free plan is ready to go/)).not.toBeInTheDocument();
  });

  it('tells a Student about the AI they are paying for', () => {
    authState.plan = 'student';
    render(<PlanWelcome onClose={vi.fn()} />);
    expect(screen.getByText(/AI-powered code suggestions/)).toBeInTheDocument();
  });

  it('still welcomes Pro and Team to their own tiers', () => {
    authState.plan = 'pro';
    const { unmount } = render(<PlanWelcome onClose={vi.fn()} />);
    expect(screen.getByText('Welcome to Pro')).toBeInTheDocument();
    unmount();

    authState.plan = 'team';
    render(<PlanWelcome onClose={vi.fn()} />);
    expect(screen.getByText('Welcome to Team')).toBeInTheDocument();
  });

  it('quotes the real Free caps', () => {
    authState.plan = 'free';
    render(<PlanWelcome onClose={vi.fn()} />);
    expect(screen.getByText(/2 canvases, 5 transcripts per canvas, 10 codes/)).toBeInTheDocument();
  });
});
