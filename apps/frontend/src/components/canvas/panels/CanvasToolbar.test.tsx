import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Backend is the source of truth for who gets intercoder agreement.
import { PLAN_LIMITS, featureAvailabilityMessage, type PlanTier } from '@qualcanvas/shared';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...a: unknown[]) => toastError(...a), success: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const canvasState: Record<string, unknown> = {
  closeCanvas: vi.fn(),
  addQuestion: vi.fn(),
  addMemo: vi.fn(),
  addTranscript: vi.fn(),
  refreshCanvas: vi.fn(),
  toggleCodingStripes: vi.fn(),
};
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (s: typeof canvasState) => unknown) => selector(canvasState),
  useActiveCanvas: () => ({ id: 'c1', name: 'Canvas', myRole: 'owner', questions: [], transcripts: [] }),
  useShowCodingStripes: () => false,
}));

const uiState: Record<string, unknown> = {
  edgeStyle: 'bezier',
  setEdgeStyle: vi.fn(),
  openFullProductTour: vi.fn(),
};
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: (selector: (s: typeof uiState) => unknown) => selector(uiState),
}));

const authState = { effectivePlan: 'pro' as string | null, plan: null as string | null };
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

vi.mock('../../../hooks/useMobile', () => ({ useMobile: () => false }));
vi.mock('../../../services/api', () => ({ canvasApi: {} }));
vi.mock('./TranscriptSourceMenu', () => ({ default: () => null }));
vi.mock('./AddComputedNodeMenu', () => ({ default: () => null }));
vi.mock('./CanvasSwitcher', () => ({ default: () => null }));
vi.mock('./QdpxExportButton', () => ({ default: () => null }));
vi.mock('../../FeatureTooltip', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../primitives/CollisionPopover', () => ({
  CollisionPopover: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <>{children}</> : null,
}));

import CanvasToolbar, { INTERCODER_PLANS, INTERCODER_UNAVAILABLE } from './CanvasToolbar';

const TIERS: PlanTier[] = ['free', 'student', 'pro', 'team'];

function openTools() {
  render(<CanvasToolbar />);
  fireEvent.click(screen.getByRole('button', { name: 'Tools menu' }));
}

describe('CanvasToolbar — intercoder gate mirrors the backend', () => {
  it('gates on exactly the tiers whose plan has intercoderEnabled', () => {
    expect([...INTERCODER_PLANS]).toEqual(TIERS.filter((t) => PLAN_LIMITS[t].intercoderEnabled));
  });

  it('uses the same sentence the 403 would carry', () => {
    expect(INTERCODER_UNAVAILABLE).toBe(featureAvailabilityMessage('Intercoder agreement', (l) => l.intercoderEnabled));
  });
});

describe('CanvasToolbar — intercoder on a non-Team plan', () => {
  beforeEach(() => {
    authState.effectivePlan = 'pro';
    authState.plan = null;
    toastError.mockClear();
  });

  it('marks the menu item Team-only in its accessible name', () => {
    openTools();
    expect(
      screen.getByRole('button', { name: `Intercoder agreement (κ / α) — ${INTERCODER_UNAVAILABLE}` }),
    ).toBeInTheDocument();
  });

  it('refuses with the plan reason instead of opening an empty panel', () => {
    openTools();
    fireEvent.click(screen.getByRole('button', { name: /^Intercoder agreement/ }));
    expect(toastError).toHaveBeenCalledWith(INTERCODER_UNAVAILABLE);
    expect(screen.queryByTestId('intercoder-panel')).not.toBeInTheDocument();
  });

  it('routes the refusal to the global upgrade dialog', () => {
    const seen: CustomEvent[] = [];
    const handler = (e: Event) => seen.push(e as CustomEvent);
    window.addEventListener('plan-limit-exceeded', handler);
    openTools();
    fireEvent.click(screen.getByRole('button', { name: /^Intercoder agreement/ }));
    window.removeEventListener('plan-limit-exceeded', handler);
    expect(seen).toHaveLength(1);
    expect(seen[0].detail).toMatchObject({ code: 'PLAN_LIMIT_EXCEEDED', limit: 'intercoderEnabled', upgrade: true });
  });
});

describe('CanvasToolbar — intercoder on Team', () => {
  beforeEach(() => {
    authState.effectivePlan = 'team';
    authState.plan = null;
    toastError.mockClear();
  });

  it('carries no plan marker and does not refuse', () => {
    openTools();
    const item = screen.getByRole('button', { name: 'Intercoder agreement (κ / α)' });
    expect(item).toBeInTheDocument();
    fireEvent.click(item);
    expect(toastError).not.toHaveBeenCalled();
  });
});
