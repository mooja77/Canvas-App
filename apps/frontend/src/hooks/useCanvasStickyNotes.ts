import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';

export interface StickyNote {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_KEY_PREFIX = 'canvas-stickies-';
const STICKY_COLORS = ['#FEF3C7', '#FCE7F3', '#DBEAFE', '#D1FAE5', '#EDE9FE', '#FEE2E2'];

function getStorageKey(canvasId: string): string {
  return `${STORAGE_KEY_PREFIX}${canvasId}`;
}

function loadNotes(canvasId: string): StickyNote[] {
  try {
    const raw = localStorage.getItem(getStorageKey(canvasId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n: unknown) =>
        typeof n === 'object' &&
        n !== null &&
        typeof (n as StickyNote).id === 'string' &&
        typeof (n as StickyNote).text === 'string',
    ) as StickyNote[];
  } catch {
    return [];
  }
}

function persistNotes(canvasId: string, notes: StickyNote[]): void {
  try {
    localStorage.setItem(getStorageKey(canvasId), JSON.stringify(notes));
  } catch {
    // localStorage may be full
  }
}

let nextNoteId = 1;

export interface UseCanvasStickyNotesReturn {
  stickyNotes: StickyNote[];
  addStickyNote: (x: number, y: number) => string;
  removeStickyNote: (id: string) => void;
  updateStickyNote: (id: string, updates: Partial<Omit<StickyNote, 'id'>>) => void;
}

export function useCanvasStickyNotes(): UseCanvasStickyNotesReturn {
  const canvasId = useCanvasStore((s) => s.activeCanvasId);
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);

  useEffect(() => {
    if (!canvasId) {
      setStickyNotes([]);
      return;
    }
    setStickyNotes(loadNotes(canvasId));
  }, [canvasId]);

  const addStickyNote = useCallback(
    (x: number, y: number): string => {
      if (!canvasId) return '';
      const id = `sticky-${Date.now()}-${nextNoteId++}`;
      const color = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
      const note: StickyNote = { id, text: '', color, x, y, width: 180, height: 140 };
      setStickyNotes((prev) => {
        const next = [...prev, note];
        persistNotes(canvasId, next);
        return next;
      });
      return id;
    },
    [canvasId],
  );

  const removeStickyNote = useCallback(
    (id: string) => {
      if (!canvasId) return;
      setStickyNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        persistNotes(canvasId, next);
        return next;
      });
    },
    [canvasId],
  );

  const updateStickyNote = useCallback(
    (id: string, updates: Partial<Omit<StickyNote, 'id'>>) => {
      if (!canvasId) return;
      setStickyNotes((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, ...updates } : n));
        persistNotes(canvasId, next);
        return next;
      });
    },
    [canvasId],
  );

  return { stickyNotes, addStickyNote, removeStickyNote, updateStickyNote };
}

export { STICKY_COLORS };
