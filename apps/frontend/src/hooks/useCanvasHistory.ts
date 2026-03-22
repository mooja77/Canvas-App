import { useRef, useState, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
}

export interface UseCanvasHistoryReturn {
  /** Capture current state as a history snapshot. Call AFTER an action completes. */
  pushState: (nodes: Node[], edges: Edge[]) => void;
  /** Undo: returns the previous state to restore, or null if nothing to undo. */
  undo: () => { nodes: Node[]; edges: Edge[] } | null;
  /** Redo: returns the next state to restore, or null if nothing to redo. */
  redo: () => { nodes: Node[]; edges: Edge[] } | null;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 300;

/**
 * Clone only layout-relevant parts of nodes/edges for history.
 * Strips callbacks and heavy data to keep memory low.
 */
function cloneForHistory(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const clonedNodes = nodes.map(n => ({
    id: n.id,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: {},
    style: n.style ? { ...n.style } : undefined,
    measured: n.measured ? { ...n.measured } : undefined,
    selected: false,
    hidden: n.hidden,
    parentId: n.parentId,
    extent: n.extent,
    expandParent: n.expandParent,
  })) as Node[];

  const clonedEdges = edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: e.type,
    data: e.data ? { ...e.data } : {},
    label: e.label,
    hidden: e.hidden,
  })) as Edge[];

  return { nodes: clonedNodes, edges: clonedEdges };
}

/**
 * Undo/redo history for canvas layout changes.
 *
 * Uses a timeline array + pointer model:
 * - timeline: [snap0, snap1, snap2, ...]
 * - pointer: index of the current state in the timeline
 * - pushState appends after pointer, truncates any redo entries
 * - undo decrements pointer, redo increments pointer
 */
export function useCanvasHistory(): UseCanvasHistoryReturn {
  const timelineRef = useRef<HistoryEntry[]>([]);
  const pointerRef = useRef<number>(-1);
  const lastPushTimeRef = useRef<number>(0);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = useCallback(() => {
    setCanUndo(pointerRef.current > 0);
    setCanRedo(pointerRef.current < timelineRef.current.length - 1);
  }, []);

  const pushState = useCallback((nodes: Node[], edges: Edge[]) => {
    const now = Date.now();

    // Debounce rapid pushes — replace last entry if within threshold
    if (now - lastPushTimeRef.current < DEBOUNCE_MS && pointerRef.current >= 0) {
      const { nodes: cn, edges: ce } = cloneForHistory(nodes, edges);
      timelineRef.current[pointerRef.current] = { nodes: cn, edges: ce, timestamp: now };
      lastPushTimeRef.current = now;
      updateFlags();
      return;
    }
    lastPushTimeRef.current = now;

    const { nodes: cn, edges: ce } = cloneForHistory(nodes, edges);

    // Truncate any redo entries beyond current pointer
    timelineRef.current = timelineRef.current.slice(0, pointerRef.current + 1);

    // Add new entry
    timelineRef.current.push({ nodes: cn, edges: ce, timestamp: now });

    // Trim oldest if over max
    if (timelineRef.current.length > MAX_HISTORY) {
      const excess = timelineRef.current.length - MAX_HISTORY;
      timelineRef.current = timelineRef.current.slice(excess);
    }

    pointerRef.current = timelineRef.current.length - 1;
    updateFlags();
  }, [updateFlags]);

  const undo = useCallback((): { nodes: Node[]; edges: Edge[] } | null => {
    if (pointerRef.current <= 0) return null;

    pointerRef.current--;
    const entry = timelineRef.current[pointerRef.current];
    updateFlags();
    return { nodes: entry.nodes, edges: entry.edges };
  }, [updateFlags]);

  const redo = useCallback((): { nodes: Node[]; edges: Edge[] } | null => {
    if (pointerRef.current >= timelineRef.current.length - 1) return null;

    pointerRef.current++;
    const entry = timelineRef.current[pointerRef.current];
    updateFlags();
    return { nodes: entry.nodes, edges: entry.edges };
  }, [updateFlags]);

  const clearHistory = useCallback(() => {
    timelineRef.current = [];
    pointerRef.current = -1;
    lastPushTimeRef.current = 0;
    updateFlags();
  }, [updateFlags]);

  return { pushState, undo, redo, canUndo, canRedo, clearHistory };
}
