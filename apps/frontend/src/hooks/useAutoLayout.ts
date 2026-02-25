import { useCallback } from 'react';
import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

export type LayoutDirection = 'LR' | 'TB';

interface LayoutOptions {
  direction?: LayoutDirection;
  nodeSpacing?: number;
  rankSpacing?: number;
}

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 200;

function getNodeDimensions(node: Node): { width: number; height: number } {
  const w = (node.measured?.width) || (node.style?.width as number) || DEFAULT_NODE_WIDTH;
  const h = (node.measured?.height) || (node.style?.height as number) || DEFAULT_NODE_HEIGHT;
  return { width: w, height: h };
}

/**
 * Compute auto-layout positions using dagre.
 * Returns a map of nodeId → { x, y } for the new positions.
 */
export function computeLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const { direction = 'LR', nodeSpacing = 60, rankSpacing = 100 } = options;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    marginx: 50,
    marginy: 50,
  });

  // Separate group nodes (they shouldn't participate in dagre layout)
  const layoutNodes = nodes.filter((n) => n.type !== 'group');

  // Add nodes with their dimensions
  for (const node of layoutNodes) {
    const { width, height } = getNodeDimensions(node);
    g.setNode(node.id, { width, height });
  }

  // Add edges (only for nodes in the layout)
  const nodeIds = new Set(layoutNodes.map((n) => n.id));
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();

  for (const node of layoutNodes) {
    const dagreNode = g.node(node.id);
    if (dagreNode) {
      const { width, height } = getNodeDimensions(node);
      // dagre returns center positions, convert to top-left
      positions.set(node.id, {
        x: dagreNode.x - width / 2,
        y: dagreNode.y - height / 2,
      });
    }
  }

  return positions;
}

/**
 * Hook that provides an auto-layout function for React Flow nodes.
 * Animates nodes to their new positions using CSS transitions.
 */
export function useAutoLayout(
  setNodes: (updater: (nds: Node[]) => Node[]) => void,
) {
  const applyLayout = useCallback(
    (nodes: Node[], edges: Edge[], options?: LayoutOptions) => {
      const positions = computeLayout(nodes, edges, options);
      if (positions.size === 0) return;

      // Step 1: Add transition style to all nodes
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

      // Step 2: Remove transition after animation completes
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

  return { applyLayout };
}
