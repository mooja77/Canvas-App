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

export function shouldHideEdgesAtZoom(zoom: number, edgeCount: number): boolean {
  return zoom < LOW_ZOOM_EDGE_HIDE_BELOW && isDenseEdgeGraph(edgeCount);
}

export function getCodingIdsFromEdgeData(edgeData: Record<string, unknown> | undefined): string[] {
  if (!edgeData) return [];

  const bundledCodings = Array.isArray(edgeData.codings) ? (edgeData.codings as Pick<CanvasTextCoding, 'id'>[]) : [];
  if (bundledCodings.length > 0) {
    return bundledCodings.map((coding) => coding.id).filter(Boolean);
  }

  return typeof edgeData.codingId === 'string' && edgeData.codingId ? [edgeData.codingId] : [];
}
