import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ getEvents: vi.fn() }));
vi.mock('../../../services/api', () => ({ calendarApi: { getEvents: mocks.getEvents } }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { authType: string }) => unknown) => selector({ authType: 'email' }),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import CalendarPanel from './CalendarPanel';

describe('CalendarPanel first-run and recovery states', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers a milestone action and reversible unsaved sample when empty', async () => {
    mocks.getEvents.mockResolvedValue({ data: { data: [] } });
    render(<CalendarPanel onClose={vi.fn()} />);

    expect(await screen.findByText('No events yet')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Show sample milestone' }));
    expect(screen.getByText('Sample only — not saved to your calendar')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Hide sample milestone' }));
    expect(screen.queryByText('Sample only — not saved to your calendar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add your first milestone' }));
    expect(screen.getByPlaceholderText('Event title')).toBeVisible();
  });

  it('does not call a failed load an empty calendar and gives a retry', async () => {
    mocks.getEvents.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { data: [] } });
    render(<CalendarPanel onClose={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load your calendar/i);
    expect(screen.queryByText('No events yet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try loading again' }));
    expect(await screen.findByText('No events yet')).toBeVisible();
    expect(mocks.getEvents).toHaveBeenCalledTimes(2);
  });
});
