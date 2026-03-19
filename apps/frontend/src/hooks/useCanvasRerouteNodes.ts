import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';

export interface RerouteNodeData {
  id: string;
  x: number;
  y: number;
  /** The original edge ID this reroute was created from */
  originalEdgeId?: string;
}

const STORAGE_KEY_PREFIX = 'canvas-reroutes-';

function getStorageKey(canvasId: string): string {
  return `${STORAGE_KEY_PREFIX}${canvasId}`;
}

function loadReroutes(canvasId: string): RerouteNodeData[] {
  try {
    const raw = localStorage.getItem(getStorageKey(canvasId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r: unknown) =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as RerouteNodeData).id === 'string' &&
        typeof (r as RerouteNodeData).x === 'number' &&
        typeof (r as RerouteNodeData).y === 'number',
    ) as RerouteNodeData[];
  } catch {
    return [];
  }
}

function persistReroutes(canvasId: string, reroutes: RerouteNodeData[]): void {
  try {
    localStorage.setItem(getStorageKey(canvasId), JSON.stringify(reroutes));
  } catch {
    // localStorage may be full
  }
}

export function useCanvasRerouteNodes() {
  const canvasId = useCanvasStore(s => s.activeCanvasId);
  const [rerouteNodes, setRerouteNodes] = useState<RerouteNodeData[]>([]);

  useEffect(() => {
    if (!canvasId) {
      setRerouteNodes([]);
      return;
    }
    setRerouteNodes(loadReroutes(canvasId));
  }, [canvasId]);

  const addReroute = useCallback((x: number, y: number, originalEdgeId?: string): RerouteNodeData => {
    const node: RerouteNodeData = {
      id: `reroute-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x,
      y,
      originalEdgeId,
    };
    if (canvasId) {
      setRerouteNodes(prev => {
        const next = [...prev, node];
        persistReroutes(canvasId, next);
        return next;
      });
    }
    return node;
  }, [canvasId]);

  const removeReroute = useCallback((id: string) => {
    if (!canvasId) return;
    setRerouteNodes(prev => {
      const next = prev.filter(r => r.id !== id);
      persistReroutes(canvasId, next);
      return next;
    });
  }, [canvasId]);

  const updateReroutePosition = useCallback((id: string, x: number, y: number) => {
    if (!canvasId) return;
    setRerouteNodes(prev => {
      const next = prev.map(r => r.id === id ? { ...r, x, y } : r);
      persistReroutes(canvasId, next);
      return next;
    });
  }, [canvasId]);

  return { rerouteNodes, addReroute, removeReroute, updateReroutePosition };
}
