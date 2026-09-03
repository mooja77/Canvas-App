import { describe, expect, it } from 'vitest';
import {
  getCodingIdsFromEdgeData,
  isDenseEdgeGraph,
  DENSE_EDGE_THRESHOLD,
  resolveEdgeSync,
  shouldHideEdgesAtZoom,
  LOW_ZOOM_EDGE_HIDE_BELOW,
  shouldCullOffscreenElements,
  VISIBLE_ELEMENT_CULL_THRESHOLD,
} from './canvasEdgeUtils';

// Bug hunt 2026-09-02: could the empty-recovery branch of the same-canvas edge
// sync resurrect an edge for a coding that no longer exists? `freshEdges` is
// buildEdges() of the store as it is in that effect run, and the sync only ever
// publishes that derivation, so the answer is no. These pin the decision table.
describe('resolveEdgeSync', () => {
  const edgeFor = (codingId: string) => ({ id: `coding-bundle-t1::${codingId}`, data: { codingId } });

  it('re-publishes the CURRENT derivation when the controlled set was emptied client-side', () => {
    // Something removed the only edge from the controlled set without deleting
    // its coding, and the store still holds the coding. Backspace used to do
    // exactly this, until CanvasWorkspace set deleteKeyCode={null}; undo to a
    // layout snapshot can still reach this state, so the branch stays.
    const fresh = [edgeFor('q1')];
    const result = resolveEdgeSync(false, [], fresh);
    expect(result).toBe(fresh);
  });

  it('cannot bring back an edge whose coding was deleted from the store', () => {
    // The coding is gone, so the derivation is empty: nothing to recover.
    expect(resolveEdgeSync(false, [], [])).toBeNull();
    // And when the deletion itself changed the builder, the empty set is published.
    expect(resolveEdgeSync(true, [edgeFor('q1')], [])).toEqual([]);
  });

  it('publishes the fresh derivation whenever the builder inputs changed', () => {
    const fresh = [edgeFor('q1'), edgeFor('q2')];
    expect(resolveEdgeSync(true, [edgeFor('q1')], fresh)).toBe(fresh);
  });

  it('leaves a partially hidden edge set alone (recovery is only for an empty set)', () => {
    expect(resolveEdgeSync(false, [edgeFor('q1')], [edgeFor('q1'), edgeFor('q2')])).toBeNull();
  });

  it('is a no-op when nothing changed', () => {
    const current = [edgeFor('q1')];
    expect(resolveEdgeSync(false, current, [edgeFor('q1')])).toBeNull();
  });
});

describe('isDenseEdgeGraph', () => {
  it('treats small edge counts as not dense', () => {
    expect(isDenseEdgeGraph(0)).toBe(false);
    expect(isDenseEdgeGraph(DENSE_EDGE_THRESHOLD)).toBe(false); // boundary stays rich
  });

  it('treats counts above the threshold as dense', () => {
    expect(isDenseEdgeGraph(DENSE_EDGE_THRESHOLD + 1)).toBe(true);
    expect(isDenseEdgeGraph(183)).toBe(true); // real WISESHIFT-scale project
  });
});

describe('shouldHideEdgesAtZoom', () => {
  const dense = DENSE_EDGE_THRESHOLD + 1;

  it('hides dense-graph edges only below the low-zoom threshold', () => {
    expect(shouldHideEdgesAtZoom(LOW_ZOOM_EDGE_HIDE_BELOW - 0.01, dense)).toBe(true);
    expect(shouldHideEdgesAtZoom(LOW_ZOOM_EDGE_HIDE_BELOW, dense)).toBe(false); // boundary keeps edges
    expect(shouldHideEdgesAtZoom(0.5, dense)).toBe(false);
  });

  it('never hides edges on a non-dense graph, even when zoomed far out', () => {
    expect(shouldHideEdgesAtZoom(0.01, DENSE_EDGE_THRESHOLD)).toBe(false);
    expect(shouldHideEdgesAtZoom(0.01, 5)).toBe(false);
  });
});

describe('shouldCullOffscreenElements', () => {
  it('renders small and threshold-sized canvases without viewport culling', () => {
    expect(shouldCullOffscreenElements(5)).toBe(false);
    expect(shouldCullOffscreenElements(VISIBLE_ELEMENT_CULL_THRESHOLD)).toBe(false);
  });

  it('enables viewport culling above the large-canvas threshold', () => {
    expect(shouldCullOffscreenElements(VISIBLE_ELEMENT_CULL_THRESHOLD + 1)).toBe(true);
    expect(shouldCullOffscreenElements(300)).toBe(true);
  });
});

describe('getCodingIdsFromEdgeData', () => {
  it('returns every coding id from bundled edge data', () => {
    expect(getCodingIdsFromEdgeData({ codingId: 'first', codings: [{ id: 'a' }, { id: 'b' }] })).toEqual(['a', 'b']);
  });

  it('falls back to the single coding id', () => {
    expect(getCodingIdsFromEdgeData({ codingId: 'single' })).toEqual(['single']);
  });

  it('returns an empty array for missing coding data', () => {
    expect(getCodingIdsFromEdgeData(undefined)).toEqual([]);
    expect(getCodingIdsFromEdgeData({ codings: [] })).toEqual([]);
  });
});
