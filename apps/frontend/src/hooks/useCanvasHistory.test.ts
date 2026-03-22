import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasHistory } from './useCanvasHistory';
import type { Node, Edge } from '@xyflow/react';

function makeNodes(count: number, prefix = 'node'): Node[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    type: 'default',
    position: { x: i * 100, y: i * 50 },
    data: { label: `Node ${i}` },
  }));
}

function makeEdges(count: number): Edge[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `edge-${i}`,
    source: `node-${i}`,
    target: `node-${i + 1}`,
  }));
}

describe('useCanvasHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initial state — canUndo and canRedo are false', () => {
    const { result } = renderHook(() => useCanvasHistory());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('push then undo — returns previous state, canUndo becomes false', () => {
    const { result } = renderHook(() => useCanvasHistory());

    const nodes0 = makeNodes(1, 'a');
    const nodes1 = makeNodes(2, 'b');

    act(() => {
      result.current.pushState(nodes0, []);
    });
    // Advance past debounce window
    vi.advanceTimersByTime(400);

    act(() => {
      result.current.pushState(nodes1, []);
    });

    expect(result.current.canUndo).toBe(true);

    let undone: ReturnType<typeof result.current.undo> = null;
    act(() => {
      undone = result.current.undo();
    });

    // Undo returns the first pushed state (nodes0), but cloned with stripped data
    expect(undone).not.toBeNull();
    expect(undone!.nodes).toHaveLength(1);
    expect(undone!.nodes[0].id).toBe('a-0');
    expect(result.current.canUndo).toBe(false);
  });

  it('push-push-undo-undo — returns to original state', () => {
    const { result } = renderHook(() => useCanvasHistory());

    const states = [makeNodes(1, 's0'), makeNodes(2, 's1'), makeNodes(3, 's2')];

    act(() => { result.current.pushState(states[0], []); });
    vi.advanceTimersByTime(400);
    act(() => { result.current.pushState(states[1], []); });
    vi.advanceTimersByTime(400);
    act(() => { result.current.pushState(states[2], []); });

    // Undo twice to get back to states[0]
    let undone: ReturnType<typeof result.current.undo> = null;
    act(() => { undone = result.current.undo(); });
    expect(undone!.nodes).toHaveLength(2);
    expect(undone!.nodes[0].id).toBe('s1-0');

    act(() => { undone = result.current.undo(); });
    expect(undone!.nodes).toHaveLength(1);
    expect(undone!.nodes[0].id).toBe('s0-0');
    expect(result.current.canUndo).toBe(false);
  });

  it('redo after undo — returns the pushed state', () => {
    const { result } = renderHook(() => useCanvasHistory());

    const nodes0 = makeNodes(1, 'a');
    const nodes1 = makeNodes(2, 'b');

    act(() => { result.current.pushState(nodes0, []); });
    vi.advanceTimersByTime(400);
    act(() => { result.current.pushState(nodes1, []); });

    act(() => { result.current.undo(); });
    expect(result.current.canRedo).toBe(true);

    let redone: ReturnType<typeof result.current.redo> = null;
    act(() => { redone = result.current.redo(); });
    expect(redone).not.toBeNull();
    expect(redone!.nodes).toHaveLength(2);
    expect(redone!.nodes[0].id).toBe('b-0');
    expect(result.current.canRedo).toBe(false);
  });

  it('redo cleared after new push', () => {
    const { result } = renderHook(() => useCanvasHistory());

    const nodes0 = makeNodes(1, 'a');
    const nodes1 = makeNodes(2, 'b');
    const nodes2 = makeNodes(3, 'c');

    act(() => { result.current.pushState(nodes0, []); });
    vi.advanceTimersByTime(400);
    act(() => { result.current.pushState(nodes1, []); });

    act(() => { result.current.undo(); });
    expect(result.current.canRedo).toBe(true);

    vi.advanceTimersByTime(400);
    act(() => { result.current.pushState(nodes2, []); });
    expect(result.current.canRedo).toBe(false);
  });

  it('max 50 entries — push 55 states, only 50 kept, canUndo is true', () => {
    const { result } = renderHook(() => useCanvasHistory());

    for (let i = 0; i < 55; i++) {
      vi.advanceTimersByTime(400);
      act(() => { result.current.pushState(makeNodes(1, `n${i}`), []); });
    }

    expect(result.current.canUndo).toBe(true);

    // Undo 49 times (pointer goes from 49 down to 0)
    for (let i = 0; i < 49; i++) {
      act(() => { result.current.undo(); });
    }
    expect(result.current.canUndo).toBe(false);

    // Trying one more undo returns null
    let undone: ReturnType<typeof result.current.undo> = null;
    act(() => { undone = result.current.undo(); });
    expect(undone).toBeNull();
  });

  it('clearHistory — canUndo and canRedo become false', () => {
    const { result } = renderHook(() => useCanvasHistory());

    act(() => { result.current.pushState(makeNodes(1, 'first'), []); });
    vi.advanceTimersByTime(400);
    act(() => { result.current.pushState(makeNodes(2, 'second'), []); });
    vi.advanceTimersByTime(400);
    act(() => { result.current.pushState(makeNodes(3, 'third'), []); });

    act(() => { result.current.undo(); });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => { result.current.clearHistory(); });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('debounce rapid pushes — push twice within 100ms, only one entry added', () => {
    const { result } = renderHook(() => useCanvasHistory());

    // First push to establish baseline
    act(() => { result.current.pushState(makeNodes(1, 'base'), []); });

    // Two rapid pushes within debounce window (300ms)
    vi.advanceTimersByTime(400); // past debounce
    act(() => { result.current.pushState(makeNodes(2, 'rapid1'), []); });
    vi.advanceTimersByTime(50); // within 300ms debounce
    act(() => { result.current.pushState(makeNodes(3, 'rapid2'), []); });

    // Only the base + one debounced entry should exist (rapid2 replaced rapid1)
    // So undo once should get us back to base
    let undone: ReturnType<typeof result.current.undo> = null;
    act(() => { undone = result.current.undo(); });
    expect(undone!.nodes).toHaveLength(1);
    expect(undone!.nodes[0].id).toBe('base-0');

    // No more undo
    expect(result.current.canUndo).toBe(false);
  });

  it('deep clones nodes — modifying original does not affect history', () => {
    const { result } = renderHook(() => useCanvasHistory());

    const nodes = makeNodes(1, 'orig');
    act(() => { result.current.pushState(nodes, []); });

    // Mutate the original
    nodes[0].position.x = 9999;
    nodes[0].id = 'mutated';

    vi.advanceTimersByTime(400);
    act(() => { result.current.pushState(makeNodes(1, 'second'), []); });

    let undone: ReturnType<typeof result.current.undo> = null;
    act(() => { undone = result.current.undo(); });

    // Should get the original unmutated values
    expect(undone!.nodes[0].position.x).toBe(0);
    expect(undone!.nodes[0].id).toBe('orig-0');
  });
});
