import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PricingPage from './PricingPage';

describe('PricingPage Solo $9.99 visibility gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hides Solo when VITE_STRIPE_SOLO_MONTHLY_PRICE_ID is not configured so existing visitors see no unbilled tier', () => {
    vi.stubEnv('VITE_STRIPE_SOLO_MONTHLY_PRICE_ID', '');
    render(
      <MemoryRouter initialEntries={['/pricing']}>
        <PricingPage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Start Solo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Pro' })).toBeInTheDocument();
  });

  it('shows the Solo $9.99 card when VITE_STRIPE_SOLO_MONTHLY_PRICE_ID is configured', () => {
    vi.stubEnv('VITE_STRIPE_SOLO_MONTHLY_PRICE_ID', 'price_solo_monthly_test');
    vi.stubEnv('VITE_STRIPE_SOLO_ANNUAL_PRICE_ID', 'price_solo_annual_test');
    render(
      <MemoryRouter initialEntries={['/pricing']}>
        <PricingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Start Solo' })).toBeInTheDocument();
    expect(screen.getByText('$9.99')).toBeInTheDocument();
    expect(screen.getByText(/Code your whole project, not just a sample/i)).toBeInTheDocument();
    expect(screen.getByText('AI on your own key')).toBeInTheDocument();
  });
});
