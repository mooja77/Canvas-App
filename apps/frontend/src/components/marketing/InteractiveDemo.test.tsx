import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import InteractiveDemo from './InteractiveDemo';

vi.mock('../../utils/analytics', () => ({ trackEvent: vi.fn() }));

describe('InteractiveDemo', () => {
  it('applies a suggested code after a pointer click', async () => {
    const user = userEvent.setup();
    render(<InteractiveDemo />);

    await user.click(screen.getByRole('button', { name: 'Coming back to school' }));
    const suggestions = await screen.findByRole('dialog', { name: 'Suggested codes' });
    await user.click(within(suggestions).getByRole('button', { name: '+ transition / return' }));

    await waitFor(() => expect(screen.getByText('1 span')).toBeInTheDocument());
  });
});
