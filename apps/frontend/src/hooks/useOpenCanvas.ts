import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../stores/canvasStore';

// Opens the store first, then mirrors the selected canvas into the URL.
// Direct URL/back-forward/refresh still flow through CodingCanvas's route effect.
// Ordering it this way prevents a click from firing two concurrent openCanvas
// calls: one from this hook and one from the route effect before activeCanvasId
// has updated.
export function useOpenCanvas() {
  const navigate = useNavigate();
  const openCanvas = useCanvasStore((s) => s.openCanvas);
  return useCallback(
    async (canvasId: string) => {
      await openCanvas(canvasId);
      navigate(`/canvas/${canvasId}`);
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
