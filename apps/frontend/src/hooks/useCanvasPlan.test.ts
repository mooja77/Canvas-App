import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PLAN_LIMITS, serializePlanLimits, type CanvasOwnerPlan, type PlanTier } from '@qualcanvas/shared';

const { canvasState, authState } = vi.hoisted(() => ({
  canvasState: { activeCanvas: null as { ownerPlan?: CanvasOwnerPlan } | null },
  authState: { plan: null as string | null, effectivePlan: null as string | null },
}));

vi.mock('../stores/canvasStore', () => ({
  useCanvasStore: (selector: (s: typeof canvasState) => unknown) => selector(canvasState),
}));
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

import { useCanvasPlan, useCanvasPlanLimits } from './useCanvasPlan';
import { FRONTEND_PLAN_LIMITS } from '../config/planLimits';

const ownerPlanOf = (tier: PlanTier): CanvasOwnerPlan => ({
  effectivePlan: tier,
  limits: serializePlanLimits(PLAN_LIMITS[tier]),
});

/**
 * M6 (bug hunt 2026-09-02). The server gates canvas-scoped limits on the canvas
 * OWNER's plan (resolveRequestPlan); every canvas-scoped UI gate reads through
 * these hooks so it agrees with the server.
 */
describe('useCanvasPlan', () => {
  beforeEach(() => {
    canvasState.activeCanvas = null;
    authState.plan = null;
    authState.effectivePlan = null;
  });

  it('prefers the open canvas owner plan over the viewer plan', () => {
    authState.effectivePlan = 'free';
    canvasState.activeCanvas = { ownerPlan: ownerPlanOf('team') };
    expect(renderHook(() => useCanvasPlan()).result.current).toBe('team');
  });

  it('falls back to the viewer effective plan, then plan, then free', () => {
    canvasState.activeCanvas = { ownerPlan: undefined };
    authState.plan = 'student';
    authState.effectivePlan = 'pro';
    expect(renderHook(() => useCanvasPlan()).result.current).toBe('pro');
    authState.effectivePlan = null;
    expect(renderHook(() => useCanvasPlan()).result.current).toBe('student');
    authState.plan = null;
    expect(renderHook(() => useCanvasPlan()).result.current).toBe('free');
  });

  it('uses the viewer plan when no canvas is open', () => {
    authState.effectivePlan = 'team';
    expect(renderHook(() => useCanvasPlan()).result.current).toBe('team');
  });
});

describe('useCanvasPlanLimits', () => {
  beforeEach(() => {
    canvasState.activeCanvas = null;
    authState.plan = null;
    authState.effectivePlan = null;
  });

  it('serves the server-reported limits when the canvas carries them', () => {
    authState.effectivePlan = 'free';
    canvasState.activeCanvas = { ownerPlan: ownerPlanOf('team') };
    const limits = renderHook(() => useCanvasPlanLimits()).result.current;
    expect(limits.maxWordsPerTranscript).toBe(PLAN_LIMITS.team.maxWordsPerTranscript);
    expect(limits.maxCodesPerCanvas).toBeNull(); // Infinity travels as null
    expect(limits.aiEnabled).toBe(true);
  });

  it('matches the frontend mirror for every tier, so the two sources cannot disagree', () => {
    for (const tier of ['free', 'student', 'pro', 'team'] as PlanTier[]) {
      canvasState.activeCanvas = { ownerPlan: ownerPlanOf(tier) };
      expect(renderHook(() => useCanvasPlanLimits()).result.current).toEqual(FRONTEND_PLAN_LIMITS[tier]);
    }
  });

  it('falls back to the mirror keyed by the viewer plan', () => {
    authState.effectivePlan = 'student';
    expect(renderHook(() => useCanvasPlanLimits()).result.current).toEqual(FRONTEND_PLAN_LIMITS.student);
  });
});
