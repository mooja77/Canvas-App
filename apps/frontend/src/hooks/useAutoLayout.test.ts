import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { computeLayout, computeSubsetLayout, useAutoLayout } from './useAutoLayout';
import type { Node, Edge } from '@xyflow/react';

function makeNode(id: string, opts: Partial<Node> = {}): Node {
  return {
    id,
    type: 'default',
    position: { x: 0, y: 0 },
    data: { label: id },
    ...opts,
  };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target };
}

describe('computeLayout', () => {
  it('returns empty map for empty canvas (no error)', () => {
    const result = computeLayout([], []);
    expect(result.size).toBe(0);
  });

  it('handles single node', () => {
    const nodes = [makeNode('n1')];
    const result = computeLayout(nodes, []);

    expect(result.size).toBe(1);
    expect(result.has('n1')).toBe(true);
    const pos = result.get('n1')!;
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  it('arranges nodes with edges', () => {
    const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3')];
    const edges = [makeEdge('n1', 'n2'), makeEdge('n2', 'n3')];

    const result = computeLayout(nodes, edges);

    expect(result.size).toBe(3);
    // In LR layout, n1 should be to the left of n2, n2 to the left of n3
    const pos1 = result.get('n1')!;
    const pos2 = result.get('n2')!;
    const pos3 = result.get('n3')!;
    expect(pos1.x).toBeLessThan(pos2.x);
    expect(pos2.x).toBeLessThan(pos3.x);
  });

  it('preserves node dimensions during layout', () => {
    const nodes = [
      makeNode('n1', { style: { width: 400, height: 300 } }),
      makeNode('n2', { style: { width: 400, height: 300 } }),
    ];
    const edges = [makeEdge('n1', 'n2')];

    const result = computeLayout(nodes, edges);

    // Both nodes should have valid positions
    expect(result.has('n1')).toBe(true);
    expect(result.has('n2')).toBe(true);

    // Nodes should not overlap (positions should be spaced by at least their width)
    const pos1 = result.get('n1')!;
    const pos2 = result.get('n2')!;
    const distance = Math.abs(pos2.x - pos1.x);
    expect(distance).toBeGreaterThanOrEqual(400); // at least node width
  });

  it('handles disconnected nodes (no edges)', () => {
    const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3')];
    const result = computeLayout(nodes, []);

    expect(result.size).toBe(3);
    // All nodes should have positions
    for (const id of ['n1', 'n2', 'n3']) {
      expect(result.has(id)).toBe(true);
    }
  });

  it('excludes group nodes from layout', () => {
    const nodes = [makeNode('n1'), makeNode('n2'), makeNode('g1', { type: 'group' })];
    const edges = [makeEdge('n1', 'n2')];

    const result = computeLayout(nodes, edges);

    expect(result.has('n1')).toBe(true);
    expect(result.has('n2')).toBe(true);
    expect(result.has('g1')).toBe(false);
  });

  it('supports TB direction', () => {
    const nodes = [makeNode('n1'), makeNode('n2')];
    const edges = [makeEdge('n1', 'n2')];

    const result = computeLayout(nodes, edges, { direction: 'TB' });

    // In TB layout, n1 should be above n2
    const pos1 = result.get('n1')!;
    const pos2 = result.get('n2')!;
    expect(pos1.y).toBeLessThan(pos2.y);
  });

  it('wraps a dense rank into a 2-D grid instead of one vertical column (F4)', () => {
    // One source connected to 12 codes — without wrapping all 12 codes would
    // stack into a single vertical column.
    const source = makeNode('src');
    const codes = Array.from({ length: 12 }, (_, i) => makeNode(`c${i}`));
    const edges = codes.map((c) => makeEdge('src', c.id));

    const result = computeLayout([source, ...codes], edges, { maxPerColumn: 6 });

    const codeXs = new Set(codes.map((c) => Math.round(result.get(c.id)!.x)));
    const codeYs = new Set(codes.map((c) => Math.round(result.get(c.id)!.y)));

    // The dense rank must span multiple columns AND multiple rows — a grid.
    expect(codeXs.size).toBeGreaterThan(1);
    expect(codeYs.size).toBeGreaterThan(1);
  });

  it('keeps a small rank as a single column (no wrapping below threshold)', () => {
    const source = makeNode('src');
    const codes = Array.from({ length: 4 }, (_, i) => makeNode(`c${i}`));
    const edges = codes.map((c) => makeEdge('src', c.id));

    const result = computeLayout([source, ...codes], edges, { maxPerColumn: 6 });

    const codeXs = new Set(codes.map((c) => Math.round(result.get(c.id)!.x)));
    // 4 codes, threshold 6 → still a single column (one shared x).
    expect(codeXs.size).toBe(1);
  });
});

describe('computeSubsetLayout', () => {
  it('returns empty map for empty selection', () => {
    expect(computeSubsetLayout([], []).size).toBe(0);
  });

  it('lays out only the selected nodes', () => {
    const selected = [
      makeNode('s1', { position: { x: 900, y: 900 } }),
      makeNode('s2', { position: { x: 900, y: 1100 } }),
      makeNode('s3', { position: { x: 900, y: 1300 } }),
    ];
    const edges = [makeEdge('s1', 's2'), makeEdge('s2', 's3')];

    const result = computeSubsetLayout(selected, edges);

    expect(result.size).toBe(3);
    // Chain s1→s2→s3 should read left-to-right after arranging.
    expect(result.get('s1')!.x).toBeLessThan(result.get('s2')!.x);
    expect(result.get('s2')!.x).toBeLessThan(result.get('s3')!.x);
  });

  it('keeps the arranged cluster at its original centroid', () => {
    const selected = [
      makeNode('s1', { position: { x: 1000, y: 2000 } }),
      makeNode('s2', { position: { x: 1000, y: 2400 } }),
      makeNode('s3', { position: { x: 1000, y: 2800 } }),
    ];
    const edges = [makeEdge('s1', 's2'), makeEdge('s2', 's3')];

    // Original centroid.
    const cx = (1000 + 1000 + 1000) / 3;
    const cy = (2000 + 2400 + 2800) / 3;

    const result = computeSubsetLayout(selected, edges);

    let rx = 0;
    let ry = 0;
    for (const pos of result.values()) {
      rx += pos.x;
      ry += pos.y;
    }
    rx /= result.size;
    ry /= result.size;

    // Centroid is preserved so the cluster stays where the researcher had it.
    expect(Math.abs(rx - cx)).toBeLessThan(1);
    expect(Math.abs(ry - cy)).toBeLessThan(1);
  });

  it('only considers edges within the selection', () => {
    const selected = [makeNode('s1', { position: { x: 0, y: 0 } }), makeNode('s2', { position: { x: 0, y: 200 } })];
    // Edge to a node outside the selection must be ignored, not throw.
    const edges = [makeEdge('s1', 's2'), makeEdge('s2', 'outside')];

    const result = computeSubsetLayout(selected, edges);
    expect(result.size).toBe(2);
  });
});

describe('useAutoLayout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applyLayout updates node positions via setNodes', () => {
    const setNodes = vi.fn();
    const { result } = renderHook(() => useAutoLayout(setNodes));

    const nodes = [makeNode('n1'), makeNode('n2')];
    const edges = [makeEdge('n1', 'n2')];

    act(() => {
      result.current.applyLayout(nodes, edges);
    });

    // setNodes should be called with an updater function
    expect(setNodes).toHaveBeenCalledTimes(1);
    const updater = setNodes.mock.calls[0][0];
    expect(typeof updater).toBe('function');

    // Apply the updater to the original nodes
    const updated = updater(nodes);
    expect(updated[0].position).not.toEqual({ x: 0, y: 0 });
    // Should have transition style
    expect(updated[0].style?.transition).toContain('transform');
  });

  it('removes transition style after 600ms', () => {
    const setNodes = vi.fn();
    const { result } = renderHook(() => useAutoLayout(setNodes));

    const nodes = [makeNode('n1'), makeNode('n2')];
    const edges = [makeEdge('n1', 'n2')];

    act(() => {
      result.current.applyLayout(nodes, edges);
    });

    expect(setNodes).toHaveBeenCalledTimes(1);

    // Advance past the 600ms timeout
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Second call to setNodes removes transition
    expect(setNodes).toHaveBeenCalledTimes(2);
    const updater2 = setNodes.mock.calls[1][0];
    const updated = updater2(nodes);
    expect(updated[0].style?.transition).toBe('opacity 0.2s');
  });

  it('does nothing when computeLayout returns empty positions', () => {
    const setNodes = vi.fn();
    const { result } = renderHook(() => useAutoLayout(setNodes));

    act(() => {
      result.current.applyLayout([], []);
    });

    expect(setNodes).not.toHaveBeenCalled();
  });
});
