import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { SeatStatus } from '../../services/seatsApi';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  setQuantity: vi.fn(),
  release: vi.fn(),
  upgradeToTeam: vi.fn(),
}));
vi.mock('../../services/seatsApi', async (orig) => ({
  ...(await orig<typeof import('../../services/seatsApi')>()),
  seatsApi: api,
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import SeatsPanel from './SeatsPanel';

const base: SeatStatus = {
  mode: 'billed',
  plan: 'team',
  effectivePlan: 'team',
  subscriptionStatus: 'active',
  subscriptionQuantity: 2,
  teamUpgrade: null,
  seatsPurchased: 2,
  seatsUsed: 3,
  unseatedCount: 1,
  graceEndsAt: '2026-11-01T00:00:00.000Z',
  enforcing: false,
  price: { unitAmount: 3900, currency: 'usd', interval: 'month' },
  holders: [
    {
      userId: 'u1',
      name: 'Aoife',
      email: 'aoife@example.edu',
      since: '2026-10-01T00:00:00.000Z',
      seated: true,
      canvases: [{ id: 'c1', name: 'Nurses study', inTrash: false }],
      teams: [],
    },
    {
      userId: 'u2',
      name: 'Seán',
      email: 'sean@example.edu',
      since: '2026-10-02T00:00:00.000Z',
      seated: false,
      canvases: [{ id: 'c1', name: 'Nurses study', inTrash: false }],
      teams: [{ id: 't1', name: 'Lab' }],
    },
  ],
};

const quote = {
  response: {
    status: 402,
    data: {
      code: 'SEAT_REQUIRED',
      preview: {
        currentQuantity: 2,
        newQuantity: 3,
        currency: 'usd',
        unitAmount: 3900,
        interval: 'month',
        dueNow: 2600,
        nextRenewal: 11700,
        hasDiscount: false,
        prorationDate: 1790000000,
        currentPeriodEnd: '2026-11-01T00:00:00.000Z',
      },
    },
  },
};

describe('SeatsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows seats in use, who holds them, and the grace date for a coder without a seat', async () => {
    api.get.mockResolvedValue({ data: { data: base } });
    render(<SeatsPanel />);
    expect(await screen.findByTestId('seats-summary')).toHaveTextContent(
      '3 people need a seat (you hold one); 2 paid for.',
    );
    expect(screen.getByTestId('seats-summary')).toHaveTextContent('$39.00 per seat / month');
    const list = screen.getByRole('list', { name: 'People holding a seat' });
    expect(within(list).getByText('Seat')).toBeInTheDocument();
    expect(within(list).getByText('No seat')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /1 coder doesn't have a paid seat\. They can keep editing until/,
    );
  });

  it('adding the missing seat asks for confirmation first, then retries with the quoted instant', async () => {
    api.get.mockResolvedValue({ data: { data: base } });
    api.setQuantity.mockRejectedValueOnce(quote).mockResolvedValueOnce({ data: { data: { quantity: 3 } } });
    render(<SeatsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 seat' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByTestId('seat-quantity-change')).toHaveTextContent('2 → 3');
    expect(within(dialog).getByTestId('seat-due-now')).toHaveTextContent('$26.00');
    expect(within(dialog).getByTestId('seat-next-renewal')).toHaveTextContent('$117.00 / month');
    expect(api.setQuantity).toHaveBeenCalledTimes(1);
    expect(api.setQuantity).toHaveBeenLastCalledWith(3, undefined);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add seats' }));
    await waitFor(() =>
      expect(api.setQuantity).toHaveBeenLastCalledWith(3, { confirmSeatCharge: true, prorationDate: 1790000000 }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('cancelling the quote charges nothing', async () => {
    api.get.mockResolvedValue({ data: { data: base } });
    api.setQuantity.mockRejectedValueOnce(quote);
    render(<SeatsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add 1 seat' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(api.setQuantity).toHaveBeenCalledTimes(1);
  });

  it('teaches when there are no coders yet', async () => {
    api.get.mockResolvedValue({
      data: { data: { ...base, seatsPurchased: 1, seatsUsed: 1, unseatedCount: 0, graceEndsAt: null, holders: [] } },
    });
    render(<SeatsPanel />);
    expect(await screen.findByText('No coders yet')).toBeInTheDocument();
    expect(screen.getByText(/invite a viewer for free/)).toBeInTheDocument();
  });

  it('renders nothing for a legacy session (403) and an error with retry otherwise', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 403 } });
    const { container, unmount } = render(<SeatsPanel />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    unmount();
    api.get.mockRejectedValueOnce({ response: { status: 500, data: { error: 'Boom' } } });
    render(<SeatsPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('"Make viewer" frees the seat after confirmation', async () => {
    api.get.mockResolvedValue({ data: { data: base } });
    api.release.mockResolvedValue({
      data: { data: { ...base, seatsUsed: 2, unseatedCount: 0, holders: [base.holders[0]] } },
    });
    render(<SeatsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Make Seán a viewer and free their seat' }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Make viewer' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => expect(api.release).toHaveBeenCalledWith('u2'));
    await waitFor(() => expect(screen.queryByText('Seán')).not.toBeInTheDocument());
  });

  // ─── Pro is a one-person plan (SEAT-BILLING.md) ───
  const pro: SeatStatus = {
    ...base,
    mode: 'solo',
    plan: 'pro',
    effectivePlan: 'pro',
    seatsPurchased: 1,
    subscriptionQuantity: 1,
    teamUpgrade: 'in_place',
    seatsUsed: 2,
    unseatedCount: 1,
    price: null,
    holders: [{ ...base.holders[1], seated: false }],
  };
  const teamQuote = {
    response: {
      status: 402,
      data: {
        code: 'TEAM_REQUIRED',
        upgrade: 'in_place',
        seatsNeeded: 2,
        preview: {
          ...quote.response.data.preview,
          currentQuantity: 1,
          newQuantity: 2,
          dueNow: 1650,
          nextRenewal: 7800,
          fromPlan: 'pro',
          toPlan: 'team',
          currentUnitAmount: 1500,
        },
      },
    },
  };

  it('Pro with a coder: says Pro is one person, gives the grace date, and prices Team from the published table', async () => {
    api.get.mockResolvedValue({ data: { data: pro } });
    render(<SeatsPanel />);
    expect(await screen.findByTestId('seats-summary')).toHaveTextContent('Pro is a one-person plan');
    expect(screen.getByText(/upgrade to Team: \$39 per seat a month, or \$32 billed annually/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /1 coder is coding on your Pro canvases, and coders need Team/,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/keep editing until .*nothing they coded is lost/);
    expect(within(screen.getByRole('list', { name: 'People holding a seat' })).getByText('Needs Team')).toBeVisible();
  });

  it('Pro upgrade: shows Stripe’s quote, charges nothing until confirmed, then sends confirmTeamUpgrade', async () => {
    api.get.mockResolvedValue({ data: { data: pro } });
    api.upgradeToTeam
      .mockRejectedValueOnce(teamQuote)
      .mockResolvedValueOnce({ data: { data: { ...pro, mode: 'billed' } } });
    render(<SeatsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Upgrade to Team' }));
    const dialog = await screen.findByTestId('team-upgrade-dialog');
    expect(within(dialog).getByText('Pro → Team')).toBeInTheDocument();
    expect(within(dialog).getByTestId('team-upgrade-seats')).toHaveTextContent('2');
    expect(within(dialog).getByTestId('team-upgrade-due-now')).toHaveTextContent('$16.50');
    expect(within(dialog).getByTestId('team-upgrade-renewal')).toHaveTextContent('$78.00 / month');
    // Members of the Seats list are managed with "Make viewer"; no viewer shortcut here.
    expect(within(dialog).queryByRole('button', { name: 'Add as viewer (free)' })).toBeNull();
    expect(api.upgradeToTeam).toHaveBeenCalledTimes(1);
    expect(api.upgradeToTeam).toHaveBeenLastCalledWith(undefined);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upgrade to Team' }));
    await waitFor(() =>
      expect(api.upgradeToTeam).toHaveBeenLastCalledWith({ confirmTeamUpgrade: true, prorationDate: 1790000000 }),
    );
  });

  it('Pro without a Stripe subscription (legacy or trial) is sent to the pricing page, not charged', async () => {
    api.get.mockResolvedValue({ data: { data: { ...pro, teamUpgrade: 'checkout' } } });
    render(<SeatsPanel />);
    const link = await screen.findByRole('link', { name: 'See the Team plan' });
    expect(link).toHaveAttribute('href', '/pricing');
    expect(api.upgradeToTeam).not.toHaveBeenCalled();
  });

  it('after grace, Pro coders are marked view-only', async () => {
    api.get.mockResolvedValue({ data: { data: { ...pro, enforcing: true } } });
    render(<SeatsPanel />);
    expect(await screen.findByText('Needs Team · view only')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/cannot edit until you upgrade/);
  });

  it('a complimentary Team says coders are not billed', async () => {
    api.get.mockResolvedValue({ data: { data: { ...base, mode: 'comp', unseatedCount: 0, graceEndsAt: null } } });
    render(<SeatsPanel />);
    expect(await screen.findByText(/complimentary, so coders on your canvases are not billed/)).toBeInTheDocument();
  });
});
