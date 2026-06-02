import type { Node } from '@xyflow/react';

/**
 * Search / mute decoration for canvas nodes — kept OUT of buildNodes so that
 * searching (which changes `highlightedNodeIds` on every keystroke) does not
 * re-run the expensive node rebuild (O(n²) de-overlap pass + fresh callbacks +
 * new data objects for every node). buildNodes stays purely structural; this
 * derived layer applies the transient visual state.
 *
 * The functions are pure so the exact dim/mute semantics (which used to live
 * inline in CanvasWorkspace.buildNodes) are unit-testable without a browser,
 * mirroring canvasFit.ts / canvasEdgeUtils.ts.
 */

/** Opacity for a node dimmed because it doesn't match the active search. */
export const SEARCH_DIM_OPACITY = 0.15;
/** Opacity for a node muted (bypassed) by the user. */
export const MUTED_OPACITY = 0.3;
/** Border applied to muted nodes. */
export const MUTED_BORDER = '2px dashed #9ca3af';

/**
 * Node types whose nodes dim during search UNLESS they are in the highlight set.
 * (transcript / code / memo nodes are the searchable content surfaces.)
 */
function dimsWhenUnmatched(id: string): boolean {
  return id.startsWith('transcript-') || id.startsWith('question-') || id.startsWith('memo-');
}

/**
 * Node types that always dim during any active search — they are never search
 * "hits" themselves, so while a search is running they recede. (case nodes are
 * grouping containers; computed nodes are analysis outputs.)
 */
function dimsWhileSearching(id: string): boolean {
  return id.startsWith('case-') || id.startsWith('computed-');
}

export interface NodeDecorationContext {
  highlightedNodeIds: Set<string>;
  mutedNodeIds: Set<string>;
}

/**
 * Returns the node with search-dim and/or muted styling applied. Returns the
 * SAME object reference when no decoration applies, so React Flow's memoized
 * node components skip re-rendering unaffected nodes.
 */
export function decorateNode(node: Node, ctx: NodeDecorationContext): Node {
  const { highlightedNodeIds, mutedNodeIds } = ctx;
  const isSearching = highlightedNodeIds.size > 0;

  let style = node.style;
  let data = node.data;

  if (isSearching) {
    const dim = (dimsWhenUnmatched(node.id) && !highlightedNodeIds.has(node.id)) || dimsWhileSearching(node.id);
    if (dim) style = { ...style, opacity: SEARCH_DIM_OPACITY };
  }

  // Muted is applied last so it overrides the search-dim opacity, matching the
  // original buildNodes post-pass ordering.
  if (mutedNodeIds.has(node.id)) {
    style = { ...style, opacity: MUTED_OPACITY, border: MUTED_BORDER };
    data = { ...data, muted: true };
  }

  if (style === node.style && data === node.data) return node;
  return { ...node, style, data };
}

/**
 * Applies decoration across a node array. Fast-paths to the SAME array
 * reference when there is nothing to decorate (no active search and nothing
 * muted) — the common case — so this layer is effectively free when idle.
 */
export function decorateNodes(nodes: Node[], ctx: NodeDecorationContext): Node[] {
  if (ctx.highlightedNodeIds.size === 0 && ctx.mutedNodeIds.size === 0) return nodes;
  return nodes.map((n) => decorateNode(n, ctx));
}
