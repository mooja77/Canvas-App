import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// The exact shape GET /api/admin/billing returns (apps/backend/src/routes/adminRoutes.ts).
// The tab used to read `churnRate`, `tx.date` and `tx.amount`, none of which the
// backend sends, so it threw on render. It also showed nothing about
// complimentary ("comp_...") Team rows, which are not billed (QUALCANVAS-7).
const billing = {
  mrr: 78,
  arr: 936,
  mrrSource: 'stripe',
  mrrBasis: 'list-price-before-discounts',
  totalPaying: 1,
  totalComplimentary: 1,
  complimentaryByPlan: { team: 1 },
  totalFree: 12,
  churnRate30d: 0.05,
  planBreakdown: [{ plan: 'team', count: 1, revenue: 78 }],
  recentTransactions: [
    {
      id: 's1',
      userId: 'u1',
      userEmail: 'comped@example.org',
      plan: 'team',
      status: 'active',
      stripeSubscriptionId: 'comp_c51e45042fd914d8cb7264bdd',
      complimentary: true,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 's2',
      userId: 'u2',
      userEmail: 'payer@example.org',
      plan: 'team',
      status: 'active',
      stripeSubscriptionId: 'sub_123',
      complimentary: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      updatedAt: '2026-10-02T10:00:00.000Z',
    },
  ],
};

vi.mock('../services/api', () => ({
  adminApi: { getBilling: vi.fn(async () => ({ data: { success: true, data: billing } })) },
}));

import { BillingTab } from './AdminPage';

describe('admin Billing tab', () => {
  it('renders the backend billing shape and marks complimentary subscriptions as not billed', async () => {
    render(<BillingTab adminKey="k" />);
    expect(await screen.findByText('comped@example.org')).toBeInTheDocument();
    expect(screen.getByText('Complimentary (not billed)')).toBeInTheDocument();
    expect(screen.getByText('1 complimentary (not billed)')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('payer@example.org')).toBeInTheDocument();
  });
});
