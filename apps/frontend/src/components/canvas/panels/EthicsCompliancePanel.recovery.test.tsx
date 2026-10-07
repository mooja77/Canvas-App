import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { client, current } = vi.hoisted(() => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  current: { canvas: { id: 'fictional-ethics', name: 'Fictional study', transcripts: [] } },
}));
vi.mock('../../../services/api', () => ({ canvasClient: client }));
vi.mock('../../../stores/canvasStore', () => ({ useActiveCanvas: () => current.canvas }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
import EthicsCompliancePanel from './EthicsCompliancePanel';
import { readEthicsSettings, readConsentRecords } from './ethicsPanelReads';

const settings = { ethicsApprovalId: null, ethicsStatus: 'pending', dataRetentionDate: null, consentRecords: [] };
const consent = {
  id: 'consent-1',
  participantId: 'P001',
  consentType: 'written',
  consentStatus: 'active',
  createdAt: '2026-10-07T00:00:00Z',
};
const response = (data: unknown) => ({ data: { success: true, data } });

describe('ethics panel truthful reads and teaching', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    current.canvas = { id: 'fictional-ethics', name: 'Fictional study', transcripts: [] };
    client.get.mockImplementation(async (url: string) =>
      response(url.endsWith('/ethics') ? settings : url.startsWith('/audit-log') ? { entries: [] } : []),
    );
  });

  it('does not expose default settings as editable after a failed read; retry only reads', async () => {
    client.get.mockRejectedValueOnce(new Error('offline'));
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ethics settings');
    expect(screen.queryByRole('button', { name: 'Save Settings' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading ethics settings' }));
    expect(await screen.findByRole('button', { name: 'Save Settings' })).toBeEnabled();
    expect(client.post).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });

  it('rejects malformed settings instead of announcing a pending empty project', async () => {
    client.get.mockResolvedValue(response({}));
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ethics settings');
    expect(screen.queryByRole('button', { name: 'Save Settings' })).not.toBeInTheDocument();
  });

  it('rejects array-shaped statuses instead of coercing them into valid settings or consent', () => {
    expect(() => readEthicsSettings({ ...settings, ethicsStatus: ['approved'] })).toThrow('Invalid ethics settings');
    expect(() => readConsentRecords([{ ...consent, consentStatus: ['active'] }], 'fictional-ethics')).toThrow(
      'Invalid consent record',
    );
    expect(() => readConsentRecords([{ ...consent, consentType: ['written'] }], 'fictional-ethics')).toThrow(
      'Invalid consent record',
    );
  });

  it('keeps previously verified consent after a failed reload, with explicit recovery', async () => {
    client.get.mockImplementation(async (url: string) => response(url.endsWith('/ethics') ? settings : [consent]));
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Consent Registry' }));
    expect(await screen.findByText('P001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ethics Settings' }));
    await screen.findByRole('button', { name: 'Save Settings' });
    client.get.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Consent Registry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load consent records');
    expect(screen.getByText('P001')).toBeInTheDocument();
    expect(screen.queryByText('No consent records yet.')).not.toBeInTheDocument();
  });

  it('does not treat malformed consent as an empty list', async () => {
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    await screen.findByRole('button', { name: 'Save Settings' });
    client.get.mockResolvedValueOnce(response({ records: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Consent Registry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load consent records');
    expect(screen.queryByText('No consent records yet.')).not.toBeInTheDocument();
  });

  it('explains real consent and focuses the existing form without fabricating a record', async () => {
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Consent Registry' }));
    const start = await screen.findByRole('button', { name: 'Enter a participant ID' });
    expect(screen.getByText(/Record permission you have already received/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See consent guidance' })).toHaveAttribute(
      'href',
      '/methodology/ethics-in-practice#consent',
    );
    fireEvent.click(start);
    expect(screen.getByRole('textbox', { name: 'Participant ID' })).toHaveFocus();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('offers persistent audit recovery for a malformed page without an invented empty log', async () => {
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    await screen.findByRole('button', { name: 'Save Settings' });
    client.get.mockResolvedValueOnce(response({ entries: {} }));
    fireEvent.click(screen.getByRole('button', { name: 'Audit Trail' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the audit trail');
    expect(screen.queryByText('No audit log entries found.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading the audit trail' }));
    expect(await screen.findByText('No recorded activity matches these filters.')).toBeInTheDocument();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('shows journal loading and failed reads rather than an empty journal, with GET-only retry', async () => {
    let reject!: (error: Error) => void;
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    await screen.findByRole('button', { name: 'Save Settings' });
    client.get.mockReturnValueOnce(
      new Promise((_, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reflexivity Journal' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Loading journal entries');
    expect(screen.queryByText('No journal entries yet.')).not.toBeInTheDocument();
    reject(new Error('offline'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load journal entries');
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading journal entries' }));
    expect(await screen.findByRole('button', { name: 'Start a journal note' })).toBeInTheDocument();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('journal teaching gives a safe example and focuses a labelled real note field', async () => {
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reflexivity Journal' }));
    const start = await screen.findByRole('button', { name: 'Start a journal note' });
    expect(screen.getByText(/Example: I checked whether my own experience/)).toBeInTheDocument();
    fireEvent.click(start);
    expect(screen.getByRole('textbox', { name: 'Journal note' })).toHaveFocus();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('rejects a malformed journal without making up an empty journal', async () => {
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    await screen.findByRole('button', { name: 'Save Settings' });
    client.get.mockResolvedValueOnce(response({}));
    fireEvent.click(screen.getByRole('button', { name: 'Reflexivity Journal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load journal entries');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Start a journal note' })).not.toBeInTheDocument());
  });

  it('late settings from another study cannot replace the current study', async () => {
    let resolveOld!: (value: unknown) => void;
    client.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const view = render(<EthicsCompliancePanel onClose={vi.fn()} />);
    current.canvas = { id: 'new-study', name: 'New study', transcripts: [] };
    client.get.mockResolvedValue(response({ ...settings, ethicsApprovalId: 'CURRENT' }));
    view.rerender(<EthicsCompliancePanel onClose={vi.fn()} />);
    await screen.findByDisplayValue('CURRENT');
    await act(async () => {
      resolveOld(response({ ...settings, ethicsApprovalId: 'OLD' }));
    });
    expect(screen.getByDisplayValue('CURRENT')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('OLD')).not.toBeInTheDocument();
  });

  it('retrying a failed journal migration reads without replaying its upload', async () => {
    const legacy = [
      { id: 'old-note', date: '2026-10-07T00:00:00Z', content: 'Fictional legacy reflection', category: 'reflection' },
    ];
    localStorage.setItem('canvas-journal-fictional-ethics', JSON.stringify(legacy));
    client.post.mockRejectedValue(new Error('unknown upload outcome'));
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reflexivity Journal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load journal entries');
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('canvas-journal-fictional-ethics')).toBe(JSON.stringify(legacy));
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading journal entries' }));
    await screen.findByRole('button', { name: 'Start a journal note' });
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('canvas-journal-fictional-ethics')).toBe(JSON.stringify(legacy));
  });

  it('preserves the last verified audit page when a refresh fails', async () => {
    const entry = {
      id: 'audit-1',
      timestamp: '2026-10-07T00:00:00Z',
      action: 'coding.create',
      resource: 'coding',
      actorId: 'fictional-actor',
      meta: 'Fictional verified detail',
    };
    client.get.mockImplementation(async (url: string) =>
      response(url.startsWith('/audit-log') ? { entries: [entry] } : settings),
    );
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Audit Trail' }));
    expect(await screen.findByText('Fictional verified detail')).toBeInTheDocument();
    client.get.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: /^Filter$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the audit trail');
    expect(screen.getByText('Fictional verified detail')).toBeInTheDocument();
    expect(screen.getByText('fictional-actor')).toBeInTheDocument();
    const auditRegion = screen.getByRole('region', { name: 'Audit records' });
    expect(auditRegion).toHaveAttribute('tabindex', '0');
    auditRegion.focus();
    expect(auditRegion).toHaveFocus();
    expect(screen.queryByText('No recorded activity matches these filters.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Audit Log' })).toBeDisabled();
  });

  it('keeps legacy notes when an upload receives a negative acknowledgement', async () => {
    const legacy = [
      {
        id: 'legacy-negative',
        date: '2026-10-07T00:00:00Z',
        content: 'Fictional retained note',
        category: 'reflection',
      },
    ];
    localStorage.setItem('canvas-journal-fictional-ethics', JSON.stringify(legacy));
    client.post.mockResolvedValue({ data: { success: false, data: {} } });
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reflexivity Journal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load journal entries');
    expect(localStorage.getItem('canvas-journal-fictional-ethics')).toBe(JSON.stringify(legacy));
  });

  it('keeps legacy notes until a post-upload read verifies their persistence', async () => {
    const legacy = [
      {
        id: 'legacy-refresh',
        date: '2026-10-07T00:00:00Z',
        content: 'Fictional unconfirmed note',
        category: 'reflection',
      },
    ];
    localStorage.setItem('canvas-journal-fictional-ethics', JSON.stringify(legacy));
    let journalReads = 0;
    client.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/journal') && ++journalReads > 1) throw new Error('refresh unavailable');
      return response(url.endsWith('/ethics') ? settings : []);
    });
    client.post.mockResolvedValue(response({ ...legacy[0], id: 'server-note', createdAt: legacy[0].date }));
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reflexivity Journal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load journal entries');
    expect(localStorage.getItem('canvas-journal-fictional-ethics')).toBe(JSON.stringify(legacy));
  });

  it('does not publish records from a negative acknowledgement', async () => {
    client.get.mockResolvedValue({ data: { success: false, data: settings } });
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ethics settings');
    expect(screen.queryByRole('button', { name: 'Save Settings' })).not.toBeInTheDocument();
  });

  it('retains legacy notes when an acknowledged upload is absent from the confirmation read', async () => {
    const legacy = [
      { id: 'legacy-missing', date: '2026-10-07T00:00:00Z', content: 'Fictional missing note', category: 'reflection' },
    ];
    localStorage.setItem('canvas-journal-fictional-ethics', JSON.stringify(legacy));
    client.post.mockResolvedValue(response({ ...legacy[0], id: 'server-missing', createdAt: legacy[0].date }));
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reflexivity Journal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load journal entries');
    expect(localStorage.getItem('canvas-journal-fictional-ethics')).toBe(JSON.stringify(legacy));
  });

  it('releases the legacy copy only after the saved notes are verified', async () => {
    const legacy = [
      {
        id: 'legacy-confirmed',
        date: '2026-10-07T00:00:00Z',
        content: 'Fictional confirmed note',
        category: 'reflection',
      },
    ];
    const saved = { ...legacy[0], id: 'server-confirmed', createdAt: legacy[0].date };
    localStorage.setItem('canvas-journal-fictional-ethics', JSON.stringify(legacy));
    let reads = 0;
    client.get.mockImplementation(async (url: string) =>
      response(url.endsWith('/ethics') ? settings : ++reads === 1 ? [] : [saved]),
    );
    client.post.mockResolvedValue(response(saved));
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reflexivity Journal' }));
    expect(await screen.findByText('Fictional confirmed note')).toBeInTheDocument();
    expect(localStorage.getItem('canvas-journal-fictional-ethics')).toBeNull();
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
