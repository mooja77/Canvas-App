import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';

const STORAGE_KEY_PREFIX = 'canvas-code-bookmarks-';

function getStorageKey(canvasId: string): string {
  return `${STORAGE_KEY_PREFIX}${canvasId}`;
}

function loadBookmarks(canvasId: string): Set<string> {
  try {
    const raw = localStorage.getItem(getStorageKey(canvasId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id: unknown) => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function persistBookmarks(canvasId: string, bookmarks: Set<string>): void {
  try {
    localStorage.setItem(getStorageKey(canvasId), JSON.stringify([...bookmarks]));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function useCodeBookmarks() {
  const canvasId = useCanvasStore(s => s.activeCanvasId);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!canvasId) {
      setBookmarkedIds(new Set());
      return;
    }
    setBookmarkedIds(loadBookmarks(canvasId));
  }, [canvasId]);

  const toggleBookmark = useCallback((questionId: string) => {
    if (!canvasId) return;
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      persistBookmarks(canvasId, next);
      return next;
    });
  }, [canvasId]);

  const isBookmarked = useCallback((questionId: string): boolean => {
    return bookmarkedIds.has(questionId);
  }, [bookmarkedIds]);

  return { bookmarkedIds, toggleBookmark, isBookmarked };
}
