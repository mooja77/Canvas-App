import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InteractiveDemo from './InteractiveDemo';

vi.mock('../../utils/analytics', () => ({ trackEvent: vi.fn() }));

const idbMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

vi.mock('idb-keyval', () => idbMocks);

describe('InteractiveDemo', () => {
  beforeEach(() => {
    idbMocks.get.mockReset().mockResolvedValue(undefined);
    idbMocks.set.mockReset().mockResolvedValue(undefined);
    idbMocks.del.mockReset().mockResolvedValue(undefined);
  });

  it('applies a suggested code after a pointer click', async () => {
    const user = userEvent.setup();
    render(<InteractiveDemo />);

    await user.click(screen.getByRole('button', { name: 'Coming back to school' }));
    const suggestions = await screen.findByRole('dialog', { name: 'Suggested codes' });
    await user.click(within(suggestions).getByRole('button', { name: '+ transition / return' }));

    await waitFor(() => expect(screen.getByText('1 span')).toBeInTheDocument());
  });

  it('does not let delayed persistence hydration erase a new code', async () => {
    const user = userEvent.setup();
    let resolveStored: ((value: { applied: never[]; revealed: string[]; savedAt: number }) => void) | undefined;
    idbMocks.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStored = resolve;
      }),
    );
    render(<InteractiveDemo />);

    await user.click(screen.getByRole('button', { name: 'Coming back to school' }));
    const suggestions = await screen.findByRole('dialog', { name: 'Suggested codes' });
    await user.click(within(suggestions).getByRole('button', { name: '+ transition / return' }));
    expect(screen.getByText('1 span')).toBeInTheDocument();

    await act(async () => {
      resolveStored?.({
        applied: [],
        revealed: ['identity-as-resistance', 'caregiving', 'transition / return'],
        savedAt: Date.now(),
      });
    });

    await waitFor(() => expect(screen.getByText('1 span')).toBeInTheDocument());
  });
});
