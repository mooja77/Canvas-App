import { describe, it, expect, vi } from 'vitest';
import { nodeKindOf, resolveNodeDelete, deleteNodesById, describeBulkDelete, describePaste } from './canvasNodeOps';

describe('nodeKindOf', () => {
  it('recognises every canvas node prefix', () => {
    expect(nodeKindOf('transcript-abc')).toBe('transcript');
    expect(nodeKindOf('question-abc')).toBe('question');
    expect(nodeKindOf('memo-abc')).toBe('memo');
    expect(nodeKindOf('case-abc')).toBe('case');
    expect(nodeKindOf('computed-abc')).toBe('computed');
    expect(nodeKindOf('group-abc')).toBe('group');
    expect(nodeKindOf('reroute-1700000000000-ab12')).toBe('reroute');
    expect(nodeKindOf('sticky-abc')).toBe('sticky');
    expect(nodeKindOf('mystery-abc')).toBeNull();
  });
});

describe('resolveNodeDelete', () => {
  it('passes the entity id and the full node id to the deleter', async () => {
    const removeReroute = vi.fn();
    const deleteMemo = vi.fn();
    await resolveNodeDelete('memo-m1', { memo: deleteMemo })!();
    await resolveNodeDelete('reroute-1700000000000-ab12', { reroute: removeReroute })!();
    expect(deleteMemo).toHaveBeenCalledWith('m1', 'memo-m1');
    expect(removeReroute).toHaveBeenCalledWith('1700000000000-ab12', 'reroute-1700000000000-ab12');
  });

  it('returns null when nothing knows how to delete the node', () => {
    expect(resolveNodeDelete('reroute-1', {})).toBeNull();
    expect(resolveNodeDelete('mystery-1', { memo: vi.fn() })).toBeNull();
  });
});

describe('deleteNodesById', () => {
  it('counts only the deletes that actually completed', async () => {
    const result = await deleteNodesById(['memo-a', 'memo-b'], {
      memo: (id: string) => (id === 'b' ? Promise.reject(new Error('View-only access')) : Promise.resolve()),
    });
    expect(result.deleted).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.unsupported).toBe(0);
  });

  it('records nodes nothing can delete as unsupported, not deleted', async () => {
    const result = await deleteNodesById(['reroute-1'], { memo: vi.fn() });
    expect(result.deleted).toBe(0);
    expect(result.unsupported).toBe(1);
  });

  it('keeps the first error so the caller can show the server message', async () => {
    const err = { response: { data: { error: 'You have view-only access' } } };
    const result = await deleteNodesById(['memo-a'], {
      memo: () => Promise.reject(err),
    });
    expect(result.firstError).toBe(err);
  });
});

describe('describeBulkDelete', () => {
  it('reports an error when nothing was deleted', () => {
    expect(describeBulkDelete({ deleted: 0, failed: 5, unsupported: 0 })).toEqual({
      kind: 'error',
      text: 'Failed to delete 5 nodes',
    });
  });

  it('reports an error when only some nodes were deleted', () => {
    const report = describeBulkDelete({ deleted: 3, failed: 2, unsupported: 0 });
    expect(report.kind).toBe('error');
    expect(report.text).toContain('3');
    expect(report.text).toContain('2');
  });

  it('reports plain success only when every node went', () => {
    expect(describeBulkDelete({ deleted: 5, failed: 0, unsupported: 0 })).toEqual({
      kind: 'success',
      text: 'Deleted 5 nodes',
    });
    expect(describeBulkDelete({ deleted: 1, failed: 0, unsupported: 0 }).text).toBe('Deleted 1 node');
  });

  it('treats unsupported nodes as failures', () => {
    expect(describeBulkDelete({ deleted: 0, failed: 0, unsupported: 1 }).kind).toBe('error');
  });
});

describe('describePaste', () => {
  it('reports an error when every paste failed', () => {
    const report = describePaste({ pasted: 0, relationsCreated: 0, failed: 3 });
    expect(report?.kind).toBe('error');
  });

  it('reports an error when only some nodes pasted', () => {
    const report = describePaste({ pasted: 2, relationsCreated: 0, failed: 1 });
    expect(report?.kind).toBe('error');
    expect(report?.text).toContain('2');
    expect(report?.text).toContain('1');
  });

  it('reports success when everything pasted', () => {
    expect(describePaste({ pasted: 2, relationsCreated: 1, failed: 0 })).toEqual({
      kind: 'success',
      text: 'Pasted 2 node(s) with 1 connection(s)',
    });
  });

  it('says nothing when there was nothing to paste', () => {
    expect(describePaste({ pasted: 0, relationsCreated: 0, failed: 0 })).toBeNull();
  });
});
