import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AudioTranscriptionModal from './AudioTranscriptionModal';

const mockGetAllowance = vi.fn();
const mockListJobs = vi.fn();

vi.mock('../../../services/api', () => ({
  canvasApi: {
    getTranscriptionAllowance: (...args: unknown[]) => mockGetAllowance(...args),
    listTranscriptionJobs: (...args: unknown[]) => mockListJobs(...args),
    uploadFileDirect: vi.fn(),
    startTranscription: vi.fn(),
    acceptTranscription: vi.fn(),
  },
}));

vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (s: { refreshCanvas: () => Promise<void> }) => unknown) =>
    selector({ refreshCanvas: vi.fn().mockResolvedValue(undefined) }),
  useActiveCanvasId: () => 'canvas-1',
  useIsViewer: () => false,
}));

vi.mock('../../../stores/aiConfigStore', () => ({
  useAiConfigStore: (selector: (s: { wizard: { open: boolean }; openWizard: () => void }) => unknown) =>
    selector({ wizard: { open: false }, openWizard: vi.fn() }),
}));

describe('AudioTranscriptionModal Free 10,000-word limit notice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListJobs.mockResolvedValue({ data: { data: [] } });
  });

  it('shows the 10,000-word pre-upload warning for Free plan users', async () => {
    mockGetAllowance.mockResolvedValue({
      data: {
        data: {
          plan: 'free',
          fileUploadEnabled: true,
          maxUploadMb: 25,
          emailAccount: true,
          keySource: 'own',
          isCanvasOwner: true,
          canvasOwnerName: null,
          ownerHasOpenAiKey: true,
          ownerSharesKey: false,
          usageThisMonth: null,
          pricePerMinuteUsd: 0.006,
        },
      },
    });

    render(<AudioTranscriptionModal onClose={vi.fn()} />);

    const note = await screen.findByTestId('free-word-limit-note');
    expect(note).toHaveTextContent(/10,000 words/i);
    expect(note).toHaveTextContent(/trimmed to the first 10,000 words/i);
  });

  it('does not show the Free 10,000-word warning for Pro users', async () => {
    mockGetAllowance.mockResolvedValue({
      data: {
        data: {
          plan: 'pro',
          fileUploadEnabled: true,
          maxUploadMb: 25,
          emailAccount: true,
          keySource: 'own',
          isCanvasOwner: true,
          canvasOwnerName: null,
          ownerHasOpenAiKey: true,
          ownerSharesKey: false,
          usageThisMonth: null,
          pricePerMinuteUsd: 0.006,
        },
      },
    });

    render(<AudioTranscriptionModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Choose a recording' })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('free-word-limit-note')).not.toBeInTheDocument();
  });
});
