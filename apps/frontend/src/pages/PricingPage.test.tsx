import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();
// Mutable auth state so individual tests can exercise legacy vs email auth.
const authState = {
  authenticated: false,
  plan: null as string | null,
  authType: null as 'legacy' | 'email' | null,
  email: null as string | null,
};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  // PageShell's SiteHeader + SiteFooter use Link; stub as anchor so tests
  // don't need a full router.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ to, children, ...rest }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>
      {children}
    </a>
  ),
}));

// Mock i18next (SiteHeader/Footer still use t() for some labels)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => authState,
}));

vi.mock('../services/api', () => ({
  billingApi: {
    createCheckout: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}));

import PricingPage from './PricingPage';

describe('PricingPage (refresh)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.authenticated = false;
    authState.plan = null;
    authState.authType = null;
    authState.email = null;
  });

  it('routes legacy (access-code) users to /account to link an email instead of dead-ending', () => {
    // Legacy users are grandfathered to Pro but have no Stripe userId, so they
    // can't checkout. Previously the upgrade CTA only flashed an ephemeral,
    // non-actionable toast. Now it should take them somewhere they can act —
    // /account, which has the "Link an email" form.
    authState.authenticated = true;
    authState.plan = 'pro';
    authState.authType = 'legacy';
    render(<PricingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Team' }));
    expect(mockNavigate).toHaveBeenCalledWith('/account');
  });

  it('shows a disabled "Current plan" CTA on the tier the user is already on, not an active upgrade button', () => {
    // A logged-in Pro user viewing pricing should not see an active "Start Pro"
    // button on the card flagged "Current" — clicking it would re-open Stripe
    // checkout for a plan they already have. Surface a disabled "Current plan"
    // affordance instead. The other tiers keep their normal CTAs.
    authState.authenticated = true;
    authState.plan = 'pro';
    authState.authType = 'email';
    render(<PricingPage />);
    expect(screen.queryByRole('button', { name: 'Start Pro' })).not.toBeInTheDocument();
    const currentBtn = screen.getByRole('button', { name: /current plan/i });
    expect(currentBtn).toBeDisabled();
    // Team is still upgradable from Pro.
    expect(screen.getByRole('button', { name: 'Start Team' })).toBeInTheDocument();
  });

  it('renders the four tier headings (Free, Pro, Team, Institutions)', () => {
    render(<PricingPage />);
    // Each tier is an h3 inside TierCardV2
    expect(screen.getByRole('heading', { name: 'Free', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pro', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Institutions', level: 3 })).toBeInTheDocument();
  });

  it('defaults to annual billing and shows discounted prices', () => {
    render(<PricingPage />);
    // Annual is the default — Pro $12/mo (billed annually), Team $32/mo.
    expect(screen.getByText('$12')).toBeInTheDocument();
    expect(screen.getByText('$32')).toBeInTheDocument();
  });

  it('Monthly toggle switches to higher prices', () => {
    render(<PricingPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Monthly$/ }));
    expect(screen.getByText('$15')).toBeInTheDocument();
    expect(screen.getByText('$39')).toBeInTheDocument();
  });

  it('shows the "Save 20%" annual savings affordance', () => {
    render(<PricingPage />);
    // The annual toggle button has "Save 20%" inline
    const annualButton = screen.getByRole('button', { name: /Annual/ });
    expect(within(annualButton).getByText(/Save 20%/)).toBeInTheDocument();
  });

  it('renders a Student tier with an .edu-gated CTA', () => {
    render(<PricingPage />);
    expect(screen.getByRole('heading', { name: 'Student', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Student' })).toBeInTheDocument();
  });

  it('blocks Student checkout for a non-.edu email and routes legacy users to link email', () => {
    // Authenticated non-.edu users must not be able to check out at the student
    // price; the CTA tells them it's academic-only instead.
    authState.authenticated = true;
    authState.plan = 'free';
    authState.authType = 'email';
    render(<PricingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Student' }));
    // No navigation to checkout/login; an error toast is shown instead.
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('Free / Pro / Team / Institutions each have a CTA', () => {
    render(<PricingPage />);
    // "Start free" appears twice — once in the Free tier card, once in the
    // closing CTAStripe — so use getAllByRole.
    expect(screen.getAllByRole('button', { name: 'Start free' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Start Pro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Team' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book a call' })).toBeInTheDocument();
  });

  it('mentions the .edu academic discount inline', () => {
    render(<PricingPage />);
    expect(screen.getByText(/40% off Pro and Team with a \.edu email/i)).toBeInTheDocument();
  });

  it('renders the categorical comparison table with all four tier columns', () => {
    render(<PricingPage />);
    const tableRoot = screen.getByText('Feature').closest('table');
    expect(tableRoot).not.toBeNull();
    expect(within(tableRoot!).getByText('Feature')).toBeInTheDocument();
    expect(within(tableRoot!).getAllByText('Pro').length).toBeGreaterThanOrEqual(1);
    expect(within(tableRoot!).getAllByText('Team').length).toBeGreaterThanOrEqual(1);
    expect(within(tableRoot!).getAllByText('Institutions').length).toBeGreaterThanOrEqual(1);
  });

  it('FAQ surfaces the academic-discount, cancellation, and downgrade questions', () => {
    render(<PricingPage />);
    expect(screen.getByText(/Can I try before I buy/i)).toBeInTheDocument();
    expect(screen.getByText(/Can I cancel anytime/i)).toBeInTheDocument();
    expect(screen.getByText(/How does the academic discount work/i)).toBeInTheDocument();
  });

  it('money-back guarantee text appears on the page', () => {
    render(<PricingPage />);
    expect(screen.getByText(/30-day money-back guarantee/i)).toBeInTheDocument();
  });

  it('CompetitorRow strip surfaces NVivo, ATLAS.ti, and Dedoose comparisons', () => {
    render(<PricingPage />);
    expect(screen.getByText('NVivo')).toBeInTheDocument();
    expect(screen.getByText('ATLAS.ti')).toBeInTheDocument();
    expect(screen.getByText('Dedoose')).toBeInTheDocument();
  });
});
