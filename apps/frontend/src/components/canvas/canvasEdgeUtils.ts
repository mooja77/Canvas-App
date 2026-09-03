import type { CanvasTextCoding } from '@qualcanvas/shared';

/**
 * Above this many coding edges a canvas is treated as "dense" and its edges drop
 * the per-edge ambient decorations — the continuously-animating direction dot (an
 * SVG `<animateMotion>`) and the portaled midpoint count badge. On a large project
 * (e.g. 180+ transcript→code edges) those become hundreds of simultaneous
 * animations + portaled DOM nodes, which tanks pan/zoom framerate. Hovering an edge
 * still reveals its full tooltip, so no information is lost; small canvases stay
 * below the threshold and keep the richer visuals.
 */
export const DENSE_EDGE_THRESHOLD = 40;

export function isDenseEdgeGraph(edgeCount: number): boolean {
  return edgeCount > DENSE_EDGE_THRESHOLD;
}

/**
 * Below this zoom, a dense graph's edges are an unreadable haze — but React
 * Flow still paints every edge path on each pan frame (viewport culling can't
 * help when the whole graph fits the screen). Hiding them at extreme zoom-out
 * is a pure pan/zoom win and arguably makes node clusters clearer; zooming back
 * in restores them. Only applied to dense graphs so small canvases are
 * unaffected.
 */
export const LOW_ZOOM_EDGE_HIDE_BELOW = 0.12;

/**
 * React Flow's viewport culling is useful on large canvases, but enabling it
 * unconditionally can leave a small graph's edges unmounted when an initial
 * fit races late node measurement. Small canvases are cheap to render in full
 * and should favour correctness; large canvases retain the optimisation.
 */
export const VISIBLE_ELEMENT_CULL_THRESHOLD = 80;

export function shouldCullOffscreenElements(nodeCount: number): boolean {
  return nodeCount > VISIBLE_ELEMENT_CULL_THRESHOLD;
}

export function shouldHideEdgesAtZoom(zoom: number, edgeCount: number): boolean {
  return zoom < LOW_ZOOM_EDGE_HIDE_BELOW && isDenseEdgeGraph(edgeCount);
}

/**
 * Same-canvas edge sync (CanvasWorkspace's canvas-data effect): decide what to
 * publish into React Flow's controlled edge set, or `null` to leave it alone.
 *
 * `freshEdges` is `buildEdges()` evaluated in the SAME effect run, i.e. one
 * edge per coding bundle / relation that exists in the store right now. So
 * whatever this returns can only ever describe entities that still exist:
 * it re-publishes the current derivation, never a cached set.
 *
 * - The builder changed identity (its store inputs changed): publish.
 * - Empty-recovery: the controlled set is empty while the store still has
 *   edges. React Strict Mode replays effects: the first setup can mark the
 *   canvas loaded, then its state update can be discarded before the replay,
 *   so the second setup sees the same canvas/builder and would leave every
 *   coding edge absent. It also re-shows edges that a client-only path (React
 *   Flow's default Backspace delete, an undo to a snapshot taken before the
 *   coding existed) hid without deleting the underlying coding; that is
 *   correct, since the coding is still there and still counted everywhere
 *   else. A coding deleted through the store yields no fresh edge and cannot
 *   come back.
 * - Otherwise (one of several edges hidden client-side, nothing changed): null.
 */
export function resolveEdgeSync<E>(builderChanged: boolean, currentEdges: readonly E[], freshEdges: E[]): E[] | null {
  if (builderChanged) return freshEdges;
  if (currentEdges.length === 0 && freshEdges.length > 0) return freshEdges;
  return null;
}

export function getCodingIdsFromEdgeData(edgeData: Record<string, unknown> | undefined): string[] {
  if (!edgeData) return [];

  const bundledCodings = Array.isArray(edgeData.codings) ? (edgeData.codings as Pick<CanvasTextCoding, 'id'>[]) : [];
  if (bundledCodings.length > 0) {
    return bundledCodings.map((coding) => coding.id).filter(Boolean);
  }

  return typeof edgeData.codingId === 'string' && edgeData.codingId ? [edgeData.codingId] : [];
}
