# Fit/Framing Algorithm Spec — Sprint 1A

Date: 2026-05-15
Status: Spec locked. Implementation pending.
Maps to: live QA findings #1, #2, #3, #11, #17, #18.

## Why this exists

The current implementation uses a single static `INITIAL_FIT_VIEW_OPTIONS = { padding: 0.2, minZoom: 0.5, maxZoom: 0.85 }` (`CanvasWorkspace.tsx:96`) and explicitly opts out of any post-resize re-fit (`CanvasWorkspace.tsx:798-801`). That static floor of `minZoom: 0.5` is too high for dense graphs: a graph that needs scale 0.186 to be fully visible (per QA artifact `15-desktop-02-manual-fit-view.png`) gets clamped to 0.5 and shows ~19/27 nodes on initial load. On mobile the same floor clips 11 of 25 nodes. On orientation change nothing re-runs, so the viewport sits offscreen.

This spec defines a deterministic `computeFit(bbox, viewport, breakpoint, intent) → { x, y, zoom }` function plus the trigger policy that decides when to call it. No fuzz, no heuristic tweaking after the fact — the algorithm is locked here and only changes via this document.

## Inputs

```ts
type Bbox = { minX: number; minY: number; maxX: number; maxY: number };
type Viewport = { w: number; h: number };
type Breakpoint = 'mobile' | 'tablet' | 'desktop';
type Intent = 'initial' | 'manual' | 'post-layout' | 'recover';
```

Bbox is the union of `node.position` + `node.measured.{width,height}` for every visible node in the active canvas. Group nodes are included. Hidden / soft-deleted nodes are not. Empty graph → bbox is `null` and we short-circuit to `{ x: 0, y: 0, zoom: 1 }`.

Viewport is the pixel `clientWidth`/`clientHeight` of the React Flow container (the wrapper div, not `window`). Sidebar and navigator widths are already excluded because they sit outside the wrapper.

Breakpoint is derived from viewport width: `< 640 → mobile`, `< 1024 → tablet`, else `desktop`. Not from `window.matchMedia` — derived from the same `viewport.w` we're fitting to, so a sidebar collapse doesn't cause a mismatch.

Intent is the caller's purpose. It selects padding + min/max zoom. `initial` is the first paint after canvas switch. `manual` is the user clicking Fit View or pressing F. `post-layout` is the call we issue right after auto-layout finishes. `recover` is a debounced re-fit fired by resize or orientationchange.

## Output

```ts
type FitResult = { x: number; y: number; zoom: number };
```

These are React Flow viewport transform values: `transform: translate(${x}px, ${y}px) scale(${zoom})`. They go directly into `rfInstanceRef.current.setViewport(result, { duration })`. We do NOT call `rfInstance.fitView()` with a dynamic options object — too many integration points and React Flow's internal version clamps to component-level `minZoom`/`maxZoom`. We compute the transform ourselves so the result is testable in isolation.

## Constants

Per-breakpoint zoom envelope:

| breakpoint | padding | minZoom | maxZoom | notes                                                                                                   |
| ---------- | ------- | ------- | ------- | ------------------------------------------------------------------------------------------------------- |
| mobile     | 0.08    | 0.10    | 0.65    | Lower floor so a 30-node canvas fits inside 390×844. Cap below 1.0 — text > readable but mobile-tuned.  |
| tablet     | 0.12    | 0.15    | 0.85    | Matches today's manual-fit floor (0.15). Keep maxZoom below 1 so an empty canvas doesn't paint massive. |
| desktop    | 0.20    | 0.15    | 1.00    | Padding wide enough to feel intentional; floor matches manual.                                          |

Two-stage rule:

- If `naive_fit_zoom < minZoom`, the graph cannot fit at the legibility floor. Run stage 2.
- Stage 2 (overview): compute a fit with floor `0.05` and use that. We accept text becoming unreadable in exchange for showing the graph shape. Surface a "Zoom in to read" affordance — out of scope here, tracked separately.

Component-level React Flow envelope (the props on `<ReactFlow minZoom maxZoom>`) stays `{ minZoom: 0.05, maxZoom: 2 }` — the user can still zoom past our auto-fit limits manually. This is the existing line `CanvasWorkspace.tsx:2111-2112` with `minZoom` lowered from `0.15` to `0.05`.

## Algorithm

```ts
function computeFit(bbox: Bbox | null, viewport: Viewport, breakpoint: Breakpoint, intent: Intent): FitResult {
  if (!bbox || viewport.w === 0 || viewport.h === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }
  const env = ZOOM_ENVELOPE[breakpoint];

  // Padding is a fraction of viewport, applied symmetrically.
  const padX = viewport.w * env.padding;
  const padY = viewport.h * env.padding;
  const targetW = Math.max(viewport.w - 2 * padX, 1);
  const targetH = Math.max(viewport.h - 2 * padY, 1);

  const graphW = Math.max(bbox.maxX - bbox.minX, 1);
  const graphH = Math.max(bbox.maxY - bbox.minY, 1);

  const zoomX = targetW / graphW;
  const zoomY = targetH / graphH;
  const naive = Math.min(zoomX, zoomY);

  // Stage 1: clamp to envelope.
  let zoom = Math.min(env.maxZoom, Math.max(env.minZoom, naive));

  // Stage 2: overview fallback only when stage 1 underfits.
  if (naive < env.minZoom) {
    zoom = Math.max(0.05, naive);
  }

  // Center bbox in viewport.
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const x = viewport.w / 2 - cx * zoom;
  const y = viewport.h / 2 - cy * zoom;

  return { x, y, zoom };
}
```

The function is pure — no DOM reads, no React Flow instance access. Test the math in `vitest` without a browser.

## Trigger policy

| Event                         | Intent        | Debounce | Duration | Notes                                                                                                                 |
| ----------------------------- | ------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| First paint after canvas load | `initial`     | 200 ms   | 0        | Matches today's `setTimeout(..., 200)` at `CanvasWorkspace.tsx:781`. Wait for node measurements to settle.            |
| User presses F / clicks Fit   | `manual`      | 0        | 300      | Animated.                                                                                                             |
| After auto-layout finishes    | `post-layout` | 600 ms   | 400      | Auto-layout itself animates 500 ms. Fit fires 600 ms after layout starts, animates the remaining 400 ms. Finding #11. |
| `window.resize`               | `recover`     | 200 ms   | 200      | Debounced. Only fires when viewport dimensions change ≥ 50 px on either axis. Sidebar toggles don't qualify.          |
| `window.orientationchange`    | `recover`     | 400 ms   | 200      | Wait for viewport to settle then refit. Finding #18.                                                                  |
| Sidebar/navigator toggle      | NONE          | —        | —        | Explicitly do not refit. The user's viewport is preserved through chrome changes (today's behavior).                  |

A single `useEffect` in `CanvasWorkspace.tsx` owns a `ResizeObserver` on the workspace wrapper plus a `window.orientationchange` listener. Both share a debounce queue so a rotation that fires both events still triggers exactly one fit.

## What we explicitly do NOT do

- We do not call `rfInstance.fitView()`. We compute the transform and call `setViewport`. This is testable.
- We do not refit on sidebar / navigator collapse. The user's pan/zoom survives chrome changes.
- We do not introduce a "smart fit" that picks `manual` vs `recover` envelopes based on graph density beyond the two-stage rule. Three intents × one rule = the whole product surface.
- We do not animate `initial` or `post-layout` fits past the values in the table. No fade-in, no fancy easing — React Flow's default cubic-bezier is fine.

## Test cases (vitest, no browser)

Each test calls `computeFit` directly and asserts on the returned transform. Test names map to QA findings.

### finding-1: mobile dense — must fit at least 70% of nodes

```ts
const bbox = { minX: 0, minY: 0, maxX: 1800, maxY: 1200 }; // 25 nodes spread over a wide area
const viewport = { w: 390, h: 844 };
const result = computeFit(bbox, viewport, 'mobile', 'initial');
expect(result.zoom).toBeGreaterThanOrEqual(0.1); // not floored to 0.5
expect(result.zoom).toBeLessThanOrEqual(0.65);
expect(result.zoom * 1800).toBeLessThanOrEqual(390); // graph fits horizontally inside viewport
```

### finding-2: desktop dense — must not clamp to 0.5

```ts
const bbox = { minX: 0, minY: 0, maxX: 5400, maxY: 3200 }; // the 27-node graph from QA artifact 15
const viewport = { w: 1440, h: 900 };
const result = computeFit(bbox, viewport, 'desktop', 'initial');
expect(result.zoom).toBeGreaterThanOrEqual(0.15);
expect(result.zoom).toBeLessThanOrEqual(0.25); // QA manual fit measured 0.186 — should land near there
```

### finding-11: post-layout fit produces a real scale

```ts
const bbox = { minX: 0, minY: 0, maxX: 8000, maxY: 14000 }; // worst-case vertical column after auto-layout
const viewport = { w: 1440, h: 900 };
const result = computeFit(bbox, viewport, 'desktop', 'post-layout');
expect(result.zoom).toBeGreaterThanOrEqual(0.05);
// Center y must land somewhere reasonable — not multi-screen offset.
expect(Math.abs(result.y - viewport.h / 2)).toBeLessThan(viewport.h);
```

### finding-17: compact mobile 320×568 still shows the graph

```ts
const bbox = { minX: 0, minY: 0, maxX: 1200, maxY: 1000 };
const viewport = { w: 320, h: 568 };
const result = computeFit(bbox, viewport, 'mobile', 'initial');
expect(result.zoom).toBeGreaterThanOrEqual(0.1);
// Graph must fit within viewport at the computed zoom.
expect(result.zoom * 1200).toBeLessThanOrEqual(320);
expect(result.zoom * 1000).toBeLessThanOrEqual(568);
```

### finding-18: orientation change uses `recover` intent and re-centers

```ts
const bbox = { minX: 0, minY: 0, maxX: 1500, maxY: 900 };
const portrait = computeFit(bbox, { w: 390, h: 844 }, 'mobile', 'recover');
const landscape = computeFit(bbox, { w: 844, h: 390 }, 'mobile', 'recover');
// The two transforms differ — landscape uses width-bound zoom, portrait uses height-bound.
expect(landscape.zoom).not.toBeCloseTo(portrait.zoom, 2);
// Both center the graph.
expect(Math.abs(portrait.x + 0.5 * portrait.zoom * 1500 - 390 / 2)).toBeLessThan(2);
expect(Math.abs(landscape.x + 0.5 * landscape.zoom * 1500 - 844 / 2)).toBeLessThan(2);
```

### empty-graph: returns identity, doesn't throw

```ts
expect(computeFit(null, { w: 1440, h: 900 }, 'desktop', 'initial')).toEqual({ x: 0, y: 0, zoom: 1 });
expect(computeFit({ minX: 0, minY: 0, maxX: 0, maxY: 0 }, { w: 0, h: 0 }, 'desktop', 'initial')).toEqual({
  x: 0,
  y: 0,
  zoom: 1,
});
```

## Acceptance gates

A PR implementing this spec is mergeable when:

1. `computeFit` lives in `apps/frontend/src/utils/canvasFit.ts` as a pure function with no React or React Flow imports.
2. Vitest coverage at `apps/frontend/src/utils/canvasFit.test.ts` includes all 6 test cases above plus boundary tests (zero-width bbox, negative coords, zoom-only-bound-by-width vs bound-by-height).
3. `CanvasWorkspace.tsx` no longer references `INITIAL_FIT_VIEW_OPTIONS` or `MANUAL_FIT_VIEW_OPTIONS`. All call sites use `computeFit` + `setViewport`.
4. The 4 e2e tests in `canvas-responsive-visual.spec.ts` (findings #1, #2, #17, #18) and the 3 tests in `canvas-auto-layout-visual.spec.ts` (finding #11) have `test.skip` removed and pass on Chromium.
5. Before/after screenshot pairs at 390×844, 320×568, 568×320, and 1024×640 attached to the PR.

## Out of scope

- Semantic overview at low zoom (group labels, cluster labels, offscreen indicators) — finding #10, deferred to Horizon 3.
- Group-bounds-instead-of-handles at low zoom — finding #15, ships in `canvas-auto-layout-visual` Sprint 1A but is a separate selection-rendering change.
- Saved views / home view / fit selection — Horizon 3.
- Minimap fade — finding #4, Sprint 1B (popover/minimap layout policy).

## Open questions

None. If something turns out underspecified during implementation, the rule is to update this spec in the same PR rather than make an undocumented decision in code.
