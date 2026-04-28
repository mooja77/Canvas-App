import { describe, expect, it } from 'vitest';
import { getCodingIdsFromEdgeData } from './canvasEdgeUtils';

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
