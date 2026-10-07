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

async function inviteWhenReady() {
  // Real users cannot submit until the initial collaborator GET is verified.
  const button = screen.getByRole('button', { name: 'Invite' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

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
    mockCanvasApi.getShares.mockResolvedValue({ data: { success: true, data: [] } });
    mockCanvasApi.getCollaborators.mockResolvedValue({ data: { success: true, data: [] } });
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
    mockCanvasApi.getShares.mockResolvedValue({ data: { success: true, data: sampleShares } });

    render(<ShareCanvasModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('ABC123')).toBeInTheDocument();
      expect(screen.getByText('DEF456')).toBeInTheDocument();
    });
  });

  it('copy button copies code to clipboard', async () => {
    mockCanvasApi.getShares.mockResolvedValue({ data: { success: true, data: sampleShares } });
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
    mockCanvasApi.getShares.mockResolvedValue({ data: { success: true, data: sampleShares } });
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
    mockCanvasApi.getShares.mockResolvedValue({ data: { success: true, data: sampleShares } });

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
    mockCanvasApi.getShares.mockResolvedValue({ data: { success: true, data: [] } });

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
    await inviteWhenReady();

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

  it('a coder that needs a paid seat is only invited after the owner confirms the quoted charge', async () => {
    const quote = {
      currentQuantity: 1,
      newQuantity: 2,
      currency: 'usd',
      unitAmount: 3900,
      interval: 'month',
      dueNow: 1950,
      nextRenewal: 7800,
      hasDiscount: false,
      prorationDate: 1790000000,
      currentPeriodEnd: '2026-11-01T00:00:00.000Z',
    };
    mockCanvasApi.addCollaborator
      .mockRejectedValueOnce({ response: { status: 402, data: { code: 'SEAT_REQUIRED', preview: quote } } })
      .mockResolvedValueOnce({ data: { data: { userId: 'u2' } } });

    render(<ShareCanvasModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Coder's email address"), { target: { value: 'colleague@uni.edu' } });
    await inviteWhenReady();

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Inviting colleague@uni.edu as a coder adds a seat');
    expect(screen.getByTestId('seat-due-now')).toHaveTextContent('$19.50');
    expect(mockToast.success).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add seat and invite' }));
    await waitFor(() =>
      expect(mockCanvasApi.addCollaborator).toHaveBeenLastCalledWith('canvas-1', {
        email: 'colleague@uni.edu',
        role: 'editor',
        confirmSeatCharge: true,
        prorationDate: 1790000000,
      }),
    );
    await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
  });

  // ─── Pro is a one-person plan: a second coder needs Team ───
  const teamRequired = (preview: Record<string, unknown> | null) => ({
    response: {
      status: 402,
      data: {
        code: 'TEAM_REQUIRED',
        upgrade: preview ? 'in_place' : 'checkout',
        seatsNeeded: 2,
        preview,
        error: 'Pro is a one-person plan.',
      },
    },
  });
  const proToTeam = {
    currentQuantity: 1,
    newQuantity: 2,
    currency: 'usd',
    unitAmount: 3900,
    interval: 'month',
    dueNow: 5340,
    nextRenewal: 7800,
    hasDiscount: false,
    prorationDate: 1790000000,
    currentPeriodEnd: '2026-11-01T00:00:00.000Z',
    fromPlan: 'pro',
    toPlan: 'team',
    currentUnitAmount: 1500,
  };

  it('Pro owner adding a coder sees the Team upgrade with today’s and the renewal cost, and nothing is sent until they confirm', async () => {
    mockCanvasApi.addCollaborator
      .mockRejectedValueOnce(teamRequired(proToTeam))
      .mockResolvedValueOnce({ data: { data: { userId: 'u2', role: 'editor' } } });
    render(<ShareCanvasModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Coder's email address"), { target: { value: 'colleague@uni.edu' } });
    await inviteWhenReady();

    const dialog = await screen.findByTestId('team-upgrade-dialog');
    expect(dialog).toHaveTextContent('Pro is a one-person plan');
    expect(screen.getByTestId('team-upgrade-due-now')).toHaveTextContent('$53.40');
    expect(screen.getByTestId('team-upgrade-renewal')).toHaveTextContent('$78.00 / month');
    expect(mockCanvasApi.addCollaborator).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Team' }));
    await waitFor(() =>
      expect(mockCanvasApi.addCollaborator).toHaveBeenLastCalledWith('canvas-1', {
        email: 'colleague@uni.edu',
        role: 'editor',
        confirmTeamUpgrade: true,
        prorationDate: 1790000000,
      }),
    );
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith(expect.stringMatching(/^Coder invited/)));
  });

  it('Pro owner can add the person as a free viewer instead, with no charge', async () => {
    mockCanvasApi.addCollaborator
      .mockRejectedValueOnce(teamRequired(proToTeam))
      .mockResolvedValueOnce({ data: { data: { userId: 'u2', role: 'viewer' } } });
    render(<ShareCanvasModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Coder's email address"), { target: { value: 'colleague@uni.edu' } });
    await inviteWhenReady();
    fireEvent.click(await screen.findByRole('button', { name: 'Add as viewer (free)' }));
    await waitFor(() =>
      expect(mockCanvasApi.addCollaborator).toHaveBeenLastCalledWith('canvas-1', {
        email: 'colleague@uni.edu',
        role: 'viewer',
      }),
    );
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith(expect.stringMatching(/^Viewer invited/)));
  });

  it('a Pro owner without a Stripe subscription is pointed at Team checkout', async () => {
    mockCanvasApi.addCollaborator.mockRejectedValueOnce(teamRequired(null));
    render(<ShareCanvasModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Coder's email address"), { target: { value: 'colleague@uni.edu' } });
    await inviteWhenReady();
    expect(await screen.findByTestId('team-upgrade-checkout')).toHaveTextContent('Team is $39 per seat a month');
    expect(screen.getByRole('link', { name: 'See the Team plan' })).toHaveAttribute('href', '/pricing');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('team-upgrade-dialog')).not.toBeInTheDocument());
    expect(mockCanvasApi.addCollaborator).toHaveBeenCalledTimes(1);
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it('cancelling the seat quote invites nobody', async () => {
    mockCanvasApi.addCollaborator.mockRejectedValueOnce({
      response: {
        status: 402,
        data: {
          code: 'SEAT_REQUIRED',
          preview: {
            currentQuantity: 1,
            newQuantity: 2,
            currency: 'usd',
            unitAmount: 3900,
            interval: 'month',
            dueNow: 100,
            nextRenewal: 7800,
            hasDiscount: false,
            prorationDate: 1,
            currentPeriodEnd: null,
          },
        },
      },
    });
    render(<ShareCanvasModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Coder's email address"), { target: { value: 'c@uni.edu' } });
    await inviteWhenReady();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mockCanvasApi.addCollaborator).toHaveBeenCalledTimes(1);
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('invites a viewer when the Viewer access level is selected', async () => {
    mockCanvasApi.addCollaborator.mockResolvedValue({ data: { data: { userId: 'u3' } } });

    render(<ShareCanvasModal onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Coder's email address"), {
      target: { value: 'supervisor@uni.edu' },
    });
    fireEvent.change(screen.getByLabelText('Access level'), { target: { value: 'viewer' } });
    await inviteWhenReady();

    await waitFor(() => {
      expect(mockCanvasApi.addCollaborator).toHaveBeenCalledWith('canvas-1', {
        email: 'supervisor@uni.edu',
        role: 'viewer',
      });
    });
  });

  it('surfaces the server message when the invited email has no account', async () => {
    mockCanvasApi.addCollaborator.mockRejectedValue({
      response: { data: { error: 'No QualCanvas account found with that email.' } },
    });

    render(<ShareCanvasModal onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Coder's email address"), {
      target: { value: 'nobody@uni.edu' },
    });
    await inviteWhenReady();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('No QualCanvas account found with that email.');
    });
  });

  it('lists collaborators and removes one after confirmation', async () => {
    mockCanvasApi.getCollaborators.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'c1',
            canvasId: 'canvas-1',
            userId: 'u2',
            role: 'editor',
            userName: 'Jody P',
            userEmail: 'jody@uni.edu',
          },
        ],
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
