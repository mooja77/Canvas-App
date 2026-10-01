import { act, fireEvent, render, screen } from '@testing-library/react';
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
    transcripts: [] as unknown[],
    questions: [] as unknown[],
    computedNodes: [] as unknown[],
  },
  plan: 'free',
  mobile: false,
}));

vi.mock('../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ activeCanvas: mocks.activeCanvas }),
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) => selector({ plan: mocks.plan }),
}));

vi.mock('../../hooks/useMobile', () => ({ useMobile: () => mocks.mobile }));
vi.mock('./utils/onboardingState', () => ({ patchOnboardingState: vi.fn().mockResolvedValue(undefined) }));

function renderChecklist() {
  return render(
    <MemoryRouter>
      <OnboardingChecklist />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.activeCanvas.transcripts = [];
  mocks.activeCanvas.codings = [];
  mocks.activeCanvas.questions = [];
  mocks.activeCanvas.computedNodes = [];
  mocks.mobile = false;
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
    expect(screen.getByText('Add your first transcript')).toBeTruthy();
    expect(screen.getByText('Code your first excerpt')).toBeTruthy();
  });

  it('is ticked once this account has exported', () => {
    useUIStore.setState({ onboardingChecklistComplete: ['export-csv'] });

    renderChecklist();

    expect(screen.getByText('1 of 5 complete')).toBeTruthy();
  });

  it('counts a transcript as the first activation step and keeps valid sibling controls', () => {
    mocks.activeCanvas.transcripts = [{ id: 'transcript-1' }];

    const { container } = renderChecklist();

    expect(screen.getByText('1 of 5 complete')).toBeTruthy();
    expect(container.querySelector('button button')).toBeNull();
  });

  it('opens the real transcript picker from the first task', () => {
    const listener = vi.fn();
    window.addEventListener('qualcanvas:open-transcript-picker', listener);
    renderChecklist();

    fireEvent.click(screen.getByRole('button', { name: 'Add your first transcript' }));

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('qualcanvas:open-transcript-picker', listener);
  });
});

describe('OnboardingChecklist as a setup guide', () => {
  it('can be restored after dismissal without remounting the canvas', () => {
    renderChecklist();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss checklist' }));
    expect(screen.queryByRole('progressbar', { name: 'Setup progress' })).toBeNull();

    // The Help menu calls this store action while the checklist component is
    // still mounted. A stale component-local dismissed flag hid it forever.
    act(() => useUIStore.getState().resumeOnboardingChecklist());
    expect(screen.getByRole('progressbar', { name: 'Setup progress' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('button', { name: 'Add your first transcript' })).toBeVisible();
  });

  it('keeps the first-value guide in the page flow on phones', () => {
    mocks.mobile = true;
    const { container } = renderChecklist();
    expect(screen.getByRole('progressbar', { name: 'Setup progress' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add your first transcript' })).toBeTruthy();
    expect(container.firstElementChild?.className).toContain('relative');
    expect(container.firstElementChild?.className).not.toContain('fixed');
  });
  it('shows progress as an accessible progress bar', () => {
    mocks.activeCanvas.transcripts = [{ id: 't1' }];
    renderChecklist();
    const bar = screen.getByRole('progressbar', { name: 'Setup progress' });
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe('5');
  });

  it('announces auto-completed progress politely without moving keyboard focus', () => {
    const { rerender } = renderChecklist();
    const announcement = screen.getByRole('status');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
    expect(announcement).toHaveAttribute('aria-atomic', 'true');
    expect(announcement).toHaveTextContent('0 of 5 complete');
    const dismiss = screen.getByRole('button', { name: 'Dismiss checklist' });
    dismiss.focus();

    mocks.activeCanvas = { ...mocks.activeCanvas, transcripts: [{ id: 'own-transcript' }] };
    rerender(
      <MemoryRouter>
        <OnboardingChecklist />
      </MemoryRouter>,
    );

    expect(announcement).toHaveTextContent('1 of 5 complete');
    expect(dismiss).toHaveFocus();
  });

  it('does not tick the codes step for codes a starter template seeded', () => {
    // A template canvas: five seeded codes, sample codings on two of them.
    mocks.activeCanvas.questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }];
    mocks.activeCanvas.transcripts = [{ id: 's1', sourceType: 'sample' }];
    mocks.activeCanvas.codings = [
      { id: 'c1', questionId: 'q1', transcriptId: 's1', source: 'sample' },
      { id: 'c2', questionId: 'q2', transcriptId: 's1', source: 'sample' },
    ];
    renderChecklist();
    expect(screen.getByText('0 of 5 complete')).toBeTruthy();
  });

  it("does not count manually coding a sample transcript as the researcher's own work", () => {
    mocks.activeCanvas.transcripts = [{ id: 'sample-1', sourceType: 'sample' }];
    mocks.activeCanvas.codings = [{ id: 'c1', questionId: 'q1', transcriptId: 'sample-1', source: 'human' }];
    renderChecklist();
    expect(screen.getByText('0 of 5 complete')).toBeTruthy();
  });

  it('ticks the codes step once the researcher has used two different codes', () => {
    mocks.activeCanvas.transcripts = [{ id: 't1' }];
    mocks.activeCanvas.codings = [
      { id: 'c1', questionId: 'q1', transcriptId: 't1', source: 'human' },
      { id: 'c2', questionId: 'q2', transcriptId: 't1', source: 'human' },
    ];
    renderChecklist();
    // transcript + first excerpt + two codes
    expect(screen.getByText('3 of 5 complete')).toBeTruthy();
  });

  it('does not claim an analysis was run merely because an empty analysis node exists', () => {
    mocks.activeCanvas.computedNodes = [{ id: 'analysis-1', result: {} }];
    renderChecklist();
    expect(screen.getByText('0 of 5 complete')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Run an analysis/ })).toBeVisible();
  });

  it('detects an analysis result returned by the server, including a valid empty result set', () => {
    mocks.activeCanvas.computedNodes = [{ id: 'analysis-1', result: { words: [] } }];
    renderChecklist();
    expect(screen.getByText('1 of 5 complete')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Run an analysis/ })).toBeNull();
  });

  it('deep-links every unfinished step to where the work happens', () => {
    mocks.activeCanvas.transcripts = [{ id: 't1' }];
    const events: string[] = [];
    const record = (e: Event) => events.push(`${e.type}:${JSON.stringify((e as CustomEvent).detail ?? null)}`);
    const names = ['qualcanvas:focus-node', 'qualcanvas:open-analyze-menu', 'qualcanvas:open-canvas-modal'];
    names.forEach((n) => window.addEventListener(n, record));

    renderChecklist();
    fireEvent.click(screen.getByRole('button', { name: /Code your first excerpt/ }));
    fireEvent.click(screen.getByRole('button', { name: /Use 2 different codes/ }));
    fireEvent.click(screen.getByRole('button', { name: /Run an analysis/ }));
    fireEvent.click(screen.getByRole('button', { name: /Export your codings/ }));

    names.forEach((n) => window.removeEventListener(n, record));
    expect(events).toEqual([
      'qualcanvas:focus-node:{"nodeId":"transcript-t1"}',
      'qualcanvas:focus-node:{"nodeId":"transcript-t1"}',
      'qualcanvas:open-analyze-menu:null',
      'qualcanvas:open-canvas-modal:{"modal":"coded-data"}',
    ]);
  });
});
