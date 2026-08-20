import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingChecklist from './OnboardingChecklist';
import { useUIStore } from '../../stores/uiStore';

/**
 * The "Export your codings to CSV" row used to read a browser-wide
 * localStorage bit (`qualcanvas-first-export`). A brand-new account on a
 * browser where anyone had ever exported saw the task already ticked - and
 * because the card collapses as soon as one task is done, the whole
 * activation checklist started collapsed for a user who had done nothing.
 */

const mocks = vi.hoisted(() => ({
  activeCanvas: {
    id: 'canvas-1',
    name: 'Study',
    codings: [] as unknown[],
    questions: [] as unknown[],
    computedNodes: [] as unknown[],
  },
  plan: 'free',
}));

vi.mock('../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ activeCanvas: mocks.activeCanvas }),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) => selector({ plan: mocks.plan }),
}));

vi.mock('../../hooks/useMobile', () => ({ useMobile: () => false }));

function renderChecklist() {
  return render(
    <MemoryRouter>
      <OnboardingChecklist />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useUIStore.setState({
    onboardingOwnerId: 'user-b',
    onboardingChecklistDismissed: false,
    onboardingChecklistComplete: [],
  });
});

describe('OnboardingChecklist export task', () => {
  it('is not ticked for a fresh account on a browser where someone else exported', () => {
    // Left behind by a different account on this machine.
    localStorage.setItem('qualcanvas-first-export', new Date().toISOString());

    renderChecklist();

    expect(screen.getByText('0 of 5 complete')).toBeTruthy();
    // Nothing done means the card stays expanded.
    expect(screen.getByText('Code your first excerpt')).toBeTruthy();
  });

  it('is ticked once this account has exported', () => {
    useUIStore.setState({ onboardingChecklistComplete: ['export-csv'] });

    renderChecklist();

    expect(screen.getByText('1 of 5 complete')).toBeTruthy();
  });
});
