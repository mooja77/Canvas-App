import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { SeatStatus } from '../../services/seatsApi';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  setQuantity: vi.fn(),
  release: vi.fn(),
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
  subscriptionStatus: 'active',
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
});
