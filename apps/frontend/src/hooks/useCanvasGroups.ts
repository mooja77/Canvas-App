import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';

/**
 * Metadata for a visual group on the canvas.
 * Stores initial position/size so groups render immediately.
 * The layout save system also persists position (posMap takes precedence).
 */
export interface CanvasGroup {
  id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_KEY_PREFIX = 'canvas-groups-';

function getStorageKey(canvasId: string): string {
  return `${STORAGE_KEY_PREFIX}${canvasId}`;
}

function loadGroups(canvasId: string): CanvasGroup[] {
  try {
    const raw = localStorage.getItem(getStorageKey(canvasId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (g: unknown) =>
        typeof g === 'object' &&
        g !== null &&
        typeof (g as CanvasGroup).id === 'string' &&
        typeof (g as CanvasGroup).title === 'string' &&
        typeof (g as CanvasGroup).color === 'string' &&
        typeof (g as CanvasGroup).x === 'number' &&
        typeof (g as CanvasGroup).y === 'number' &&
        typeof (g as CanvasGroup).width === 'number' &&
        typeof (g as CanvasGroup).height === 'number',
    ) as CanvasGroup[];
  } catch {
    return [];
  }
}

function persistGroups(canvasId: string, groups: CanvasGroup[]): void {
  try {
    localStorage.setItem(getStorageKey(canvasId), JSON.stringify(groups));
  } catch {
    // localStorage may be full or unavailable
  }
}

let nextGroupId = 1;

export interface UseCanvasGroupsReturn {
  groups: CanvasGroup[];
  addGroup: (title: string, color: string, x: number, y: number, width: number, height: number) => string;
  removeGroup: (id: string) => void;
  updateGroup: (id: string, updates: Partial<Omit<CanvasGroup, 'id'>>) => void;
}

/**
 * Manages visual groups on the canvas.
 *
 * Group metadata (title, color, position, size) is persisted in localStorage per canvas.
 * The layout save system also stores position; posMap data takes precedence when available.
 */
export function useCanvasGroups(): UseCanvasGroupsReturn {
  const canvasId = useCanvasStore((s) => s.activeCanvasId);
  const [groups, setGroups] = useState<CanvasGroup[]>([]);

  useEffect(() => {
    if (!canvasId) {
      setGroups([]);
      return;
    }
    setGroups(loadGroups(canvasId));
  }, [canvasId]);

  const addGroup = useCallback(
    (title: string, color: string, x: number, y: number, width: number, height: number): string => {
      if (!canvasId) return '';
      const id = `g-${Date.now()}-${nextGroupId++}`;
      const newGroup: CanvasGroup = { id, title, color, x, y, width, height };
      setGroups((prev) => {
        const next = [...prev, newGroup];
        persistGroups(canvasId, next);
        return next;
      });
      return id;
    },
    [canvasId],
  );

  const removeGroup = useCallback(
    (id: string) => {
      if (!canvasId) return;
      setGroups((prev) => {
        const next = prev.filter((g) => g.id !== id);
        persistGroups(canvasId, next);
        return next;
      });
    },
    [canvasId],
  );

  const updateGroup = useCallback(
    (id: string, updates: Partial<Omit<CanvasGroup, 'id'>>) => {
      if (!canvasId) return;
      setGroups((prev) => {
        const next = prev.map((g) => (g.id === id ? { ...g, ...updates } : g));
        persistGroups(canvasId, next);
        return next;
      });
    },
    [canvasId],
  );

  return { groups, addGroup, removeGroup, updateGroup };
}
