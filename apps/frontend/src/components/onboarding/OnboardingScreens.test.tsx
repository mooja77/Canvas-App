import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingFlow from './OnboardingFlow';
import Screen2_TemplateGallery from './Screen2_TemplateGallery';

const mocks = vi.hoisted(() => ({
  createCanvas: vi.fn(),
  openCanvas: vi.fn(),
  fetchCanvases: vi.fn(),
  list: vi.fn(),
  instantiate: vi.fn(),
  patchState: vi.fn(),
}));
vi.mock('../../services/api', () => ({ templateApi: { list: mocks.list, instantiate: mocks.instantiate } }));
vi.mock('../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mocks),
}));
vi.mock('../../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('./utils/onboardingState', () => ({ patchOnboardingState: mocks.patchState }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe('real onboarding screens', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.list.mockResolvedValue({ data: { data: [] } });
    mocks.patchState.mockResolvedValue(undefined);
    mocks.openCanvas.mockResolvedValue(undefined);
  });

  it('locks navigation and sample choices only while a selection is pending', async () => {
    let resolve!: () => void;
    const selection = new Promise<void>((done) => {
      resolve = done;
    });
    render(
      <Screen2_TemplateGallery
        preferredMethod="interviews"
        onSelect={() => selection}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Blank canvas/ }));
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Include sample data' })).toBeDisabled();
    await act(async () => {
      resolve();
      await selection;
    });
    expect(screen.getByRole('button', { name: /Blank canvas/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Include sample data' })).toBeEnabled();
  });

  it('handles a rejected selection with an actionable inline error', async () => {
    render(
      <Screen2_TemplateGallery
        preferredMethod="interviews"
        onSelect={async () => {
          throw new Error('offline');
        }}
        onBack={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Blank canvas/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i);
    expect(screen.getByRole('button', { name: /Blank canvas/ })).toBeEnabled();
  });

  it('lets the user retry successfully after the parent handles a creation failure', async () => {
    mocks.createCanvas.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ id: 'retry-canvas' });
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={onClose} initialState={{ currentStep: 2 }} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Blank canvas/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Blank canvas/ })).toBeEnabled());
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Blank canvas/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.openCanvas).toHaveBeenCalledWith('retry-canvas');
  });

  it.each([1, 2])('restores saved topic and method when resuming step %s', async (currentStep) => {
    render(
      <MemoryRouter>
        <OnboardingFlow
          onClose={vi.fn()}
          initialState={{
            currentStep,
            personalization: { researchTopic: 'Patient experience', method: 'field_notes' },
          }}
        />
      </MemoryRouter>,
    );
    if (currentStep === 2) fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('textbox', { name: /What are you researching/ })).toHaveValue('Patient experience');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(mocks.patchState).toHaveBeenCalledWith(
      expect.objectContaining({ personalization: { researchTopic: 'Patient experience', method: 'field_notes' } }),
    );
  });

  it('preserves edited answers when returning from the gallery', async () => {
    render(
      <MemoryRouter>
        <OnboardingFlow onClose={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /What are you researching/ }), {
      target: { value: 'Community wellbeing' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Focus groups' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('textbox', { name: /What are you researching/ })).toHaveValue('Community wellbeing');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(mocks.patchState).toHaveBeenLastCalledWith(
      expect.objectContaining({ personalization: { researchTopic: 'Community wellbeing', method: 'focus_groups' } }),
    );
  });
});
