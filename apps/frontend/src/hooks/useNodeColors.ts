import { useState, useEffect, useCallback } from 'react';
import { useActiveCanvasId } from '../stores/canvasStore';

const STORAGE_KEY_PREFIX = 'canvas-node-colors-';

function getStorageKey(canvasId: string): string {
  return `${STORAGE_KEY_PREFIX}${canvasId}`;
}

function loadColors(canvasId: string): Map<string, string> {
  try {
    const raw = localStorage.getItem(getStorageKey(canvasId));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return new Map();
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function persistColors(canvasId: string, colors: Map<string, string>): void {
  try {
    localStorage.setItem(getStorageKey(canvasId), JSON.stringify(Object.fromEntries(colors)));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function useNodeColors() {
  const canvasId = useActiveCanvasId();
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!canvasId) {
      setColorMap(new Map());
      return;
    }
    setColorMap(loadColors(canvasId));
  }, [canvasId]);

  const setNodeColor = useCallback((nodeId: string, color: string) => {
    if (!canvasId) return;
    setColorMap(prev => {
      const next = new Map(prev);
      next.set(nodeId, color);
      persistColors(canvasId, next);
      return next;
    });
  }, [canvasId]);

  const clearNodeColor = useCallback((nodeId: string) => {
    if (!canvasId) return;
    setColorMap(prev => {
      const next = new Map(prev);
      next.delete(nodeId);
      persistColors(canvasId, next);
      return next;
    });
  }, [canvasId]);

  const getNodeColor = useCallback((nodeId: string): string | undefined => {
    return colorMap.get(nodeId);
  }, [colorMap]);

  return { colorMap, setNodeColor, clearNodeColor, getNodeColor };
}
