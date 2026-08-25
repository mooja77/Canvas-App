import { describe, it, expect } from 'vitest';
import { FRONTEND_PLAN_LIMITS, getFrontendPlanLimits } from './planLimits';
// Backend plans.ts is the source of truth. Import it directly so this test
// FAILS the moment the frontend copy drifts again — the exact class of bug
// this batch was opened for.
import { PLAN_LIMITS, type PlanTier } from '@qualcanvas/shared';

const TIERS: PlanTier[] = ['free', 'student', 'pro', 'team'];

/** Backend uses Infinity for "no cap"; the frontend copy uses null. */
const norm = (n: number) => (n === Infinity ? null : n);

describe('frontend plan limits mirror the backend source of truth', () => {
  it('covers every tier the backend defines', () => {
    expect(Object.keys(FRONTEND_PLAN_LIMITS).sort()).toEqual([...TIERS].sort());
  });

  it.each(TIERS)('matches backend caps for %s', (tier) => {
    const backend = PLAN_LIMITS[tier];
    const frontend = FRONTEND_PLAN_LIMITS[tier];
    expect(frontend.maxCanvases).toBe(norm(backend.maxCanvases));
    expect(frontend.maxTranscriptsPerCanvas).toBe(norm(backend.maxTranscriptsPerCanvas));
    expect(frontend.maxWordsPerTranscript).toBe(norm(backend.maxWordsPerTranscript));
    expect(frontend.maxCodesPerCanvas).toBe(norm(backend.maxCodes));
    expect(frontend.maxShares).toBe(norm(backend.maxShares));
    expect(frontend.aiEnabled).toBe(backend.aiEnabled);
  });

  it('falls back to free for unknown or missing plans', () => {
    expect(getFrontendPlanLimits(null)).toEqual(FRONTEND_PLAN_LIMITS.free);
    expect(getFrontendPlanLimits('enterprise')).toEqual(FRONTEND_PLAN_LIMITS.free);
    expect(getFrontendPlanLimits('student')).toEqual(FRONTEND_PLAN_LIMITS.student);
  });
});
