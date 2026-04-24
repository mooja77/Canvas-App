import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  // SiteHeader + SiteFooter (rendered by PricingPage) use Link; stub as an anchor
  // so the test environment doesn't need a full router.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ to, children, ...rest }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>
      {children}
    </a>
  ),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'pricing.pageTitle': 'Simple, transparent pricing',
        'pricing.pageSubtitle': 'Start free. Upgrade when your research grows.',
        'pricing.monthly': 'Monthly',
        'pricing.annual': 'Annual',
        'pricing.free': 'Free',
        'pricing.pro': 'Pro',
        'pricing.team': 'Team',
        'pricing.getStarted': 'Get Started',
        'pricing.upgradeToPro': 'Upgrade to Pro',
        'pricing.upgradeToTeam': 'Upgrade to Team',
        'pricing.featureComparison': 'Full Feature Comparison',
        'pricing.faq': 'Frequently Asked Questions',
        'pricing.moneyBack': '30-day money-back guarantee',
        'pricing.unlimitedCanvases': 'Unlimited canvases & transcripts',
        'pricing.allAnalysisTools': 'All 10 analysis tools',
        'pricing.eduDiscount': '40% off for .edu emails',
        'pricing.intercoderReliability': 'Intercoder reliability (Kappa)',
        'pricing.teamManagement': 'Team management',
        'pricing.prioritySupport': 'Priority support',
        'pricing.perSeatPricing': 'Per-seat pricing',
        'pricing.unlimitedShares': 'Unlimited share codes',
        'common.loading': 'Loading...',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock authStore
vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    authenticated: false,
    plan: null,
    authType: null,
  }),
}));

// Mock billingApi
vi.mock('../services/api', () => ({
  billingApi: {
    createCheckout: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import PricingPage from './PricingPage';

describe('PricingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders three plan cards (Free, Pro, Team)', () => {
    render(<PricingPage />);
    expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument();
    // Plan names appear as h3 headings in TierCard
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pro').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Team').length).toBeGreaterThanOrEqual(1);
  });

  it('shows correct prices ($12/mo Pro, $29/mo Team)', () => {
    render(<PricingPage />);
    expect(screen.getByText('$12')).toBeInTheDocument();
    expect(screen.getByText('$29')).toBeInTheDocument();
  });

  it('Monthly/Annual toggle switches prices', () => {
    render(<PricingPage />);
    // Default is monthly, prices should be $12 and $29
    expect(screen.getByText('$12')).toBeInTheDocument();
    expect(screen.getByText('$29')).toBeInTheDocument();

    // Switch to annual
    fireEvent.click(screen.getByText('Annual'));

    // Annual prices: $9 and $22
    expect(screen.getByText('$9')).toBeInTheDocument();
    expect(screen.getByText('$22')).toBeInTheDocument();
  });

  it('annual shows 25% savings', () => {
    render(<PricingPage />);
    fireEvent.click(screen.getByText('Annual'));

    // The "Save 25% with annual billing" text should appear on TierCards
    const savingsText = screen.getAllByText('Save 25% with annual billing');
    expect(savingsText.length).toBeGreaterThanOrEqual(1);
  });

  it('upgrade buttons present for Pro and Team', () => {
    render(<PricingPage />);
    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    expect(screen.getByText('Upgrade to Team')).toBeInTheDocument();
  });

  it('academic discount mentioned (.edu)', () => {
    render(<PricingPage />);
    // The .edu discount should be listed as a feature
    const eduTexts = screen.getAllByText('40% off for .edu emails');
    expect(eduTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('feature comparison table renders with expected columns', () => {
    render(<PricingPage />);
    expect(screen.getByText('Full Feature Comparison')).toBeInTheDocument();
    // Table column headers (desktop)
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('FAQ section renders with questions', () => {
    render(<PricingPage />);
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
    expect(screen.getByText('Can I try before I buy?')).toBeInTheDocument();
    expect(screen.getByText('Do you offer academic discounts?')).toBeInTheDocument();
    expect(screen.getByText('Can I cancel anytime?')).toBeInTheDocument();
  });

  it('money-back guarantee badge is shown', () => {
    render(<PricingPage />);
    expect(screen.getByText('30-day money-back guarantee')).toBeInTheDocument();
  });
});
