import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PLAN_LIMITS, serializePlanLimits, type CanvasOwnerPlan, type PlanTier } from '@qualcanvas/shared';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() },
}));

const exportQdpx = vi.fn();
vi.mock('../../../services/api', () => ({ canvasApi: { exportQdpx: (...a: unknown[]) => exportQdpx(...a) } }));

const authState = { effectivePlan: 'free' as string | null, plan: null as string | null };
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

const canvasState = { activeCanvas: null as { ownerPlan?: CanvasOwnerPlan } | null };
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (s: typeof canvasState) => unknown) => selector(canvasState),
}));

import QdpxExportButton from './QdpxExportButton';

const ownerPlanOf = (tier: PlanTier): CanvasOwnerPlan => ({
  effectivePlan: tier,
  limits: serializePlanLimits(PLAN_LIMITS[tier]),
});

/**
 * M6 (bug hunt 2026-09-02): checkExportFormat('qdpx') gates on the canvas
 * OWNER's plan, so the button must follow the open canvas rather than the
 * viewer's own subscription.
 */
describe('QdpxExportButton — gate follows the canvas owner plan', () => {
  beforeEach(() => {
    toastError.mockClear();
    exportQdpx.mockReset();
    exportQdpx.mockReturnValue(new Promise(() => {})); // never resolves; we only assert the call
    canvasState.activeCanvas = null;
    authState.effectivePlan = 'free';
    authState.plan = null;
  });

  it('a Free viewer on a Team canvas can export', () => {
    canvasState.activeCanvas = { ownerPlan: ownerPlanOf('team') };
    render(<QdpxExportButton canvasId="c1" />);
    const button = screen.getByRole('button', { name: /Export QDPX/ });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(exportQdpx).toHaveBeenCalledWith('c1');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('a Pro viewer on a Free canvas sees the upgrade state the server would enforce', () => {
    authState.effectivePlan = 'pro';
    canvasState.activeCanvas = { ownerPlan: ownerPlanOf('free') };
    render(<QdpxExportButton canvasId="c1" />);
    const button = screen.getByRole('button', { name: /QDPX export — upgrade/ });
    expect(button).toBeDisabled();
    expect(exportQdpx).not.toHaveBeenCalled();
  });

  it('falls back to the viewer plan when the canvas carries no ownerPlan', () => {
    authState.effectivePlan = 'student';
    canvasState.activeCanvas = { ownerPlan: undefined };
    render(<QdpxExportButton canvasId="c1" />);
    expect(screen.getByRole('button', { name: /Export QDPX/ })).toBeEnabled();

    authState.effectivePlan = 'free';
  });

  it('stays disabled for a Free viewer with no canvas plan information', () => {
    render(<QdpxExportButton canvasId="c1" />);
    expect(screen.getByRole('button', { name: /QDPX export — upgrade/ })).toBeDisabled();
  });
});
