import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';

/**
 * A saved viewport position on the canvas.
 */
export interface Bookmark {
  x: number;
  y: number;
  zoom: number;
}

const SLOT_COUNT = 5;
const STORAGE_KEY_PREFIX = 'canvas-bookmarks-';

function emptySlots(): (Bookmark | null)[] {
  return Array.from({ length: SLOT_COUNT }, () => null);
}

function getStorageKey(canvasId: string): string {
  return `${STORAGE_KEY_PREFIX}${canvasId}`;
}

function loadBookmarks(canvasId: string): (Bookmark | null)[] {
  try {
    const raw = localStorage.getItem(getStorageKey(canvasId));
    if (!raw) return emptySlots();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== SLOT_COUNT) return emptySlots();
    // Validate each entry is a valid bookmark or null
    return parsed.map((entry: unknown) => {
      if (entry === null) return null;
      if (
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as Bookmark).x === 'number' &&
        typeof (entry as Bookmark).y === 'number' &&
        typeof (entry as Bookmark).zoom === 'number'
      ) {
        return entry as Bookmark;
      }
      return null;
    });
  } catch {
    return emptySlots();
  }
}

function persistBookmarks(canvasId: string, bookmarks: (Bookmark | null)[]): void {
  try {
    localStorage.setItem(getStorageKey(canvasId), JSON.stringify(bookmarks));
  } catch {
    // localStorage may be full or unavailable; silently ignore
  }
}

export interface UseCanvasBookmarksReturn {
  /** Current bookmark slots (5 slots, indexed 0-4, mapped to keys 1-5). */
  bookmarks: (Bookmark | null)[];
  /** Save a viewport position to a slot (0-4). */
  saveBookmark: (slot: number, viewport: { x: number; y: number; zoom: number }) => void;
  /** Recall a saved viewport from a slot (0-4). Returns null if the slot is empty. */
  recallBookmark: (slot: number) => Bookmark | null;
  /** Check whether a slot has a saved bookmark. */
  hasBookmark: (slot: number) => boolean;
}

/**
 * Manages viewport bookmarks for the active canvas.
 *
 * Provides 5 bookmark slots (0-4, mapped to keyboard keys 1-5) that persist
 * viewport positions (x, y, zoom) in localStorage, scoped per canvas.
 *
 * Usage:
 * - Ctrl+Shift+1..5 to save the current viewport to a slot
 * - Shift+1..5 (or however the consumer wires it) to recall
 */
export function useCanvasBookmarks(): UseCanvasBookmarksReturn {
  const canvasId = useCanvasStore((s) => s.activeCanvasId);
  const [bookmarks, setBookmarks] = useState<(Bookmark | null)[]>(emptySlots);

  // Load bookmarks from localStorage whenever canvasId changes
  useEffect(() => {
    if (!canvasId) {
      setBookmarks(emptySlots());
      return;
    }
    setBookmarks(loadBookmarks(canvasId));
  }, [canvasId]);

  const saveBookmark = useCallback(
    (slot: number, viewport: { x: number; y: number; zoom: number }) => {
      if (!canvasId) return;
      if (slot < 0 || slot >= SLOT_COUNT) return;

      const bookmark: Bookmark = {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      };

      setBookmarks((prev) => {
        const next = [...prev];
        next[slot] = bookmark;
        persistBookmarks(canvasId, next);
        return next;
      });
    },
    [canvasId],
  );

  const recallBookmark = useCallback(
    (slot: number): Bookmark | null => {
      if (slot < 0 || slot >= SLOT_COUNT) return null;
      return bookmarks[slot] ?? null;
    },
    [bookmarks],
  );

  const hasBookmark = useCallback(
    (slot: number): boolean => {
      if (slot < 0 || slot >= SLOT_COUNT) return false;
      return bookmarks[slot] !== null;
    },
    [bookmarks],
  );

  return { bookmarks, saveBookmark, recallBookmark, hasBookmark };
}
