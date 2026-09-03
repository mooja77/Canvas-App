# React Flow Performance Refactor

## Goal

Top 5 perf fixes for the 2,787-line `CanvasWorkspace.tsx`. Eliminates render-storms during drag/zoom, drops initial canvas-page JS by ~30%, makes the canvas comfortable at 500+ nodes.

## Scope

- Stabilize node `data` callbacks (hoist out of `buildNodes`)
- Migrate canvasStore to `createWithEqualityFn(..., shallow)`
- Stabilize inline ReactFlow props (`onInit`, `onMove`, `onMoveEnd`)
- Lazy-load chart-heavy computed node types
- Decouple position save from `buildNodes` rebuild

## Out of scope

- True React Flow parent/child sub-flow grouping
- Custom virtualization beyond `onlyRenderVisibleElements`
- Full extraction of `CanvasWorkspace.tsx` into sub-components (separate refactor, ~2 weeks)

## Fix 1 — Stable callbacks (~1 hour, large win)

**Why:** Inline arrow functions inside `data` make every TranscriptNode/GroupNode/StickyNoteNode get a new prop reference on every `buildNodes()` run, defeating the `React.memo()` on the node component.

**Files affected:**

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx` — lines 397-627 (`buildNodes`)
- All 22 node components in `apps/frontend/src/components/canvas/nodes/`

**Pattern shift:**

```diff
- // In buildNodes():
- data: {
-   onAiSuggest: (transcriptId) => { /* ... */ },
-   onTitleChange: (id, title) => { /* ... */ },
-   ...transcript
- }
+ data: {
+   transcriptId: transcript.id,
+   ...transcript
+ }
```

```diff
// In TranscriptNode.tsx:
- export function TranscriptNode({ data }) {
-   return <button onClick={data.onAiSuggest}>AI</button>;
- }
+ export function TranscriptNode({ data }) {
+   const onAiSuggest = useCanvasStore(s => s.suggestCodesForTranscript);
+   return <button onClick={() => onAiSuggest(data.transcriptId)}>AI</button>;
+ }
```

Apply to all callbacks currently in `data`: `onAiSuggest`, `onTitleChange`, `onTextChange`, `onColorChange`, `onDelete`.

## Fix 2 — Zustand `createWithEqualityFn(..., shallow)` (~30 min, large win)

**Why:** Without shallow equality, every multi-field selector returns a new object reference on every store update, triggering re-renders even when the actual data didn't change.

**File:** `apps/frontend/src/stores/canvasStore.ts:1`

```diff
- import { create } from 'zustand';
+ import { createWithEqualityFn } from 'zustand/traditional';
+ import { shallow } from 'zustand/shallow';

- export const useCanvasStore = create<CanvasState>((set, get) => ({
+ export const useCanvasStore = createWithEqualityFn<CanvasState>((set, get) => ({
    // ... store definition unchanged
- }));
+ }), shallow);
```

Audit all selectors that return arrays/objects. Most existing single-field selectors (`useActiveCanvas()`, `usePendingSelection()`) are already safe.

## Fix 3 — Stabilize inline ReactFlow props (~15 min, medium win)

**File:** `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:2010-2017`

```diff
+ const handleInit = useCallback((instance: ReactFlowInstance) => {
+   rfInstanceRef.current = instance;
+   // ... rest of init logic
+ }, []);
+
+ const handleMove = useCallback((_event: unknown, viewport: Viewport) => {
+   setViewportState(viewport);
+ }, []);
+
+ const handleMoveEnd = useCallback((_event: unknown, viewport: Viewport) => {
+   /* save viewport to canvas, throttled */
+ }, [activeCanvasId]);

  <ReactFlow
-   onInit={(instance) => { rfInstanceRef.current = instance; }}
-   onMove={(_event, viewport) => setViewportState(viewport)}
-   onMoveEnd={(_event, viewport) => { /* save */ }}
+   onInit={handleInit}
+   onMove={handleMove}
+   onMoveEnd={handleMoveEnd}
    /* ... */
  />
```

## Fix 4 — Lazy-load chart-heavy node types (~2 hours, medium win)

**Why:** 22 node types are registered eagerly. Recharts-using nodes (`StatsNode`, `WordCloudNode`, `TimelineNode`, `SentimentNode`, `CooccurrenceNode`, `ClusterNode`, `MatrixNode`, `TreemapNode`, `ComparisonNode`) pull in ~200KB of recharts code at canvas mount.

**File:** `apps/frontend/src/components/canvas/canvasFlowTypes.tsx`

```diff
  import { TranscriptNode } from './nodes/TranscriptNode';
  import { QuestionNode } from './nodes/QuestionNode';
  import { MemoNode } from './nodes/MemoNode';
  import { StickyNoteNode } from './nodes/StickyNoteNode';
  import { GroupNode } from './nodes/GroupNode';
  import { RerouteNode } from './nodes/RerouteNode';
  import { CaseNode } from './nodes/CaseNode';
  import { DocumentNode } from './nodes/DocumentNode';
- import { StatsNode } from './nodes/StatsNode';
- import { WordCloudNode } from './nodes/WordCloudNode';
- import { TimelineNode } from './nodes/TimelineNode';
- // ... etc

+ // Lazy-load chart-heavy types (recharts is ~200KB)
+ const StatsNode = React.lazy(() => import('./nodes/StatsNode').then(m => ({ default: m.StatsNode })));
+ const WordCloudNode = React.lazy(() => import('./nodes/WordCloudNode').then(m => ({ default: m.WordCloudNode })));
+ const TimelineNode = React.lazy(() => import('./nodes/TimelineNode').then(m => ({ default: m.TimelineNode })));
+ const SentimentNode = React.lazy(() => import('./nodes/SentimentNode').then(m => ({ default: m.SentimentNode })));
+ const CooccurrenceNode = React.lazy(() => import('./nodes/CooccurrenceNode').then(m => ({ default: m.CooccurrenceNode })));
+ const ClusterNode = React.lazy(() => import('./nodes/ClusterNode').then(m => ({ default: m.ClusterNode })));
+ const MatrixNode = React.lazy(() => import('./nodes/MatrixNode').then(m => ({ default: m.MatrixNode })));
+ const TreemapNode = React.lazy(() => import('./nodes/TreemapNode').then(m => ({ default: m.TreemapNode })));
+ const ComparisonNode = React.lazy(() => import('./nodes/ComparisonNode').then(m => ({ default: m.ComparisonNode })));
+
+ // Wrap each in <Suspense fallback={<NodeLoadingSkeleton />} /> at use site
```

Wrap each lazy node with Suspense:

```typescript
const wrapLazy = (Component: any) => (props: any) => (
  <Suspense fallback={<NodeLoadingSkeleton />}>
    <Component {...props} />
  </Suspense>
);

export const nodeTypes = {
  transcript: TranscriptNode,
  question: QuestionNode,
  memo: MemoNode,
  stats: wrapLazy(StatsNode),
  wordcloud: wrapLazy(WordCloudNode),
  // ... etc
};
```

## Fix 5 — Decouple position save (~3 hours, medium-large win at scale)

**Why:** Every drag round-trips: Zustand `setPosition` → `posMap` rebuild → `buildNodes` rebuild → `setNodes`. With 50 nodes and a 5-second drag, that's ~150 rebuilds.

**File:** `apps/frontend/src/components/canvas/CanvasWorkspace.tsx` (around lines 706-714 and 397-627)

**Strategy:** Let React Flow be authoritative for positions during a session. Only push to Zustand on `onNodeDragStop`, debounced 500ms.

```diff
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChangeReactFlow(changes);

    // Detect drag end
    const dragEnds = changes.filter(c => c.type === 'position' && !c.dragging);
    if (dragEnds.length > 0) {
+     // Debounce-save layout (don't rebuild buildNodes())
+     debouncedSaveLayoutFromReactFlow(dragEnds);
-     // Old: write to Zustand → triggers buildNodes rebuild
-     updatePositions(dragEnds);
    }
  }, [onNodesChangeReactFlow]);

  // Remove posMap from buildNodes dependency array
- }, [activeCanvas, posMap, /* ... 25 more */]);
+ }, [activeCanvas, /* ... only data deps, not position deps */]);

  // buildNodes reads positions ONCE on canvas-switch, not per drag:
  function buildNodes() {
    // ...
    nodes.push({
      ...,
-     position: posMap.get(transcript.id) || { x: 0, y: 0 },
+     position: rfInstanceRef.current?.getNode(`transcript-${transcript.id}`)?.position
+               ?? initialPositions.get(transcript.id)
+               ?? { x: 0, y: 0 },
    });
  }
```

`debouncedSaveLayoutFromReactFlow` writes to backend + Zustand but does NOT trigger `buildNodes`.

## Tests

- Perf: drag 1 node for 5s → React DevTools profiler shows <10 renders (was ~150)
- Perf: open canvas with 100 nodes → initial JS payload <250KB brotli (was ~370KB)
- E2E: existing 683 tests must pass unchanged
- Visual regression: no diffs

## Acceptance criteria

- [ ] All 5 fixes shipped
- [ ] React DevTools Profiler: drag 50-node canvas at 60fps
- [ ] Bundle analyzer: chart-heavy nodes split into separate chunks
- [ ] `prisma migrate` runs unchanged (no DB impact)
- [ ] All 937 unit tests + 683 E2E tests pass

## Rollback

- Each fix is independently revertable
- `createWithEqualityFn` is the riskiest — has fallback at zustand level

## Telemetry

- Track `canvas_render_count` per session (Sentry custom measurement)
- Target: median renders during 30s session <40 (was 300+)

## Effort

**~1 week.** Fix 1 (1h). Fix 2 (30m). Fix 3 (15m). Fix 4 (2h). Fix 5 (3h). Tests + tuning (2-3 days).

## Owner

TBD

## Commit message

```
perf(canvas): top 5 React Flow optimizations

1. Stable node data callbacks — defeats memo storm during drag
2. canvasStore → createWithEqualityFn(..., shallow) — fixes accidental re-renders
3. Stabilize inline ReactFlow props (onInit, onMove, onMoveEnd) with useCallback
4. Lazy-load 9 chart-heavy node types (recharts ~200KB out of initial bundle)
5. Decouple position save from buildNodes — drag no longer rebuilds entire canvas

60fps drag at 50 nodes. Initial canvas-page JS down ~30%.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
