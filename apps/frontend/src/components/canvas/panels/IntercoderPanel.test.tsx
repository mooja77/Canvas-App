import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { mockCanvasApi, mockToast, mockState } = vi.hoisted(() => ({
  mockCanvasApi: {
    getCollaborators: vi.fn(),
    computeMultiCoderAgreement: vi.fn(),
  },
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockState: {
    // Mutable per-test fixtures.
    activeCanvas: null as unknown,
    auth: { userId: 'user-me', email: 'me@example.com' },
  },
}));

vi.mock('../../../services/api', () => ({ canvasApi: mockCanvasApi }));
vi.mock('react-hot-toast', () => ({ default: mockToast }));
vi.mock('../../../hooks/useEscapeToClose', () => ({ useEscapeToClose: () => {} }));
vi.mock('../../../stores/canvasStore', () => ({
  useActiveCanvas: () => mockState.activeCanvas,
}));
vi.mock('../../../stores/authStore', () => ({
  // The component reads the store through selectors.
  useAuthStore: (selector: (s: typeof mockState.auth) => unknown) => selector(mockState.auth),
}));

import IntercoderPanel from './IntercoderPanel';

const canvas = (overrides: Record<string, unknown> = {}) => ({
  id: 'canvas-1',
  name: 'Study',
  transcripts: [{ id: 't1', title: 'Interview 1' }],
  researchParadigm: null,
  // The API spreads the canvas row, so the owner's user id is on the payload.
  userId: 'user-owner',
  myRole: 'owner',
  ...overrides,
});

describe('IntercoderPanel coder roster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.activeCanvas = canvas();
    mockState.auth = { userId: 'user-me', email: 'me@example.com' };
    mockCanvasApi.getCollaborators.mockResolvedValue({ data: { data: [] } });
  });

  it('does not offer a Viewer collaborator as a selectable coder', async () => {
    mockCanvasApi.getCollaborators.mockResolvedValue({
      data: {
        data: [
          { id: 'collab-1', userId: 'user-coder', role: 'editor', userName: 'Ada Coder', userEmail: 'ada@x.com' },
          { id: 'collab-2', userId: 'user-viewer', role: 'viewer', userName: 'Vic Viewer', userEmail: 'vic@x.com' },
        ],
      },
    });

    render(<IntercoderPanel onClose={() => {}} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Ada Coder/ })).toBeInTheDocument());

    // Ada is a real coder and must be selectable.
    expect(screen.getByRole('button', { name: /Ada Coder/ })).not.toBeDisabled();

    // Vic can never hold a coding, so must not be offered as a coder. Either
    // absent entirely, or present but explicitly unselectable.
    const vic = screen.queryByRole('button', { name: /Vic Viewer/ });
    if (vic) expect(vic).toBeDisabled();
  });

  it('includes the canvas owner in the roster for an invited coder', async () => {
    // The signed-in user is an invited editor, not the owner.
    mockState.auth = { userId: 'user-me', email: 'me@example.com' };
    mockState.activeCanvas = canvas({ myRole: 'editor', userId: 'user-owner' });
    mockCanvasApi.getCollaborators.mockResolvedValue({
      data: {
        data: [{ id: 'collab-1', userId: 'user-me', role: 'editor', userName: 'Me', userEmail: 'me@example.com' }],
      },
    });

    render(<IntercoderPanel onClose={() => {}} />);

    // "You" plus the owner = two selectable coders, so the panel must not
    // claim there is no second coder on the canvas.
    await waitFor(() => expect(screen.queryByText(/You need a second coder on this canvas/)).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /owner/i })).toBeInTheDocument();
  });

  it('still tells a lone owner they need a second coder', async () => {
    mockState.auth = { userId: 'user-owner', email: 'owner@example.com' };
    mockState.activeCanvas = canvas({ myRole: 'owner', userId: 'user-owner' });

    render(<IntercoderPanel onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText(/You need a second coder on this canvas/)).toBeInTheDocument());
    // The owner must not be duplicated as a separate chip alongside "You".
    expect(screen.getAllByRole('button', { name: /^You$/ })).toHaveLength(1);
  });
});
