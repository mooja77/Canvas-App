import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import { PLAN_LIMITS, serializePlanLimits, type CanvasOwnerPlan, type PlanTier } from '@qualcanvas/shared';

type Transcript = { content: string };

const { canvasState, authState, uiState } = vi.hoisted(() => ({
  canvasState: {
    transcripts: [] as Transcript[],
    questions: [] as unknown[],
    ownerPlan: undefined as CanvasOwnerPlan | undefined,
  },
  authState: { plan: 'free' as string | null, effectivePlan: null as string | null },
  uiState: { zoomTier: 'full' as string },
}));

vi.mock('../../stores/canvasStore', () => ({
  useActiveCanvas: () => canvasState,
  useCanvasStore: (selector: (s: { activeCanvas: typeof canvasState }) => unknown) =>
    selector({ activeCanvas: canvasState }),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));
vi.mock('../../stores/uiStore', () => ({
  useUIStore: (selector: (s: typeof uiState) => unknown) => selector(uiState),
}));

import StatusBar from './StatusBar';

const words = (n: number) => ({ content: Array.from({ length: n }, (_, i) => `w${i}`).join(' ') });

describe('StatusBar word cap', () => {
  beforeEach(() => {
    canvasState.transcripts = [];
    canvasState.questions = [];
    canvasState.ownerPlan = undefined;
    authState.plan = 'free';
    authState.effectivePlan = null;
    uiState.zoomTier = 'full';
  });

  it('shows the real Free per-transcript cap of 10,000 words (not the retired 5,000)', () => {
    canvasState.transcripts = [words(100)];
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar-word-cap')).toHaveTextContent('10,000');
    expect(screen.getByTestId('status-bar-word-cap')).not.toHaveTextContent('5,000');
  });

  it('shows a cap for Student, who has a real 50,000-word limit', () => {
    authState.plan = 'student';
    canvasState.transcripts = [words(10)];
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar-word-cap')).toHaveTextContent('50,000');
  });

  it('shows a cap for Team, who is not uncapped', () => {
    authState.plan = 'team';
    canvasState.transcripts = [words(10)];
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar-word-cap')).toHaveTextContent('50,000');
  });

  it('gauges the LONGEST transcript against the per-transcript cap, not the canvas total', () => {
    // Three compliant Free transcripts (6,000 words each) sum to 18,000 — over
    // the 10,000 per-transcript cap in aggregate, but not one of them breaches
    // it. The bar must not claim the user is over their limit.
    canvasState.transcripts = [words(6000), words(6000), words(6000)];
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar-words')).toHaveTextContent('18,000');
    expect(screen.getByTestId('status-bar-word-cap')).toHaveTextContent('6,000/10,000');
    // 60% of the cap — below the 75% warning threshold, so no badge.
    expect(screen.queryByTestId('status-bar-word-pct')).not.toBeInTheDocument();
  });

  it('warns once a single transcript actually nears the cap', () => {
    canvasState.transcripts = [words(200), words(9600)];
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar-word-pct')).toHaveTextContent('96%');
  });

  // M6 (bug hunt 2026-09-02): the server enforces the per-transcript cap
  // against the canvas OWNER's plan, so the gauge must too.
  describe('gauges against the canvas owner plan, not the viewer plan', () => {
    const ownerPlanOf = (tier: PlanTier): CanvasOwnerPlan => ({
      effectivePlan: tier,
      limits: serializePlanLimits(PLAN_LIMITS[tier]),
    });

    it('a Free viewer on a Team canvas sees the Team cap and no warning', () => {
      authState.plan = 'free';
      canvasState.ownerPlan = ownerPlanOf('team');
      canvasState.transcripts = [words(9600)];
      render(<StatusBar />);
      expect(screen.getByTestId('status-bar-word-cap')).toHaveTextContent('9,600/50,000');
      expect(screen.queryByTestId('status-bar-word-pct')).not.toBeInTheDocument();
      expect(screen.getByTestId('canvas-status-bar')).toHaveTextContent(/plan\s*team/);
    });

    it('a Pro viewer on a Free canvas sees the Free cap and the warning the server will enforce', () => {
      authState.plan = 'pro';
      canvasState.ownerPlan = ownerPlanOf('free');
      canvasState.transcripts = [words(9600)];
      render(<StatusBar />);
      expect(screen.getByTestId('status-bar-word-cap')).toHaveTextContent('9,600/10,000');
      expect(screen.getByTestId('status-bar-word-pct')).toHaveTextContent('96%');
      expect(screen.getByTestId('canvas-status-bar')).toHaveTextContent(/plan\s*free/);
    });

    it('falls back to the viewer plan when the canvas carries no ownerPlan (older server, cached copy)', () => {
      authState.plan = 'student';
      canvasState.ownerPlan = undefined;
      canvasState.transcripts = [words(10)];
      render(<StatusBar />);
      expect(screen.getByTestId('status-bar-word-cap')).toHaveTextContent('50,000');
    });
  });

  it('labels browser network state accurately instead of claiming WebSocket connectivity', () => {
    render(<StatusBar />);

    expect(screen.getByTitle('Browser online')).toHaveTextContent('online');

    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByTitle('Browser offline — changes will sync when you reconnect')).toHaveTextContent('offline');
  });
});
