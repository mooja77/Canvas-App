import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();

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
  useAuthStore: () => ({
    authenticated: false,
    plan: null,
    authType: null,
  }),
}));

vi.mock('../services/api', () => ({
  billingApi: {
    createCheckout: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
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
    // Annual is the default in the refresh — Pro $9, Team $22.
    expect(screen.getByText('$9')).toBeInTheDocument();
    expect(screen.getByText('$22')).toBeInTheDocument();
  });

  it('Monthly toggle switches to higher prices', () => {
    render(<PricingPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Monthly$/ }));
    expect(screen.getByText('$12')).toBeInTheDocument();
    expect(screen.getByText('$29')).toBeInTheDocument();
  });

  it('shows the "Save 25%" annual savings affordance', () => {
    render(<PricingPage />);
    // The annual toggle button has "Save 25%" inline
    const annualButton = screen.getByRole('button', { name: /Annual/ });
    expect(within(annualButton).getByText(/Save 25%/)).toBeInTheDocument();
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
