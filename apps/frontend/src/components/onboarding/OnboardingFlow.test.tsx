import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingFlow from './OnboardingFlow';

const mocks = vi.hoisted(() => ({
  createCanvas: vi.fn(),
  openCanvas: vi.fn(),
  fetchCanvases: vi.fn(),
  onClose: vi.fn(),
  markComplete: vi.fn(),
  patchState: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      createCanvas: mocks.createCanvas,
      openCanvas: mocks.openCanvas,
      fetchCanvases: mocks.fetchCanvases,
    }),
}));

vi.mock('../../utils/analytics', () => ({ trackEvent: mocks.trackEvent }));

vi.mock('./utils/onboardingState', () => ({
  markOnboardingComplete: mocks.markComplete,
  patchOnboardingState: mocks.patchState,
}));

vi.mock('./Screen1_Personalization', () => ({
  default: ({ onContinue, onSkip }: { onContinue: (value: unknown) => void; onSkip: () => void }) => (
    <div>
      <button type="button" onClick={() => onContinue({ researchTopic: 'Study', method: 'interviews', solo: true })}>
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
    mocks.markComplete.mockResolvedValue(undefined);
    mocks.patchState.mockResolvedValue(undefined);
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

    await waitFor(() => expect(mocks.createCanvas).toHaveBeenCalledWith('Untitled research project'));
    expect(mocks.openCanvas).toHaveBeenCalledWith('canvas-1');
    expect(mocks.markComplete).toHaveBeenCalledTimes(1);
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/canvas/canvas-1'));
  });

  it('persists an intentional skip as a completed onboarding decision', async () => {
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={mocks.onClose} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skip test onboarding' }));

    await waitFor(() => expect(mocks.markComplete).toHaveBeenCalledTimes(1));
    expect(mocks.patchState).toHaveBeenCalledWith(
      expect.objectContaining({ completionMode: 'skipped', completedAtClient: expect.any(String) }),
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

    await waitFor(() => expect(mocks.markComplete).toHaveBeenCalledTimes(1));
    expect(mocks.patchState).toHaveBeenCalledWith(
      expect.objectContaining({ completionMode: 'skipped', completedAtClient: expect.any(String) }),
    );
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
  });
});
