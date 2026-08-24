import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Backend is the source of truth for the canvas cap and for the sentence the
// 403 carries. Import it so the dashboard warning cannot drift away from the
// refusal it is meant to pre-empt.
import { PLAN_LIMITS, allowanceMessage, type PlanTier } from '../../../../../backend/src/config/plans';

// CanvasListPanel pulls from the canvas store + a few hooks/services. Mock the
// surface it touches so we can render it in isolation and assert the Trash
// disclosure exposes its expanded state to assistive tech.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const canvasState = {
  canvases: [] as unknown[],
  fetchCanvases: vi.fn(),
  createCanvas: vi.fn(),
  deleteCanvas: vi.fn(),
  fetchTrash: vi.fn(),
  restoreCanvas: vi.fn(),
  permanentDeleteCanvas: vi.fn(),
};
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (s: typeof canvasState) => unknown) => selector(canvasState),
  useCanvasLoading: () => false,
  useTrashedCanvases: () => trashed,
  useTrashLoading: () => false,
}));

let trashed: unknown[] = [];

const authState = { effectivePlan: 'free' as string | null, plan: null as string | null };
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

vi.mock('../../../hooks/useOpenCanvas', () => ({ useOpenCanvas: () => vi.fn() }));
vi.mock('../../../services/api', () => ({ canvasApi: { addQuestion: vi.fn(), cloneCanvas: vi.fn() } }));
vi.mock('../ConfirmDialog', () => ({ default: () => null }));
vi.mock('./CanvasThumbnail', () => ({ default: () => null }));
const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) },
}));

import CanvasListPanel, { canvasUpgradePhrase, canvasCapMessage } from './CanvasListPanel';

const TIERS: PlanTier[] = ['free', 'student', 'pro', 'team'];

function makeCanvases(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    name: `Canvas ${i}`,
    description: null,
    updatedAt: new Date().toISOString(),
    _count: { codings: 0 },
  }));
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <CanvasListPanel />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  canvasState.canvases = [];
  authState.effectivePlan = 'free';
  authState.plan = null;
  trashed = [];
  toastError.mockClear();
  canvasState.restoreCanvas.mockReset();
});

describe('CanvasListPanel — Trash disclosure a11y', () => {
  beforeEach(() => {
    canvasState.fetchTrash.mockClear();
  });

  it('exposes the Trash disclosure state via aria-expanded (collapsed by default)', () => {
    renderPanel();
    const trashBtn = screen.getByRole('button', { name: /trash/i });
    expect(trashBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('flips aria-expanded to true when the Trash section is opened', () => {
    renderPanel();
    const trashBtn = screen.getByRole('button', { name: /trash/i });
    fireEvent.click(trashBtn);
    expect(trashBtn).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('CanvasListPanel — quota copy mirrors the backend refusal', () => {
  it.each(TIERS)('produces the same at-cap sentence the server would send for %s', (tier) => {
    const max = PLAN_LIMITS[tier].maxCanvases;
    if (max === Infinity) return; // uncapped tiers never render the notice
    expect(canvasCapMessage(tier, max)).toBe(
      allowanceMessage(tier, 'Canvases', max, (l) => l.maxCanvases, {
        deleteHint: 'delete a canvas you no longer need',
      }),
    );
  });

  it('names the tiers that offer more, cheapest first', () => {
    expect(canvasUpgradePhrase(2)).toBe('Student allows 5, Pro and Team allow unlimited');
  });
});

describe('CanvasListPanel — canvas quota is visible before the create fails', () => {
  it('shows the count against the cap on a capped plan', () => {
    canvasState.canvases = makeCanvases(1);
    renderPanel();
    expect(screen.getByTestId('canvas-quota')).toHaveTextContent('1 of 2 canvases used on the Free plan');
  });

  it('warns at the cap, with the same remedy the 403 gives and a route to the plans', () => {
    canvasState.canvases = makeCanvases(2);
    renderPanel();
    const notice = screen.getByTestId('canvas-cap-notice');
    expect(notice).toHaveTextContent(canvasCapMessage('free', 2));
    expect(screen.getByRole('link', { name: 'View plans' })).toHaveAttribute('href', '/pricing');
  });

  it('shows no quota or notice on an uncapped plan', () => {
    authState.effectivePlan = 'pro';
    canvasState.canvases = makeCanvases(9);
    renderPanel();
    expect(screen.queryByTestId('canvas-quota')).not.toBeInTheDocument();
    expect(screen.queryByTestId('canvas-cap-notice')).not.toBeInTheDocument();
  });
});

describe('CanvasListPanel — restore surfaces the plan-limit reason', () => {
  const serverReason = allowanceMessage('free', 'Canvases', 2, (l) => l.maxCanvases, {
    deleteHint: 'delete a canvas you no longer need',
  });

  it("shows the server's message rather than a generic failure", async () => {
    trashed = [{ id: 't1', name: 'Old study', deletedAt: new Date().toISOString(), _count: { codings: 0 } }];
    canvasState.restoreCanvas.mockRejectedValue({
      response: { data: { error: serverReason, code: 'PLAN_LIMIT_EXCEEDED' } },
    });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /trash/i }));
    fireEvent.click(screen.getByRole('button', { name: /restore canvas/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(serverReason));
  });

  it('still falls back to a generic message when the server sends nothing usable', async () => {
    trashed = [{ id: 't1', name: 'Old study', deletedAt: new Date().toISOString(), _count: { codings: 0 } }];
    canvasState.restoreCanvas.mockRejectedValue(new Error('network'));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /trash/i }));
    fireEvent.click(screen.getByRole('button', { name: /restore canvas/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to restore canvas'));
  });
});
