import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Backend is the source of truth for what each tier may create. Import it so
// these tests fail the moment the menu's mirror drifts — the same guard
// config/planLimits.test.ts puts on the numeric caps.
import { PLAN_LIMITS, featureAvailabilityMessage, type PlanTier } from '../../../../../backend/src/config/plans';

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

const addComputedNode = vi.fn();
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (s: { addComputedNode: typeof addComputedNode }) => unknown) =>
    selector({ addComputedNode }),
}));

const authState = { effectivePlan: 'free' as string | null, plan: null as string | null };
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

// Render the popover contents inline so the menu items are queryable.
vi.mock('../primitives/CollisionPopover', () => ({
  CollisionPopover: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <>{children}</> : null,
}));

import AddComputedNodeMenu, {
  ANALYSIS_TYPES_BY_PLAN,
  plansWithAnalysis,
  planAvailabilityMessage,
} from './AddComputedNodeMenu';

const TIERS: PlanTier[] = ['free', 'student', 'pro', 'team'];

/** The six tools the audit measured as dead ends on Free. */
const FREE_LOCKED = ['cooccurrence', 'codingquery', 'cluster', 'matrix', 'comparison', 'treemap'];

function openMenu() {
  render(<AddComputedNodeMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Analyze menu' }));
}

describe('AddComputedNodeMenu — plan mirror stays in step with the backend', () => {
  it.each(TIERS)('lists exactly the analysis types the backend allows for %s', (tier) => {
    expect([...ANALYSIS_TYPES_BY_PLAN[tier]].sort()).toEqual([...PLAN_LIMITS[tier].allowedAnalysisTypes].sort());
  });

  it('produces the same refusal sentence the 403 would carry', () => {
    for (const type of PLAN_LIMITS.student.allowedAnalysisTypes) {
      expect(planAvailabilityMessage(`${type} analysis`, plansWithAnalysis(type))).toBe(
        featureAvailabilityMessage(`${type} analysis`, (l) => l.allowedAnalysisTypes.includes(type)),
      );
    }
  });
});

describe('AddComputedNodeMenu — locked tools on Free', () => {
  beforeEach(() => {
    authState.effectivePlan = 'free';
    authState.plan = null;
    toastError.mockClear();
    addComputedNode.mockClear();
  });

  it('marks every tool the plan cannot create with a lock and the cheapest unlocking tier', () => {
    openMenu();
    const locked = document.querySelectorAll('button[data-locked="true"]');
    // Six of the ten offered tools 403 on Free; all six must now be marked.
    expect(locked.length).toBe(FREE_LOCKED.length);
    for (const btn of Array.from(locked)) {
      expect(btn.textContent).toMatch(/Student/);
    }
  });

  it('leaves the four tools Free actually has unmarked', () => {
    openMenu();
    for (const name of ['Text Search', 'Word Cloud', 'Sentiment', 'Statistics']) {
      const btn = screen.getByRole('button', { name: new RegExp(`^${name}`) });
      expect(btn).not.toHaveAttribute('data-locked');
    }
  });

  it('names the plans in the accessible name of a locked tool', () => {
    openMenu();
    expect(
      screen.getByRole('button', {
        name: 'Co-occurrence — Co-occurrence analysis is available on the Student, Pro, and Team plans.',
      }),
    ).toBeInTheDocument();
  });

  it('refuses locally instead of firing a request that will 403', () => {
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /^Framework Matrix —/ }));
    expect(addComputedNode).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      'Framework Matrix analysis is available on the Student, Pro, and Team plans.',
    );
  });

  it('routes the refusal to the global upgrade dialog', () => {
    const seen: CustomEvent[] = [];
    const handler = (e: Event) => seen.push(e as CustomEvent);
    window.addEventListener('plan-limit-exceeded', handler);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /^Clustering —/ }));
    window.removeEventListener('plan-limit-exceeded', handler);
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toMatchObject({ code: 'PLAN_LIMIT_EXCEEDED', limit: 'allowedAnalysisTypes', upgrade: true });
  });
});

describe('AddComputedNodeMenu — paid tiers', () => {
  beforeEach(() => {
    authState.effectivePlan = 'student';
    authState.plan = null;
    toastError.mockClear();
    addComputedNode.mockClear();
  });

  it('locks nothing for a Student', () => {
    openMenu();
    expect(document.querySelectorAll('button[data-locked="true"]')).toHaveLength(0);
  });

  it('creates the node instead of refusing', () => {
    addComputedNode.mockResolvedValue({ id: 'n1' });
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /^Co-occurrence/ }));
    expect(addComputedNode).toHaveBeenCalledWith('cooccurrence', 'Co-occurrence');
  });
});

describe('AddComputedNodeMenu — failure copy', () => {
  beforeEach(() => {
    authState.effectivePlan = 'student';
    authState.plan = null;
    toastError.mockClear();
    addComputedNode.mockClear();
  });

  it("surfaces the server's reason rather than a bare 'Failed to add node'", async () => {
    addComputedNode.mockRejectedValue({ response: { data: { error: 'Viewers cannot modify this canvas' } } });
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /^Statistics/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Viewers cannot modify this canvas'));
  });
});
