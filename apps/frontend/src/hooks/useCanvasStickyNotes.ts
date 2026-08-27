import { useCallback } from 'react';
import { useActiveCanvasId } from '../stores/canvasStore';
import { useCanvasArtifact } from './useCanvasArtifact';

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
const EMPTY_NOTES: StickyNote[] = [];
const isStickyNotes = (value: unknown): value is StickyNote[] =>
  Array.isArray(value) &&
  value.every(
    (note) =>
      typeof note === 'object' &&
      note !== null &&
      typeof (note as StickyNote).id === 'string' &&
      typeof (note as StickyNote).text === 'string' &&
      typeof (note as StickyNote).color === 'string' &&
      typeof (note as StickyNote).x === 'number' &&
      typeof (note as StickyNote).y === 'number' &&
      typeof (note as StickyNote).width === 'number' &&
      typeof (note as StickyNote).height === 'number',
  );

let nextNoteId = 1;

export interface UseCanvasStickyNotesReturn {
  stickyNotes: StickyNote[];
  addStickyNote: (x: number, y: number) => string;
  removeStickyNote: (id: string) => void;
  updateStickyNote: (id: string, updates: Partial<Omit<StickyNote, 'id'>>) => void;
}

export function useCanvasStickyNotes(): UseCanvasStickyNotesReturn {
  const canvasId = useActiveCanvasId();
  const [stickyNotes, setStickyNotes] = useCanvasArtifact({
    canvasId,
    type: 'sticky-notes',
    storageKeyPrefix: STORAGE_KEY_PREFIX,
    fallback: EMPTY_NOTES,
    validate: isStickyNotes,
  });

  const addStickyNote = useCallback(
    (x: number, y: number): string => {
      if (!canvasId) return '';
      const id = `sticky-${Date.now()}-${nextNoteId++}`;
      const color = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
      setStickyNotes((previous) => [...previous, { id, text: '', color, x, y, width: 180, height: 140 }]);
      return id;
    },
    [canvasId, setStickyNotes],
  );

  const removeStickyNote = useCallback(
    (id: string) => {
      if (canvasId) setStickyNotes((previous) => previous.filter((note) => note.id !== id));
    },
    [canvasId, setStickyNotes],
  );

  const updateStickyNote = useCallback(
    (id: string, updates: Partial<Omit<StickyNote, 'id'>>) => {
      if (canvasId) {
        setStickyNotes((previous) => previous.map((note) => (note.id === id ? { ...note, ...updates } : note)));
      }
    },
    [canvasId, setStickyNotes],
  );

  return { stickyNotes, addStickyNote, removeStickyNote, updateStickyNote };
}

export { STICKY_COLORS };
