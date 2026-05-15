/**
 * Pure fit/framing computation for the canvas viewport.
 *
 * Replaces the static `INITIAL_FIT_VIEW_OPTIONS` / `MANUAL_FIT_VIEW_OPTIONS`
 * pair that used to live in CanvasWorkspace.tsx. The static `minZoom: 0.5`
 * floor clipped dense graphs at first paint (live QA findings #1, #2) and
 * the explicit opt-out from refit-on-resize stranded the viewport on
 * orientation change (#17, #18).
 *
 * Spec: docs/canvas-ux/fit-framing-algorithm.md (locked, do not deviate).
 *
 * The function is pure — no DOM reads, no React Flow instance access — so
 * vitest can verify the math without a browser. Call sites in
 * CanvasWorkspace pass the result to `rfInstance.setViewport(...)`.
 */

export type Bbox = { minX: number; minY: number; maxX: number; maxY: number };
export type Viewport = { w: number; h: number };
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';
export type FitIntent = 'initial' | 'manual' | 'post-layout' | 'recover';
export type FitResult = { x: number; y: number; zoom: number };

/** Minimal node shape we need to compute a bbox. Decoupled from React Flow
 * types so this module stays browser-and-framework-free. */
export interface BboxNode {
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
  style?: { width?: number | string; height?: number | string };
}

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 200;

function numericDim(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Compute the bounding box of the given nodes in canvas coordinates.
 * Returns null for an empty array — callers should treat this as
 * "nothing to fit" and skip the setViewport call.
 */
export function nodesToBbox(nodes: BboxNode[]): Bbox | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const w = numericDim(node.measured?.width ?? node.style?.width, DEFAULT_NODE_WIDTH);
    const h = numericDim(node.measured?.height ?? node.style?.height, DEFAULT_NODE_HEIGHT);
    if (node.position.x < minX) minX = node.position.x;
    if (node.position.y < minY) minY = node.position.y;
    if (node.position.x + w > maxX) maxX = node.position.x + w;
    if (node.position.y + h > maxY) maxY = node.position.y + h;
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

interface ZoomEnvelope {
  padding: number;
  minZoom: number;
  maxZoom: number;
}

const ZOOM_ENVELOPE: Record<Breakpoint, ZoomEnvelope> = {
  mobile: { padding: 0.08, minZoom: 0.1, maxZoom: 0.65 },
  tablet: { padding: 0.12, minZoom: 0.15, maxZoom: 0.85 },
  desktop: { padding: 0.2, minZoom: 0.15, maxZoom: 1.0 },
};

/** Stage-2 overview-fallback floor used when even minZoom won't fit. */
const OVERVIEW_FLOOR = 0.05;

const IDENTITY: FitResult = { x: 0, y: 0, zoom: 1 };

/**
 * Derive a breakpoint label from viewport width. Match the implementation in
 * `hooks/useMobile.ts` so behavior is consistent across the app.
 */
export function breakpointFor(viewportWidth: number): Breakpoint {
  if (viewportWidth < 640) return 'mobile';
  if (viewportWidth < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Compute a fit transform for the given graph bbox + viewport.
 *
 * Returns identity ({ x: 0, y: 0, zoom: 1 }) when either bbox is null
 * (empty graph) or viewport has zero dimension (initial pre-paint).
 *
 * Intent is reserved for the trigger-policy layer (which uses it to pick
 * debounce/animation durations); the math itself currently uses only
 * `breakpoint`. Keeping the parameter lets future spec revisions tune by
 * intent without changing every call site.
 */
export function computeFit(
  bbox: Bbox | null,
  viewport: Viewport,
  breakpoint: Breakpoint,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  intent: FitIntent,
): FitResult {
  if (!bbox || viewport.w <= 0 || viewport.h <= 0) return IDENTITY;

  const graphW = bbox.maxX - bbox.minX;
  const graphH = bbox.maxY - bbox.minY;
  if (graphW <= 0 || graphH <= 0) return IDENTITY;

  const env = ZOOM_ENVELOPE[breakpoint];

  // Padding is a fraction of viewport, applied symmetrically.
  const padX = viewport.w * env.padding;
  const padY = viewport.h * env.padding;
  const targetW = Math.max(viewport.w - 2 * padX, 1);
  const targetH = Math.max(viewport.h - 2 * padY, 1);

  const zoomX = targetW / graphW;
  const zoomY = targetH / graphH;
  const naive = Math.min(zoomX, zoomY);

  // Stage 1: clamp to envelope.
  let zoom = Math.min(env.maxZoom, Math.max(env.minZoom, naive));

  // Stage 2: overview fallback when the legibility floor would crop the
  // graph. Surface a "zoom in to read" affordance separately (out of scope).
  if (naive < env.minZoom) {
    zoom = Math.max(OVERVIEW_FLOOR, naive);
  }

  // Center the bbox in the viewport.
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const x = viewport.w / 2 - cx * zoom;
  const y = viewport.h / 2 - cy * zoom;

  return { x, y, zoom };
}
