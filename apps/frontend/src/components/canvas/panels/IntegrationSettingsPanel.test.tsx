import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGetIntegrations = vi.fn();
const mockDisconnectIntegration = vi.fn();

vi.mock('../../../services/api', () => ({
  canvasApi: {
    getIntegrations: (...a: unknown[]) => mockGetIntegrations(...a),
    disconnectIntegration: (...a: unknown[]) => mockDisconnectIntegration(...a),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import IntegrationSettingsPanel from './IntegrationSettingsPanel';

/**
 * The provider integrations were retired. This panel is the only user-facing
 * route to credentials an earlier build may have stored, so its contract is
 * narrow and worth pinning: show what exists, offer deletion, and promise
 * nothing about reconnection.
 */
describe('IntegrationSettingsPanel', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: several tests queue one-shot responses
    // with mockResolvedValueOnce, and a leftover queue or default from the
    // previous test silently changes what the component receives.
    vi.resetAllMocks();
  });

  const stored = [{ id: 'ckint0000000000000000001', provider: 'zoom', createdAt: '2026-01-05T00:00:00.000Z' }];

  it('states plainly that connections are retired', async () => {
    mockGetIntegrations.mockResolvedValue({ data: { integrations: [] } });
    render(<IntegrationSettingsPanel />);

    expect(await screen.findByText(/connections have been retired|have been retired/i)).toBeInTheDocument();
  });

  it('lists nothing and says so when no credential is stored', async () => {
    mockGetIntegrations.mockResolvedValue({ data: { integrations: [] } });
    render(<IntegrationSettingsPanel />);

    expect(await screen.findByText(/No provider credentials are stored/i)).toBeInTheDocument();
    // A provider catalogue would name providers that were never connected.
    expect(screen.queryByText('Slack')).not.toBeInTheDocument();
    expect(screen.queryByText('Qualtrics')).not.toBeInTheDocument();
  });

  it('shows only the providers actually stored, not a catalogue', async () => {
    mockGetIntegrations.mockResolvedValue({ data: { integrations: stored } });
    render(<IntegrationSettingsPanel />);

    expect(await screen.findByText('Zoom')).toBeInTheDocument();
    expect(screen.queryByText('Slack')).not.toBeInTheDocument();
    expect(screen.queryByText('Qualtrics')).not.toBeInTheDocument();
  });

  it('never advertises unused providers as pending', async () => {
    mockGetIntegrations.mockResolvedValue({ data: { integrations: stored } });
    render(<IntegrationSettingsPanel />);
    await screen.findByText('Zoom');

    expect(screen.queryByText(/coming later|coming soon|not yet available/i)).not.toBeInTheDocument();
  });

  it('never suggests the user can reconnect', async () => {
    mockGetIntegrations.mockResolvedValue({ data: { integrations: stored } });
    render(<IntegrationSettingsPanel />);
    await screen.findByText('Zoom');

    expect(screen.queryByText(/reconnect/i)).not.toBeInTheDocument();
  });

  it('deletes a stored credential and refreshes the list', async () => {
    mockGetIntegrations
      .mockResolvedValueOnce({ data: { integrations: stored } })
      .mockResolvedValueOnce({ data: { integrations: [] } });
    mockDisconnectIntegration.mockResolvedValue({ data: { success: true } });

    render(<IntegrationSettingsPanel />);
    await screen.findByText('Zoom');

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    // Confirmation is required before an irreversible deletion.
    await userEvent.click(await screen.findByRole('button', { name: /delete permanently/i }));

    await waitFor(() => {
      expect(mockDisconnectIntegration).toHaveBeenCalledWith('ckint0000000000000000001');
    });
    expect(await screen.findByText(/No provider credentials are stored/i)).toBeInTheDocument();
  });

  it('warns that deletion is permanent and cannot be re-created', async () => {
    mockGetIntegrations.mockResolvedValue({ data: { integrations: stored } });
    render(<IntegrationSettingsPanel />);
    await screen.findByText('Zoom');

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(await screen.findByText(/cannot be undone/i)).toBeInTheDocument();
  });
});
