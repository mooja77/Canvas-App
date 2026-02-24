import { useCallback, useRef } from 'react';

export interface HistoryAction {
  type: string;
  description: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

const MAX_HISTORY = 50;

export function useCanvasHistory() {
  const pastRef = useRef<HistoryAction[]>([]);
  const futureRef = useRef<HistoryAction[]>([]);
  // Force re-render counter
  const renderRef = useRef(0);
  const forceUpdate = useCallback(() => { renderRef.current++; }, []);

  const pushAction = useCallback((action: HistoryAction) => {
    pastRef.current.push(action);
    if (pastRef.current.length > MAX_HISTORY) {
      pastRef.current.shift();
    }
    futureRef.current = [];
    forceUpdate();
  }, [forceUpdate]);

  const undo = useCallback(async () => {
    const action = pastRef.current.pop();
    if (!action) return;
    try {
      await action.undo();
      futureRef.current.push(action);
    } catch {
      // If undo fails, put it back
      pastRef.current.push(action);
    }
    forceUpdate();
  }, [forceUpdate]);

  const redo = useCallback(async () => {
    const action = futureRef.current.pop();
    if (!action) return;
    try {
      await action.redo();
      pastRef.current.push(action);
    } catch {
      futureRef.current.push(action);
    }
    forceUpdate();
  }, [forceUpdate]);

  return {
    pushAction,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
