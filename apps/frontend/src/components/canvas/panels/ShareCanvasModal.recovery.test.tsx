import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
const { api, state } = vi.hoisted(() => ({
  api: {
    getShares: vi.fn(),
    getCollaborators: vi.fn(),
    shareCanvas: vi.fn(),
    revokeShare: vi.fn(),
    addCollaborator: vi.fn(),
    removeCollaborator: vi.fn(),
  },
  state: { canvasId: 'canvas-a' },
}));
vi.mock('../../../services/api', () => ({ canvasApi: api }));
vi.mock('../../../stores/canvasStore', () => ({ useActiveCanvasId: () => state.canvasId }));
vi.mock('../../../services/seatsApi', () => ({
  seatsApi: { get: vi.fn().mockResolvedValue({ data: { data: null } }) },
  formatMoney: vi.fn(),
}));
vi.mock('../../../hooks/useSeatCharge', () => ({ useSeatCharge: () => ({ withSeat: vi.fn(), seatDialog: null }) }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
import ShareCanvasModal from './ShareCanvasModal';
const row = {
  id: 'share-a',
  canvasId: 'canvas-a',
  shareCode: 'FICTIONAL',
  cloneCount: 0,
  createdAt: '2026-10-07T00:00:00Z',
};
describe('sharing read recovery is truthful', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.canvasId = 'canvas-a';
    api.getShares.mockResolvedValue({ data: { success: true, data: [] } });
    api.getCollaborators.mockResolvedValue({ data: { success: true, data: [] } });
  });
  it('does not invent an empty list on a failed read; Retry only reads', async () => {
    api.getShares.mockRejectedValueOnce(new Error('offline'));
    render(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/Could not load share codes/);
    expect(screen.queryByText('No share codes yet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Share Code' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading share codes' }));
    await screen.findByText('No share codes yet');
    expect(api.getShares).toHaveBeenCalledTimes(2);
    expect(api.shareCanvas).not.toHaveBeenCalled();
  });
  it.each([
    null,
    {},
    [{ ...row, canvasId: 'another-canvas' }],
    [{ ...row, cloneCount: -1 }],
    [{ ...row, createdAt: '1' }],
  ])('rejects malformed or wrong-canvas share data %j', async (data) => {
    api.getShares.mockResolvedValue({ data: { success: true, data } });
    render(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/Could not load share codes/);
    expect(screen.queryByText('No share codes yet')).not.toBeInTheDocument();
    expect(screen.queryByText('FICTIONAL')).not.toBeInTheDocument();
  });
  it('retains invitation entries while failed collaborator reads recover without invitations', async () => {
    api.getCollaborators.mockRejectedValueOnce(new Error('offline'));
    render(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/Could not load collaborators/);
    fireEvent.change(screen.getByLabelText("Coder's email address"), { target: { value: 'fictional@example.com' } });
    expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading collaborators' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Invite' })).toBeEnabled());
    expect(screen.getByLabelText("Coder's email address")).toHaveValue('fictional@example.com');
    expect(api.getCollaborators).toHaveBeenCalledTimes(2);
    expect(api.addCollaborator).not.toHaveBeenCalled();
  });
  it('rejects malformed collaborator roles rather than labelling them coders', async () => {
    api.getCollaborators.mockResolvedValue({
      data: {
        success: true,
        data: [{ id: 'm', userId: 'u', role: ['viewer'], userName: 'Fictional', userEmail: '', canvasId: 'canvas-a' }],
      },
    });
    render(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/Could not load collaborators/);
    expect(screen.queryByText('Fictional')).not.toBeInTheDocument();
  });
  it('rejects a failed envelope even when it contains an array', async () => {
    api.getShares.mockResolvedValue({ data: { success: false, data: [] } });
    render(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/Could not load share codes/);
    expect(screen.queryByText('No share codes yet')).not.toBeInTheDocument();
  });
  it('requires an explicit successful envelope', async () => {
    api.getShares.mockResolvedValue({ data: { data: [] } });
    render(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/Could not load share codes/);
    expect(screen.queryByText('No share codes yet')).not.toBeInTheDocument();
  });
  it('rejects collaborators without the requested canvas identity', async () => {
    api.getCollaborators.mockResolvedValue({
      data: { success: true, data: [{ id: 'm', userId: 'u', role: 'viewer', userName: 'Fictional', userEmail: '' }] },
    });
    render(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/Could not load collaborators/);
    expect(screen.queryByText('Fictional')).not.toBeInTheDocument();
  });
  it('rejects late collaborator reads from the previous canvas', async () => {
    let resolve!: (value: unknown) => void;
    api.getCollaborators.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = render(<ShareCanvasModal onClose={vi.fn()} />);
    state.canvasId = 'canvas-b';
    view.rerender(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/No collaborators yet/);
    await act(async () => {
      resolve({
        data: {
          success: true,
          data: [{ id: 'm', userId: 'u', canvasId: 'canvas-a', role: 'viewer', userName: 'Fictional', userEmail: '' }],
        },
      });
    });
    expect(screen.queryByText('Fictional')).not.toBeInTheDocument();
  });
  it('keeps access choice as well as email during read-only recovery', async () => {
    api.getCollaborators.mockRejectedValueOnce(new Error('offline'));
    render(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/Could not load collaborators/);
    fireEvent.change(screen.getByLabelText('Access level'), { target: { value: 'viewer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading collaborators' }));
    await screen.findByText(/No collaborators yet/);
    expect(screen.getByLabelText('Access level')).toHaveValue('viewer');
    expect(api.addCollaborator).not.toHaveBeenCalled();
    expect(api.removeCollaborator).not.toHaveBeenCalled();
  });
  it('clears invitation fields when selecting another canvas', async () => {
    const view = render(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/No collaborators yet/);
    fireEvent.change(screen.getByLabelText("Coder's email address"), { target: { value: 'fictional@example.com' } });
    fireEvent.change(screen.getByLabelText('Access level'), { target: { value: 'viewer' } });
    state.canvasId = 'canvas-b';
    view.rerender(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText(/No collaborators yet/);
    expect(screen.getByLabelText("Coder's email address")).toHaveValue('');
    expect(screen.getByLabelText('Access level')).toHaveValue('editor');
    expect(api.addCollaborator).not.toHaveBeenCalled();
  });
  it('rejects a late response from a previously selected canvas', async () => {
    let resolve!: (value: unknown) => void;
    api.getShares.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = render(<ShareCanvasModal onClose={vi.fn()} />);
    state.canvasId = 'canvas-b';
    view.rerender(<ShareCanvasModal onClose={vi.fn()} />);
    await screen.findByText('No share codes yet');
    await act(async () => {
      resolve({ data: { success: true, data: [row] } });
    });
    await waitFor(() => expect(api.getShares).toHaveBeenLastCalledWith('canvas-b'));
    expect(screen.queryByText('FICTIONAL')).not.toBeInTheDocument();
  });
});
