import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../../services/api';
import ActivationTab from './ActivationTab';

vi.mock('../../services/api', () => ({
  adminApi: {
    getUsage: vi.fn(),
  },
}));

const response = {
  data: {
    data: {
      period: '30d',
      since: '2026-08-01T00:00:00.000Z',
      activation: {
        cohortSize: 4,
        activatedUsers: 2,
        activationRate: 50,
        stages: [
          {
            key: 'signup',
            label: 'Signed up',
            users: 4,
            cohortRate: 100,
            previousStepRate: 100,
            medianHoursToReach: 0,
          },
          {
            key: 'canvas',
            label: 'Created a project',
            users: 3,
            cohortRate: 75,
            previousStepRate: 75,
            medianHoursToReach: 1.5,
          },
          {
            key: 'transcript',
            label: 'Added a transcript',
            users: 2,
            cohortRate: 50,
            previousStepRate: 66.7,
            medianHoursToReach: 24,
          },
          {
            key: 'coding',
            label: 'Created a first coding',
            users: 2,
            cohortRate: 50,
            previousStepRate: 100,
            medianHoursToReach: 48,
          },
        ],
      },
      content: {
        canvasesCreated: 5,
        transcriptsCreated: 8,
        codingsCreated: 42,
        computedNodeRuns: 3,
      },
    },
  },
};

describe('ActivationTab', () => {
  beforeEach(() => {
    vi.mocked(adminApi.getUsage)
      .mockReset()
      .mockResolvedValue(response as unknown as Awaited<ReturnType<typeof adminApi.getUsage>>);
  });

  it('renders a real-user activation funnel and period output', async () => {
    render(<ActivationTab adminKey="admin-key" />);

    expect(await screen.findByText('First-value funnel')).toBeInTheDocument();
    expect(screen.getByText('Reached first coding')).toBeInTheDocument();
    expect(screen.getAllByText('50.0%').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: /Created a first coding: 50.0%/ })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(adminApi.getUsage).toHaveBeenCalledWith('admin-key', { period: '30d' });
  });

  it('reloads the cohort when the period changes', async () => {
    const user = userEvent.setup();
    render(<ActivationTab adminKey="admin-key" />);

    await screen.findByText('First-value funnel');
    await user.click(screen.getByRole('button', { name: '7 days' }));

    await waitFor(() => expect(adminApi.getUsage).toHaveBeenLastCalledWith('admin-key', { period: '7d' }));
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a clear error without leaking request details', async () => {
    vi.mocked(adminApi.getUsage).mockRejectedValueOnce(new Error('secret backend detail'));
    render(<ActivationTab adminKey="admin-key" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load activation data.');
    expect(screen.queryByText('secret backend detail')).not.toBeInTheDocument();
  });
});
