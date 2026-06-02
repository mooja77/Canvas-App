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

export function getCodingIdsFromEdgeData(edgeData: Record<string, unknown> | undefined): string[] {
  if (!edgeData) return [];

  const bundledCodings = Array.isArray(edgeData.codings) ? (edgeData.codings as Pick<CanvasTextCoding, 'id'>[]) : [];
  if (bundledCodings.length > 0) {
    return bundledCodings.map((coding) => coding.id).filter(Boolean);
  }

  return typeof edgeData.codingId === 'string' && edgeData.codingId ? [edgeData.codingId] : [];
}
