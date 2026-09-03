import type { CanvasOwnerPlan } from '@qualcanvas/shared';
import { getPlanLimits, serializePlanLimits } from '../config/plans.js';

/**
 * The plan that governs a canvas is its OWNER's, never the requester's.
 *
 * `resolveRequestPlan` (middleware/planLimits.ts) has always gated per-canvas
 * limits this way; GET /canvas/:id now reports the same answer so the client
 * can render the gates the server will actually enforce (bug hunt 2026-09-02
 * M6). Both call this one function on the same row shape, so they cannot
 * drift. It lives outside planLimits.ts because the integration suites mock
 * that module wholesale.
 */

/** The three user columns the overlay needs; `OWNER_PLAN_USER_SELECT` fetches exactly these. */
export interface OwnerPlanUser {
  plan: string;
  emailVerified: boolean;
  trialEndsAt: Date | null;
}

export interface OwnerPlanSource {
  user?: OwnerPlanUser | null;
  dashboardAccess?: { user?: OwnerPlanUser | null } | null;
}

export const OWNER_PLAN_USER_SELECT = { plan: true, emailVerified: true, trialEndsAt: true } as const;

/** Prisma `include`/`select` fragment that loads what `resolveCanvasOwnerPlan` reads. */
export const OWNER_PLAN_INCLUDE = {
  user: { select: OWNER_PLAN_USER_SELECT },
  dashboardAccess: { select: { user: { select: OWNER_PLAN_USER_SELECT } } },
} as const;

/**
 * Same overlay as middleware/auth.ts: a verified Free user inside their trial
 * window is treated as Pro. Paid plans ignore it.
 */
export function effectivePlanOf(user: OwnerPlanUser): string {
  const trialActive =
    user.emailVerified === true &&
    user.plan === 'free' &&
    user.trialEndsAt instanceof Date &&
    user.trialEndsAt.getTime() > Date.now();
  return trialActive ? 'pro' : user.plan;
}

/**
 * Owner's effective plan for a canvas row. A canvas owned by an email user
 * uses that user; one owned by a legacy access code uses the linked user if
 * any; an unlinked legacy owner is grandfathered to Pro.
 */
export function resolveCanvasOwnerPlan(canvas: OwnerPlanSource): string {
  const owner = canvas.user ?? canvas.dashboardAccess?.user;
  return owner ? effectivePlanOf(owner) : 'pro';
}

/** The `ownerPlan` object GET /canvas/:id returns. */
export function canvasOwnerPlanPayload(canvas: OwnerPlanSource): CanvasOwnerPlan {
  const effectivePlan = resolveCanvasOwnerPlan(canvas);
  return { effectivePlan, limits: serializePlanLimits(getPlanLimits(effectivePlan)) };
}
