import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { getAllowance } = vi.hoisted(() => ({ getAllowance: vi.fn() }));

vi.mock('../../../services/api', () => ({
  canvasApi: {
    getTranscriptionAllowance: getAllowance,
    listTranscriptionJobs: vi.fn().mockResolvedValue({ data: { data: [] } }),
    uploadFileDirect: vi.fn(),
    startTranscription: vi.fn(),
    acceptTranscription: vi.fn(),
  },
}));
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (sel: (s: { refreshCanvas: () => void }) => unknown) => sel({ refreshCanvas: vi.fn() }),
  useActiveCanvasId: () => 'canvas-1',
  useIsViewer: () => false,
}));
vi.mock('../../../hooks/useFocusTrap', () => ({ useFocusTrap: vi.fn() }));
vi.mock('../../../hooks/useEscapeToClose', () => ({ useEscapeToClose: vi.fn() }));
vi.mock('../../../stores/aiConfigStore', () => ({
  useAiConfigStore: (sel: (s: { wizard: { open: boolean }; openWizard: () => void }) => unknown) =>
    sel({ wizard: { open: false }, openWizard: vi.fn() }),
}));

import AudioTranscriptionModal from './AudioTranscriptionModal';

const base = {
  plan: 'free',
  fileUploadEnabled: false,
  audioImportsUsed: 0,
  maxAudioImports: 1,
  maxUploadMb: 25,
  emailAccount: true,
  keySource: 'own' as const,
  isCanvasOwner: true,
  canvasOwnerName: null,
  ownerHasOpenAiKey: true,
  ownerSharesKey: false,
  usageThisMonth: null,
  pricePerMinuteUsd: 0.006,
};

function show(overrides: Record<string, unknown>) {
  getAllowance.mockResolvedValue({ data: { data: { ...base, ...overrides } } });
  render(<AudioTranscriptionModal onClose={vi.fn()} />);
}

describe('AudioTranscriptionModal: Free plan, one recording', () => {
  beforeEach(() => vi.clearAllMocks());

  it('before the recording is used: shows the upload and says one recording is included', async () => {
    show({});
    expect(await screen.findByTestId('audio-trial-note')).toHaveTextContent(/includes 1 recording/i);
    expect(screen.getByRole('button', { name: /choose a recording/i })).toBeEnabled();
    expect(screen.queryByTestId('audio-upgrade-prompt')).toBeNull();
    expect(screen.queryByTestId('transcription-plan-gate')).toBeNull();
  });

  it('after the recording is used: shows a friendly upgrade prompt and no upload', async () => {
    show({ audioImportsUsed: 1 });
    const prompt = await screen.findByTestId('audio-upgrade-prompt');
    expect(prompt).toHaveTextContent(/used the recording included in the Free plan/i);
    expect(prompt).toHaveTextContent(/Student, Pro and Team/);
    expect(screen.getByRole('link', { name: /compare plans/i })).toHaveAttribute('href', '/pricing');
    expect(screen.queryByRole('button', { name: /choose a recording/i })).toBeNull();
    expect(prompt.textContent ?? '').not.toMatch(/refund|guarantee/i);
  });

  it('a paid plan sees no limit and no prompt', async () => {
    show({ plan: 'pro', fileUploadEnabled: true, audioImportsUsed: 9, maxAudioImports: null });
    expect(await screen.findByRole('button', { name: /choose a recording/i })).toBeEnabled();
    await waitFor(() => expect(screen.queryByTestId('audio-upgrade-prompt')).toBeNull());
    expect(screen.queryByTestId('audio-trial-note')).toBeNull();
  });

  it('a plan with no audio at all keeps the existing "not included" panel', async () => {
    show({ maxAudioImports: 0 });
    expect(await screen.findByTestId('transcription-plan-gate')).toBeInTheDocument();
    expect(screen.queryByTestId('audio-upgrade-prompt')).toBeNull();
  });
});
