import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import { decorateNode, decorateNodes, SEARCH_DIM_OPACITY, MUTED_OPACITY, MUTED_BORDER } from './canvasNodeDecoration';

function node(id: string, style: Record<string, unknown> = {}): Node {
  return {
    id,
    type: id.split('-')[0],
    position: { x: 0, y: 0 },
    data: { label: id },
    style: { transition: 'opacity 0.2s', ...style },
  };
}

const NONE = { highlightedNodeIds: new Set<string>(), mutedNodeIds: new Set<string>() };

describe('decorateNodes — idle fast path', () => {
  it('returns the SAME array reference when no search and nothing muted', () => {
    const nodes = [node('transcript-1'), node('question-2')];
    expect(decorateNodes(nodes, NONE)).toBe(nodes);
  });

  it('returns each node by identity when nothing applies to it', () => {
    const n = node('transcript-1');
    // muted set is non-empty (so we leave the fast path) but doesn't match n
    const out = decorateNodes([n], { highlightedNodeIds: new Set(), mutedNodeIds: new Set(['other']) });
    expect(out[0]).toBe(n);
  });
});

describe('decorateNode — search dimming', () => {
  const search = (highlighted: string[]) => ({
    highlightedNodeIds: new Set(highlighted),
    mutedNodeIds: new Set<string>(),
  });

  it('dims a transcript node that is not in the highlight set', () => {
    const out = decorateNode(node('transcript-9'), search(['transcript-1']));
    expect(out.style?.opacity).toBe(SEARCH_DIM_OPACITY);
  });

  it('does NOT dim a transcript node that IS highlighted (identity preserved)', () => {
    const n = node('transcript-1');
    const out = decorateNode(n, search(['transcript-1']));
    expect(out).toBe(n);
    expect(out.style?.opacity).toBeUndefined();
  });

  it('dims question and memo nodes when unmatched', () => {
    expect(decorateNode(node('question-3'), search(['x'])).style?.opacity).toBe(SEARCH_DIM_OPACITY);
    expect(decorateNode(node('memo-3'), search(['x'])).style?.opacity).toBe(SEARCH_DIM_OPACITY);
  });

  it('always dims case and computed nodes during any search, even if "highlighted"', () => {
    expect(decorateNode(node('case-1'), search(['case-1'])).style?.opacity).toBe(SEARCH_DIM_OPACITY);
    expect(decorateNode(node('computed-1'), search(['x'])).style?.opacity).toBe(SEARCH_DIM_OPACITY);
  });

  it('never search-dims group, sticky, or reroute nodes', () => {
    expect(decorateNode(node('group-1'), search(['x'])).style?.opacity).toBeUndefined();
    expect(decorateNode(node('sticky-1'), search(['x'])).style?.opacity).toBeUndefined();
    expect(decorateNode(node('reroute-1'), search(['x'])).style?.opacity).toBeUndefined();
  });

  it('preserves existing style props (e.g. width) while adding opacity', () => {
    const out = decorateNode(node('transcript-9', { width: 400 }), search(['x']));
    expect(out.style?.width).toBe(400);
    expect(out.style?.transition).toBe('opacity 0.2s');
    expect(out.style?.opacity).toBe(SEARCH_DIM_OPACITY);
  });
});

describe('decorateNode — muted', () => {
  it('applies muted opacity, border, and data.muted flag', () => {
    const out = decorateNode(node('transcript-1'), {
      highlightedNodeIds: new Set(),
      mutedNodeIds: new Set(['transcript-1']),
    });
    expect(out.style?.opacity).toBe(MUTED_OPACITY);
    expect(out.style?.border).toBe(MUTED_BORDER);
    expect((out.data as { muted?: boolean }).muted).toBe(true);
  });

  it('muted overrides search-dim opacity for an unmatched node', () => {
    const out = decorateNode(node('transcript-9'), {
      highlightedNodeIds: new Set(['transcript-1']),
      mutedNodeIds: new Set(['transcript-9']),
    });
    expect(out.style?.opacity).toBe(MUTED_OPACITY);
    expect(out.style?.border).toBe(MUTED_BORDER);
  });
});
