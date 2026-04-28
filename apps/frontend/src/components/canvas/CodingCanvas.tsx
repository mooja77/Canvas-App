import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCanvasStore, useActiveCanvas, useActiveCanvasId } from '../../stores/canvasStore';
import CanvasListPanel from './panels/CanvasListPanel';
import CanvasWorkspace from './CanvasWorkspace';

export default function CodingCanvas() {
  const activeCanvasId = useActiveCanvasId();
  const activeCanvas = useActiveCanvas();
  const openCanvas = useCanvasStore((s) => s.openCanvas);
  const closeCanvas = useCanvasStore((s) => s.closeCanvas);
  const { canvasId: urlCanvasId } = useParams<{ canvasId?: string }>();

  // Route is the source of truth. Sync store to url on any change —
  // including back/forward, tab switch via navigate, or refresh.
  useEffect(() => {
    if (urlCanvasId) {
      if (urlCanvasId !== activeCanvasId) {
        openCanvas(urlCanvasId).catch(() => {});
      }
    } else if (activeCanvasId) {
      closeCanvas();
    }
  }, [urlCanvasId, activeCanvasId, openCanvas, closeCanvas]);

  if (activeCanvasId && activeCanvas) {
    return (
      <div data-tour="canvas-workspace-wrapper" className="h-full">
        <CanvasWorkspace />
      </div>
    );
  }

  if (urlCanvasId || activeCanvasId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Loading canvas...
      </div>
    );
  }

  return <CanvasListPanel />;
}
