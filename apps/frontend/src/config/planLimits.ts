/**
 * Frontend copy of the plan caps.
 *
 * SOURCE OF TRUTH: apps/backend/src/config/plans.ts. This is a hand-mirror,
 * kept because the browser needs the numbers to render meters and cap hints
 * before (or without) a round-trip. It exists as ONE module rather than the
 * three drifted inline literals it replaced (AccountPage, StatusBar, and the
 * marketing copy), so there is a single place to update.
 *
 * The structural fix — serving the caps from /auth/me so this file can be
 * deleted outright — is deliberately out of scope here; see the report.
 * `planLimits.test.ts` asserts every number against the backend module so the
 * copy cannot silently drift again.
 *
 * Two things the old inline copies got wrong and this module encodes
 * explicitly:
 *   - `null` means "no cap", NOT "cap unknown". Every tier has a real word
 *     cap, so no tier is null there.
 *   - transcripts, codes and words are PER CANVAS / PER TRANSCRIPT caps.
 *     Account-wide totals must never be divided by them. Only `maxCanvases`
 *     and `maxShares` are account-wide (see planLimits.ts middleware).
 */

export type PlanTier = 'free' | 'student' | 'pro' | 'team';

export interface FrontendPlanLimits {
  /** Account-wide. */
  maxCanvases: number | null;
  /** Per canvas. */
  maxTranscriptsPerCanvas: number | null;
  /** Per transcript. */
  maxWordsPerTranscript: number | null;
  /** Per canvas. */
  maxCodesPerCanvas: number | null;
  /** Account-wide. */
  maxShares: number | null;
  /** Whether the tier includes AI features at all (backend `aiEnabled`). */
  aiEnabled: boolean;
}

export const FRONTEND_PLAN_LIMITS: Record<PlanTier, FrontendPlanLimits> = {
  free: {
    maxCanvases: 2,
    maxTranscriptsPerCanvas: 5,
    maxWordsPerTranscript: 10000,
    maxCodesPerCanvas: 10,
    maxShares: 0,
    aiEnabled: false,
  },
  student: {
    maxCanvases: 5,
    maxTranscriptsPerCanvas: null,
    maxWordsPerTranscript: 50000,
    maxCodesPerCanvas: null,
    maxShares: 2,
    aiEnabled: true,
  },
  pro: {
    maxCanvases: null,
    maxTranscriptsPerCanvas: null,
    maxWordsPerTranscript: 50000,
    maxCodesPerCanvas: null,
    maxShares: 5,
    aiEnabled: true,
  },
  team: {
    maxCanvases: null,
    maxTranscriptsPerCanvas: null,
    maxWordsPerTranscript: 50000,
    maxCodesPerCanvas: null,
    maxShares: null,
    aiEnabled: true,
  },
};

const isPlanTier = (plan: string): plan is PlanTier => plan in FRONTEND_PLAN_LIMITS;

/** Unknown or missing plans fall back to Free, matching backend getPlanLimits. */
export function getFrontendPlanLimits(plan: string | null | undefined): FrontendPlanLimits {
  if (plan && isPlanTier(plan)) return FRONTEND_PLAN_LIMITS[plan];
  return FRONTEND_PLAN_LIMITS.free;
}
