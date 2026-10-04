import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '../../../stores/uiStore';
import HelpMenu from './HelpMenu';
import { patchOnboardingState } from '../../onboarding/utils/onboardingState';

vi.mock('../../onboarding/utils/onboardingState', () => ({
  patchOnboardingState: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({ onboardingV2Complete: false, onboardingChecklistDismissed: true });
});

describe('HelpMenu quick setup', () => {
  it('gives the existing Help trigger and every help action readable touch targets', () => {
    render(<HelpMenu onShowShortcuts={vi.fn()} />);
    const help = screen.getByRole('button', { name: 'Help' });
    expect(help).toHaveClass('min-h-11', 'min-w-11', 'text-xs');
    fireEvent.click(help);
    for (const action of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
      expect(action).toHaveClass('min-h-11', 'min-w-11');
    }
    expect(patchOnboardingState).not.toHaveBeenCalled();
  });

  it('restores a completed account’s guide without reopening the first-run wizard', () => {
    useUIStore.setState({ onboardingV2Complete: true });
    const resumeFlow = vi.fn();
    window.addEventListener('qualcanvas:resume-onboarding', resumeFlow);
    render(<HelpMenu onShowShortcuts={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume quick setup' }));

    expect(useUIStore.getState().onboardingChecklistDismissed).toBe(false);
    expect(patchOnboardingState).toHaveBeenCalledWith({ checklistDismissed: false });
    expect(resumeFlow).not.toHaveBeenCalled();
    window.removeEventListener('qualcanvas:resume-onboarding', resumeFlow);
  });

  it('reopens the first-run wizard only when it is unfinished', () => {
    const resumeFlow = vi.fn();
    window.addEventListener('qualcanvas:resume-onboarding', resumeFlow);
    render(<HelpMenu onShowShortcuts={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume quick setup' }));

    expect(patchOnboardingState).toHaveBeenCalledWith({ checklistDismissed: false, flowDismissed: false });
    expect(resumeFlow).toHaveBeenCalledOnce();
    window.removeEventListener('qualcanvas:resume-onboarding', resumeFlow);
  });

  it('opens the short captioned first-code lesson from point-of-need help', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<HelpMenu onShowShortcuts={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('button', { name: /Code your first passage \(89s, captioned\)/ }));

    expect(open).toHaveBeenCalledWith('/help/first-code.html', '_blank', 'noopener');
    open.mockRestore();
  });
});
