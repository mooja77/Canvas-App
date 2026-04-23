import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCanvasStore, useActiveCanvasId } from '../../stores/canvasStore';
import CanvasListPanel from './panels/CanvasListPanel';
import CanvasWorkspace from './CanvasWorkspace';

export default function CodingCanvas() {
  const activeCanvasId = useActiveCanvasId();
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

  if (activeCanvasId) {
    return (
      <div data-tour="canvas-workspace-wrapper" className="h-full">
        <CanvasWorkspace />
      </div>
    );
  }

  return <CanvasListPanel />;
}
