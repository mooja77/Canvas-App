import { useCallback } from 'react';
import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

export type LayoutDirection = 'LR' | 'TB';

export interface LayoutOptions {
  direction?: LayoutDirection;
  nodeSpacing?: number;
  rankSpacing?: number;
  /**
   * Once a single rank holds more than this many nodes, it is wrapped into a
   * balanced multi-column grid instead of one long perpendicular line. This is
   * what stops dense code ranks collapsing into a tall vertical column
   * (ergonomics finding F4).
   */
  maxPerColumn?: number;
}

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 200;
const LAYOUT_MARGIN = 50;

function getNodeDimensions(node: Node): { width: number; height: number } {
  const w = node.measured?.width || (node.style?.width as number) || DEFAULT_NODE_WIDTH;
  const h = node.measured?.height || (node.style?.height as number) || DEFAULT_NODE_HEIGHT;
  return { width: w, height: h };
}

/**
 * Compute auto-layout positions using dagre, then re-flow each rank so that a
 * rank with many same-level nodes (e.g. dozens of codes hanging off a few
 * transcripts) becomes a balanced 2-D grid rather than one vertical stack.
 *
 * Returns a map of nodeId → { x, y } for the new top-left positions.
 */
export function computeLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const { direction = 'LR', nodeSpacing = 60, rankSpacing = 100, maxPerColumn = 6 } = options;

  // Group nodes don't participate in dagre layout.
  const layoutNodes = nodes.filter((n) => n.type !== 'group');
  if (layoutNodes.length === 0) return new Map();

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    marginx: LAYOUT_MARGIN,
    marginy: LAYOUT_MARGIN,
  });

  for (const node of layoutNodes) {
    const { width, height } = getNodeDimensions(node);
    g.setNode(node.id, { width, height });
  }

  const nodeIds = new Set(layoutNodes.map((n) => n.id));
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const isLR = direction === 'LR';

  // Collect dagre's output. dagre assigns every node in a rank the same
  // rank-axis centre (x for LR, y for TB); the cross axis is where its
  // crossing-minimisation ordering shows up.
  interface Entry {
    id: string;
    width: number;
    height: number;
    rankCoord: number;
    crossCoord: number;
  }
  const entries: Entry[] = [];
  for (const node of layoutNodes) {
    const dn = g.node(node.id);
    if (!dn) continue;
    const { width, height } = getNodeDimensions(node);
    entries.push({
      id: node.id,
      width,
      height,
      rankCoord: isLR ? dn.x : dn.y,
      crossCoord: isLR ? dn.y : dn.x,
    });
  }
  if (entries.length === 0) return new Map();

  // Cluster nodes into ranks by their (identical-per-rank) rank-axis centre.
  entries.sort((a, b) => a.rankCoord - b.rankCoord || a.crossCoord - b.crossCoord);
  const RANK_TOLERANCE = 1;
  const ranks: Entry[][] = [];
  for (const e of entries) {
    const current = ranks[ranks.length - 1];
    if (current && Math.abs(current[0].rankCoord - e.rankCoord) <= RANK_TOLERANCE) {
      current.push(e);
    } else {
      ranks.push([e]);
    }
  }
  // Preserve dagre's crossing-minimised ordering within each rank.
  for (const rank of ranks) rank.sort((a, b) => a.crossCoord - b.crossCoord);

  // Rebuild positions left-to-right (or top-to-bottom), wrapping dense ranks
  // into a balanced grid and shifting downstream ranks to make room.
  const positions = new Map<string, { x: number; y: number }>();
  let rankStart = LAYOUT_MARGIN;

  for (const rank of ranks) {
    const columns = rank.length > maxPerColumn ? Math.ceil(Math.sqrt(rank.length)) : 1;
    const rowsPerColumn = Math.ceil(rank.length / columns);

    const maxRankDim = Math.max(...rank.map((e) => (isLR ? e.width : e.height)));
    const maxCrossDim = Math.max(...rank.map((e) => (isLR ? e.height : e.width)));
    const columnStride = maxRankDim + nodeSpacing;
    const rowStride = maxCrossDim + nodeSpacing;

    for (let i = 0; i < rank.length; i++) {
      const entry = rank[i];
      const column = Math.floor(i / rowsPerColumn);
      const row = i % rowsPerColumn;
      const rankPos = rankStart + column * columnStride;
      const crossPos = LAYOUT_MARGIN + row * rowStride;
      positions.set(entry.id, isLR ? { x: rankPos, y: crossPos } : { x: crossPos, y: rankPos });
    }

    rankStart += columns * columnStride + rankSpacing;
  }

  return positions;
}

/**
 * Compute an auto-layout for a subset of nodes (a user selection) while leaving
 * every other node untouched. The arranged subset is translated so its centroid
 * stays where it was, so a researcher can tidy one cluster without losing the
 * hand-built layout of the rest of the canvas (ergonomics finding L3).
 */
export function computeSubsetLayout(
  selected: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const selectedIds = new Set(selected.map((n) => n.id));
  const subEdges = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));

  const raw = computeLayout(selected, subEdges, options);
  if (raw.size === 0) return raw;

  // Centroid of where the selected nodes currently sit.
  let curX = 0;
  let curY = 0;
  let count = 0;
  for (const node of selected) {
    if (!raw.has(node.id)) continue;
    curX += node.position.x;
    curY += node.position.y;
    count += 1;
  }
  if (count === 0) return raw;
  curX /= count;
  curY /= count;

  // Centroid of the freshly computed layout.
  let newX = 0;
  let newY = 0;
  for (const pos of raw.values()) {
    newX += pos.x;
    newY += pos.y;
  }
  newX /= raw.size;
  newY /= raw.size;

  const dx = curX - newX;
  const dy = curY - newY;

  const translated = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of raw) {
    translated.set(id, { x: pos.x + dx, y: pos.y + dy });
  }
  return translated;
}

/**
 * Hook that provides auto-layout functions for React Flow nodes.
 * Animates nodes to their new positions using CSS transitions.
 */
export function useAutoLayout(setNodes: (updater: (nds: Node[]) => Node[]) => void) {
  // Apply a position map to the canvas with a transition, then strip the
  // transition once the animation has finished.
  const applyPositions = useCallback(
    (positions: Map<string, { x: number; y: number }>) => {
      setNodes((nds) =>
        nds.map((n) => {
          const newPos = positions.get(n.id);
          if (!newPos) return n;
          return {
            ...n,
            position: newPos,
            style: {
              ...n.style,
              transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s',
            },
          };
        }),
      );

      setTimeout(() => {
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            style: {
              ...n.style,
              transition: 'opacity 0.2s',
            },
          })),
        );
      }, 600);
    },
    [setNodes],
  );

  // Re-layout the whole canvas.
  const applyLayout = useCallback(
    (nodes: Node[], edges: Edge[], options?: LayoutOptions) => {
      const positions = computeLayout(nodes, edges, options);
      if (positions.size === 0) return;
      applyPositions(positions);
    },
    [applyPositions],
  );

  // Re-layout only the selected nodes, leaving everything else in place.
  const applyLayoutSubset = useCallback(
    (selected: Node[], edges: Edge[], options?: LayoutOptions) => {
      const positions = computeSubsetLayout(selected, edges, options);
      if (positions.size === 0) return;
      applyPositions(positions);
    },
    [applyPositions],
  );

  return { applyLayout, applyLayoutSubset };
}
