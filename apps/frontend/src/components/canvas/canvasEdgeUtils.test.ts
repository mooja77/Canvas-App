import { describe, expect, it } from 'vitest';
import {
  getCodingIdsFromEdgeData,
  isDenseEdgeGraph,
  DENSE_EDGE_THRESHOLD,
  shouldHideEdgesAtZoom,
  LOW_ZOOM_EDGE_HIDE_BELOW,
} from './canvasEdgeUtils';

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
