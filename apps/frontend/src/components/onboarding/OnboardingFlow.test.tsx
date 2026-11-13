import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingFlow from './OnboardingFlow';

const mocks = vi.hoisted(() => ({
  createCanvas: vi.fn(),
  addTranscript: vi.fn(),
  apiAddTranscript: vi.fn(),
  openCanvas: vi.fn(),
  fetchCanvases: vi.fn(),
  onClose: vi.fn(),
  patchState: vi.fn(),
  trackEvent: vi.fn(),
}));

const PASTED = ['Interviewer: hello', 'P1: I felt supported.'].join(String.fromCharCode(10));

vi.mock('../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      createCanvas: mocks.createCanvas,
      addTranscript: mocks.addTranscript,
      openCanvas: mocks.openCanvas,
      fetchCanvases: mocks.fetchCanvases,
    }),
}));

// The store's addTranscript needs activeCanvasId, which the /canvas route effect
// clears right after openCanvas (the URL has no canvas id yet). The paste path
// must therefore save through the API by canvas id, not through the store.
vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  canvasApi: { addTranscript: (...args: unknown[]) => mocks.apiAddTranscript(...args) },
}));

vi.mock('../../utils/analytics', () => ({ trackEvent: mocks.trackEvent }));

vi.mock('./utils/onboardingState', () => ({
  patchOnboardingState: mocks.patchState,
}));

vi.mock('./Screen1_Personalization', () => ({
  default: ({
    onContinue,
    onSkip,
    onPasteTranscript,
  }: {
    onContinue: (value: unknown) => void;
    onSkip: () => void;
    onPasteTranscript?: (text: string, title?: string) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onPasteTranscript?.(PASTED)}>
        Paste test transcript
      </button>
      <button type="button" onClick={() => onPasteTranscript?.(PASTED, 'Interview 01 - Mary')}>
        Choose test transcript file
      </button>
      <button type="button" onClick={() => onContinue({ researchTopic: 'Study', method: 'interviews' })}>
        Continue test onboarding
      </button>
      <button type="button" onClick={onSkip}>
        Skip test onboarding
      </button>
    </div>
  ),
}));

vi.mock('./Screen2_TemplateGallery', () => ({
  default: ({ onSelect }: { onSelect: (template: null, includeSample: boolean) => void }) => (
    <button type="button" onClick={() => onSelect(null, false)}>
      Choose blank canvas
    </button>
  ),
}));

describe('OnboardingFlow', () => {
  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}</output>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createCanvas.mockResolvedValue({ id: 'canvas-1' });
    mocks.openCanvas.mockResolvedValue(undefined);
    mocks.addTranscript.mockRejectedValue(new Error('No canvas open'));
    mocks.apiAddTranscript.mockResolvedValue({ data: { data: { id: 't-1' } } });
    mocks.patchState.mockResolvedValue(undefined);
  });

  it('stays reachable on a phone: the overlay scrolls and leaves room for the cookie banner', () => {
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={mocks.onClose} />
      </MemoryRouter>,
    );

    const overlay = screen.getByRole('dialog', { name: 'Set up your QualCanvas workspace' })
      .parentElement as HTMLElement;
    // Without overflow-y-auto a dialog taller than the screen cannot be scrolled, so Continue is unreachable.
    expect(overlay.className).toContain('overflow-y-auto');
    // The fixed cookie banner publishes its height; the overlay must keep clear of it.
    expect(overlay.className).toContain('--cookie-consent-height');
  });

  it('records onboarding start only after the visible flow mounts', async () => {
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={mocks.onClose} />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.trackEvent).toHaveBeenCalledWith('onboarding_started', { step: 1 }));
    expect(mocks.patchState).toHaveBeenCalledWith(
      expect.objectContaining({ currentStep: 1, startedAt: expect.any(String) }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Set up your QualCanvas workspace' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('creates and opens a canvas when the user chooses the blank starting point', async () => {
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={mocks.onClose} />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue test onboarding' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose blank canvas' }));

    await waitFor(() => expect(mocks.createCanvas).toHaveBeenCalledWith('Study'));
    expect(mocks.openCanvas).toHaveBeenCalledWith('canvas-1');
    expect(mocks.patchState).toHaveBeenCalledWith(
      expect.objectContaining({ completionMode: 'setup_finished', flowDismissed: false }),
    );
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/canvas/canvas-1'));
  });

  it('opens a canvas with the pasted transcript so the first code needs no template', async () => {
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={mocks.onClose} />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Paste test transcript' }));

    await waitFor(() => expect(mocks.apiAddTranscript).toHaveBeenCalledTimes(1));
    expect(mocks.createCanvas).toHaveBeenCalledWith('My first project');
    expect(mocks.apiAddTranscript).toHaveBeenCalledWith('canvas-1', { title: 'My transcript', content: PASTED });
    expect(mocks.addTranscript).not.toHaveBeenCalled();
    expect(mocks.patchState).toHaveBeenCalledWith(expect.objectContaining({ completionMode: 'setup_finished' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/canvas/canvas-1'));
  });

  it('names the first transcript after the chosen file', async () => {
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={mocks.onClose} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose test transcript file' }));
    await waitFor(() =>
      expect(mocks.apiAddTranscript).toHaveBeenCalledWith('canvas-1', {
        title: 'Interview 01 - Mary',
        content: PASTED,
      }),
    );
  });

  it('keeps the pasted text and stays on screen when the transcript cannot be saved', async () => {
    mocks.apiAddTranscript.mockRejectedValueOnce(new Error('boom'));
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={mocks.onClose} />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Paste test transcript' }));

    await waitFor(() => expect(mocks.apiAddTranscript).toHaveBeenCalledTimes(1));
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('persists an intentional skip as a resumable dismissal', async () => {
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={mocks.onClose} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skip test onboarding' }));

    await waitFor(() => expect(mocks.onClose).toHaveBeenCalledTimes(1));
    expect(mocks.patchState).toHaveBeenCalledWith(
      expect.objectContaining({
        completionMode: 'dismissed',
        flowDismissed: true,
        completedAtClient: expect.any(String),
      }),
    );
    expect(mocks.createCanvas).not.toHaveBeenCalled();
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
  });

  it('treats Escape as an intentional persisted skip', async () => {
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={mocks.onClose} />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(mocks.onClose).toHaveBeenCalledTimes(1));
    expect(mocks.patchState).toHaveBeenCalledWith(
      expect.objectContaining({
        completionMode: 'dismissed',
        flowDismissed: true,
        completedAtClient: expect.any(String),
      }),
    );
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
  });
});
