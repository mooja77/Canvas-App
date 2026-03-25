import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import UpgradePrompt from './UpgradePrompt';

function dispatchPlanLimitEvent(detail = {
  error: 'You have reached the maximum number of canvases on the Free plan.',
  code: 'CANVAS_LIMIT',
  limit: 'canvases',
  current: 1,
  max: 1,
  upgrade: true,
}) {
  const event = new CustomEvent('plan-limit-exceeded', { detail });
  window.dispatchEvent(event);
}

describe('UpgradePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('does not render when no upgrade event has fired', () => {
    render(<UpgradePrompt />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders when plan limit event is dispatched', () => {
    render(<UpgradePrompt />);

    act(() => { dispatchPlanLimitEvent(); });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Plan Limit Reached')).toBeInTheDocument();
  });

  it('shows the error message from the event detail', () => {
    render(<UpgradePrompt />);

    act(() => {
      dispatchPlanLimitEvent({
        error: 'You have used all 5 codes on the Free plan.',
        code: 'CODE_LIMIT',
        limit: 'codes',
        current: 5,
        max: 5,
        upgrade: true,
      });
    });

    expect(screen.getByText('You have used all 5 codes on the Free plan.')).toBeInTheDocument();
  });

  it('View Plans button navigates to pricing page', () => {
    render(<UpgradePrompt />);

    act(() => { dispatchPlanLimitEvent(); });

    fireEvent.click(screen.getByText('View Plans'));
    expect(mockNavigate).toHaveBeenCalledWith('/pricing');
  });

  it('Maybe Later button closes the prompt', () => {
    render(<UpgradePrompt />);

    act(() => { dispatchPlanLimitEvent(); });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Maybe Later'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('has role="alertdialog" for accessibility', () => {
    render(<UpgradePrompt />);

    act(() => { dispatchPlanLimitEvent(); });

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('close button (X) dismisses the prompt', () => {
    render(<UpgradePrompt />);

    act(() => { dispatchPlanLimitEvent(); });

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('Escape key closes the dialog', () => {
    render(<UpgradePrompt />);

    act(() => { dispatchPlanLimitEvent(); });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
