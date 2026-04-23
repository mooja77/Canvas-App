import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../stores/canvasStore';

// URL is the source of truth for the active canvas. We only navigate here —
// CodingCanvas's route effect picks up the URL change and calls store.openCanvas.
// This keeps the store and URL in sync without duplicate API calls, and lets
// browser back/forward/refresh/deep links all flow through the same code path.
//
// Returns an async function that resolves once the store's openCanvas settles,
// so callers that chain (e.g. SetupWizard creating starter questions) can await.
export function useOpenCanvas() {
  const navigate = useNavigate();
  const openCanvas = useCanvasStore((s) => s.openCanvas);
  return useCallback(
    async (canvasId: string) => {
      navigate(`/canvas/${canvasId}`);
      // Await the store open for callers that need activeCanvasId set before
      // follow-up actions. CodingCanvas's route effect short-circuits when
      // activeCanvasId already matches urlCanvasId, so this isn't duplicated.
      await openCanvas(canvasId);
    },
    [navigate, openCanvas],
  );
}

export function useCloseCanvas() {
  const navigate = useNavigate();
  const closeCanvas = useCanvasStore((s) => s.closeCanvas);
  return useCallback(() => {
    navigate('/canvas');
    closeCanvas();
  }, [navigate, closeCanvas]);
}
