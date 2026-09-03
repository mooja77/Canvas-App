import { useCanvasStore } from '../stores/canvasStore';
import { useAuthStore } from '../stores/authStore';
import { getFrontendPlanLimits, type FrontendPlanLimits } from '../config/planLimits';

/**
 * Which plan governs the canvas that is open?
 *
 * The server gates every canvas-scoped limit — transcripts, codes, words,
 * analysis types, exports, ethics, intercoder, AI — on the canvas OWNER's
 * effective plan (backend `resolveRequestPlan`), never on the requester's.
 * Collaborators can be on any plan, so a gate that read the viewer's own
 * subscription was wrong in both directions: a Free collaborator on a Team
 * canvas saw locks and red caps the server would never apply, and a Pro
 * collaborator on a Free canvas got 403s the UI had not warned about (bug
 * hunt 2026-09-02 M6).
 *
 * GET /canvas/:id reports `ownerPlan`; these hooks prefer it and fall back to
 * the viewer's plan when it is absent (no canvas open, an older server, or an
 * offline-cached copy from before the field existed).
 *
 * ACCOUNT-WIDE caps — canvas count and share-code count — are enforced against
 * the requester's own account and must keep reading `useAuthStore` directly.
 */
export function useViewerPlan(): string {
  return useAuthStore((s) => s.effectivePlan ?? s.plan ?? 'free');
}

/** Owner's effective plan for the open canvas, else the viewer's. */
export function useCanvasPlan(): string {
  const ownerPlan = useCanvasStore((s) => s.activeCanvas?.ownerPlan?.effectivePlan);
  const viewerPlan = useViewerPlan();
  return ownerPlan ?? viewerPlan;
}

/**
 * Limits for the open canvas. Server-reported when present (authoritative,
 * `null` = no cap), else the frontend mirror keyed by the viewer's plan.
 */
export function useCanvasPlanLimits(): FrontendPlanLimits {
  const reported = useCanvasStore((s) => s.activeCanvas?.ownerPlan?.limits);
  const viewerPlan = useViewerPlan();
  if (!reported) return getFrontendPlanLimits(viewerPlan);
  return {
    maxCanvases: reported.maxCanvases,
    maxTranscriptsPerCanvas: reported.maxTranscriptsPerCanvas,
    maxWordsPerTranscript: reported.maxWordsPerTranscript,
    maxCodesPerCanvas: reported.maxCodes,
    maxShares: reported.maxShares,
    aiEnabled: reported.aiEnabled,
  };
}
