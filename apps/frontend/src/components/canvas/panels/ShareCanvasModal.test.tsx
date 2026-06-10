import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Use vi.hoisted for mock state
const { mockCanvasApi, mockToast } = vi.hoisted(() => ({
  mockCanvasApi: {
    getShares: vi.fn(),
    shareCanvas: vi.fn(),
    revokeShare: vi.fn(),
    getCollaborators: vi.fn(),
    addCollaborator: vi.fn(),
    removeCollaborator: vi.fn(),
  },
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../services/api', () => ({
  canvasApi: mockCanvasApi,
}));

vi.mock('react-hot-toast', () => ({
  default: mockToast,
}));

vi.mock('../../../stores/canvasStore', () => ({
  useActiveCanvasId: () => 'canvas-1',
}));

// Mock ConfirmDialog
vi.mock('../ConfirmDialog', () => ({
  default: ({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) => (
    <div data-testid="confirm-dialog">
      <p>{title}</p>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel Dialog</button>
    </div>
  ),
}));

import ShareCanvasModal from './ShareCanvasModal';

const sampleShares = [
  {
    id: 'share-1',
    canvasId: 'canvas-1',
    shareCode: 'ABC123',
    cloneCount: 3,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'share-2',
    canvasId: 'canvas-1',
    shareCode: 'DEF456',
    cloneCount: 0,
    createdAt: '2026-02-01T10:00:00Z',
  },
];

describe('ShareCanvasModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty shares + collaborators
    mockCanvasApi.getShares.mockResolvedValue({ data: { data: [] } });
    mockCanvasApi.getCollaborators.mockResolvedValue({ data: { data: [] } });
  });

  it('renders share dialog with title', async () => {
    render(<ShareCanvasModal onClose={onClose} />);

    expect(screen.getByText('Share Canvas')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockCanvasApi.getShares).toHaveBeenCalledWith('canvas-1');
    });
  });

  it('shows "Generate Share Code" button', () => {
    render(<ShareCanvasModal onClose={onClose} />);
    expect(screen.getByText('Generate Share Code')).toBeInTheDocument();
  });

  it('displays existing share codes', async () => {
    mockCanvasApi.getShares.mockResolvedValue({ data: { data: sampleShares } });

    render(<ShareCanvasModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeInTheDocument();
      expect(screen.getByText('DEF456')).toBeInTheDocument();
    });
  });

  it('copy button copies code to clipboard', async () => {
    mockCanvasApi.getShares.mockResolvedValue({ data: { data: sampleShares } });
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<ShareCanvasModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByTitle('Copy to clipboard');
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABC123');
      expect(mockToast.success).toHaveBeenCalledWith('Copied to clipboard');
    });
  });

  it('revoke button triggers confirm dialog and removes share code', async () => {
    mockCanvasApi.getShares.mockResolvedValue({ data: { data: sampleShares } });
    mockCanvasApi.revokeShare.mockResolvedValue({});

    render(<ShareCanvasModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeInTheDocument();
    });

    // Click the revoke button for the first share
    const revokeButtons = screen.getAllByLabelText('Revoke share code');
    fireEvent.click(revokeButtons[0]);

    // Confirm dialog should appear
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

    // Confirm revocation
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockCanvasApi.revokeShare).toHaveBeenCalledWith('canvas-1', 'share-1');
    });
  });

  it('shows clone count for each code', async () => {
    mockCanvasApi.getShares.mockResolvedValue({ data: { data: sampleShares } });

    render(<ShareCanvasModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('3 clones')).toBeInTheDocument();
      expect(screen.getByText('0 clones')).toBeInTheDocument();
    });
  });

  it('Close button closes modal', async () => {
    render(<ShareCanvasModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('empty state when no share codes exist', async () => {
    mockCanvasApi.getShares.mockResolvedValue({ data: { data: [] } });

    render(<ShareCanvasModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('No share codes yet')).toBeInTheDocument();
    });
  });

  it('invites a coder by email', async () => {
    mockCanvasApi.addCollaborator.mockResolvedValue({ data: { data: { userId: 'u2' } } });

    render(<ShareCanvasModal onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Coder's email address"), {
      target: { value: 'colleague@uni.edu' },
    });
    fireEvent.click(screen.getByText('Invite'));

    await waitFor(() => {
      expect(mockCanvasApi.addCollaborator).toHaveBeenCalledWith('canvas-1', {
        email: 'colleague@uni.edu',
        role: 'editor',
      });
      expect(mockToast.success).toHaveBeenCalled();
    });
    // List reloads after a successful invite
    expect(mockCanvasApi.getCollaborators).toHaveBeenCalledTimes(2);
  });

  it('surfaces the server message when the invited email has no account', async () => {
    mockCanvasApi.addCollaborator.mockRejectedValue({
      response: { data: { error: 'No QualCanvas account found with that email.' } },
    });

    render(<ShareCanvasModal onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Coder's email address"), {
      target: { value: 'nobody@uni.edu' },
    });
    fireEvent.click(screen.getByText('Invite'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('No QualCanvas account found with that email.');
    });
  });

  it('lists collaborators and removes one after confirmation', async () => {
    mockCanvasApi.getCollaborators.mockResolvedValue({
      data: {
        data: [{ id: 'c1', userId: 'u2', role: 'editor', userName: 'Jody P', userEmail: 'jody@uni.edu' }],
      },
    });
    mockCanvasApi.removeCollaborator.mockResolvedValue({});

    render(<ShareCanvasModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Jody P')).toBeInTheDocument();
      expect(screen.getByText('jody@uni.edu')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Remove coder Jody P'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockCanvasApi.removeCollaborator).toHaveBeenCalledWith('canvas-1', 'u2');
    });
  });
});
