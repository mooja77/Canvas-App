import { useCallback } from 'react';
import { useActiveCanvasId } from '../stores/canvasStore';
import { useCanvasArtifact } from './useCanvasArtifact';

export interface CanvasGroup {
  id: string;
  title: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  memberNodeIds?: string[];
  collapsedAsTheme?: boolean;
}

const STORAGE_KEY_PREFIX = 'canvas-groups-';
const EMPTY_GROUPS: CanvasGroup[] = [];
const isCanvasGroups = (value: unknown): value is CanvasGroup[] =>
  Array.isArray(value) &&
  value.every(
    (group) =>
      typeof group === 'object' &&
      group !== null &&
      typeof (group as CanvasGroup).id === 'string' &&
      typeof (group as CanvasGroup).title === 'string' &&
      typeof (group as CanvasGroup).color === 'string' &&
      typeof (group as CanvasGroup).x === 'number' &&
      typeof (group as CanvasGroup).y === 'number' &&
      typeof (group as CanvasGroup).width === 'number' &&
      typeof (group as CanvasGroup).height === 'number',
  );

let nextGroupId = 1;

export interface UseCanvasGroupsReturn {
  groups: CanvasGroup[];
  addGroup: (title: string, color: string, x: number, y: number, width: number, height: number) => string;
  removeGroup: (id: string) => void;
  updateGroup: (id: string, updates: Partial<Omit<CanvasGroup, 'id'>>) => void;
  setGroupMembers: (id: string, memberNodeIds: string[]) => void;
  collapseGroupAsTheme: (id: string) => void;
  expandGroup: (id: string) => void;
}

/** Server-backed visual groups with local caching for offline continuity. */
export function useCanvasGroups(): UseCanvasGroupsReturn {
  const canvasId = useActiveCanvasId();
  const [groups, setGroups] = useCanvasArtifact({
    canvasId,
    type: 'theme-groups',
    storageKeyPrefix: STORAGE_KEY_PREFIX,
    fallback: EMPTY_GROUPS,
    validate: isCanvasGroups,
  });

  const addGroup = useCallback(
    (title: string, color: string, x: number, y: number, width: number, height: number): string => {
      if (!canvasId) return '';
      const id = `g-${Date.now()}-${nextGroupId++}`;
      setGroups((previous) => [...previous, { id, title, color, x, y, width, height }]);
      return id;
    },
    [canvasId, setGroups],
  );

  const removeGroup = useCallback(
    (id: string) => {
      if (canvasId) setGroups((previous) => previous.filter((group) => group.id !== id));
    },
    [canvasId, setGroups],
  );

  const updateGroup = useCallback(
    (id: string, updates: Partial<Omit<CanvasGroup, 'id'>>) => {
      if (canvasId) {
        setGroups((previous) => previous.map((group) => (group.id === id ? { ...group, ...updates } : group)));
      }
    },
    [canvasId, setGroups],
  );

  const setGroupMembers = useCallback(
    (id: string, memberNodeIds: string[]) => {
      if (canvasId) {
        setGroups((previous) => previous.map((group) => (group.id === id ? { ...group, memberNodeIds } : group)));
      }
    },
    [canvasId, setGroups],
  );

  const collapseGroupAsTheme = useCallback(
    (id: string) => {
      if (canvasId) {
        setGroups((previous) =>
          previous.map((group) => (group.id === id ? { ...group, collapsedAsTheme: true } : group)),
        );
      }
    },
    [canvasId, setGroups],
  );

  const expandGroup = useCallback(
    (id: string) => {
      if (canvasId) {
        setGroups((previous) =>
          previous.map((group) => (group.id === id ? { ...group, collapsedAsTheme: false } : group)),
        );
      }
    },
    [canvasId, setGroups],
  );

  return { groups, addGroup, removeGroup, updateGroup, setGroupMembers, collapseGroupAsTheme, expandGroup };
}
