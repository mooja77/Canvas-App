import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Use vi.hoisted for mock state
const { mockCanvasApi, mockToast } = vi.hoisted(() => ({
  mockCanvasApi: {
    getShares: vi.fn(),
    shareCanvas: vi.fn(),
    revokeShare: vi.fn(),
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
    // Default: return empty shares
    mockCanvasApi.getShares.mockResolvedValue({ data: { data: [] } });
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
});
