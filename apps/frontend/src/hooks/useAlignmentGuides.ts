import { useState, useCallback, useRef } from 'react';
import type { Node } from '@xyflow/react';

export interface GuideLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: 'horizontal' | 'vertical';
}

const SNAP_THRESHOLD = 5;
const CANVAS_EXTENT = 10000; // guide lines extend across this range

interface NodeBounds {
  id: string;
  left: number;
  centerX: number;
  right: number;
  top: number;
  centerY: number;
  bottom: number;
}

function getNodeBounds(node: Node): NodeBounds {
  const w = (node.measured?.width ?? node.width ?? 200) as number;
  const h = (node.measured?.height ?? node.height ?? 100) as number;
  const x = node.position.x;
  const y = node.position.y;
  return {
    id: node.id,
    left: x,
    centerX: x + w / 2,
    right: x + w,
    top: y,
    centerY: y + h / 2,
    bottom: y + h,
  };
}

export function useAlignmentGuides() {
  const [guideLines, setGuideLines] = useState<GuideLine[]>([]);
  const snappedPosRef = useRef<{ x?: number; y?: number }>({});

  const onNodeDrag = useCallback((_event: React.MouseEvent, draggedNode: Node, allNodes: Node[]) => {
    const dragged = getNodeBounds(draggedNode);
    const guides: GuideLine[] = [];
    let snapX: number | undefined;
    let snapY: number | undefined;

    const draggedW = (draggedNode.measured?.width ?? draggedNode.width ?? 200) as number;
    const draggedH = (draggedNode.measured?.height ?? draggedNode.height ?? 100) as number;

    for (const node of allNodes) {
      if (node.id === draggedNode.id) continue;
      const other = getNodeBounds(node);

      // Vertical alignment checks (x-axis matches)
      const vChecks: Array<{ dragVal: number; otherVal: number; snapOffset: number }> = [
        { dragVal: dragged.left, otherVal: other.left, snapOffset: 0 },
        { dragVal: dragged.left, otherVal: other.centerX, snapOffset: 0 },
        { dragVal: dragged.left, otherVal: other.right, snapOffset: 0 },
        { dragVal: dragged.centerX, otherVal: other.left, snapOffset: -draggedW / 2 },
        { dragVal: dragged.centerX, otherVal: other.centerX, snapOffset: -draggedW / 2 },
        { dragVal: dragged.centerX, otherVal: other.right, snapOffset: -draggedW / 2 },
        { dragVal: dragged.right, otherVal: other.left, snapOffset: -draggedW },
        { dragVal: dragged.right, otherVal: other.centerX, snapOffset: -draggedW },
        { dragVal: dragged.right, otherVal: other.right, snapOffset: -draggedW },
      ];

      for (const { dragVal, otherVal, snapOffset } of vChecks) {
        if (Math.abs(dragVal - otherVal) < SNAP_THRESHOLD) {
          if (snapX === undefined) snapX = otherVal + snapOffset;
          guides.push({
            x1: otherVal, y1: -CANVAS_EXTENT,
            x2: otherVal, y2: CANVAS_EXTENT,
            orientation: 'vertical',
          });
          break; // one vertical guide per other node
        }
      }

      // Horizontal alignment checks (y-axis matches)
      const hChecks: Array<{ dragVal: number; otherVal: number; snapOffset: number }> = [
        { dragVal: dragged.top, otherVal: other.top, snapOffset: 0 },
        { dragVal: dragged.top, otherVal: other.centerY, snapOffset: 0 },
        { dragVal: dragged.top, otherVal: other.bottom, snapOffset: 0 },
        { dragVal: dragged.centerY, otherVal: other.top, snapOffset: -draggedH / 2 },
        { dragVal: dragged.centerY, otherVal: other.centerY, snapOffset: -draggedH / 2 },
        { dragVal: dragged.centerY, otherVal: other.bottom, snapOffset: -draggedH / 2 },
        { dragVal: dragged.bottom, otherVal: other.top, snapOffset: -draggedH },
        { dragVal: dragged.bottom, otherVal: other.centerY, snapOffset: -draggedH },
        { dragVal: dragged.bottom, otherVal: other.bottom, snapOffset: -draggedH },
      ];

      for (const { dragVal, otherVal, snapOffset } of hChecks) {
        if (Math.abs(dragVal - otherVal) < SNAP_THRESHOLD) {
          if (snapY === undefined) snapY = otherVal + snapOffset;
          guides.push({
            x1: -CANVAS_EXTENT, y1: otherVal,
            x2: CANVAS_EXTENT, y2: otherVal,
            orientation: 'horizontal',
          });
          break; // one horizontal guide per other node
        }
      }
    }

    // Deduplicate guides by position
    const seen = new Set<string>();
    const uniqueGuides = guides.filter(g => {
      const key = `${g.orientation}-${g.orientation === 'vertical' ? g.x1 : g.y1}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    snappedPosRef.current = { x: snapX, y: snapY };
    setGuideLines(uniqueGuides);
  }, []);

  const onNodeDragStop = useCallback(() => {
    setGuideLines([]);
    snappedPosRef.current = {};
  }, []);

  const getSnappedPosition = useCallback(() => snappedPosRef.current, []);

  return { guideLines, onNodeDrag, onNodeDragStop, getSnappedPosition };
}
