import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCanvasStore, useActiveCanvasId } from '../../stores/canvasStore';
import CanvasListPanel from './panels/CanvasListPanel';
import CanvasWorkspace from './CanvasWorkspace';

export default function CodingCanvas() {
  const activeCanvasId = useActiveCanvasId();
  const openCanvas = useCanvasStore(s => s.openCanvas);
  const { canvasId: urlCanvasId } = useParams<{ canvasId?: string }>();

  // Deep link: auto-open canvas from URL param
  useEffect(() => {
    if (urlCanvasId && !activeCanvasId) {
      openCanvas(urlCanvasId).catch(() => {});
    }
  }, [urlCanvasId, activeCanvasId, openCanvas]);

  if (activeCanvasId) {
    return (
      <div data-tour="canvas-workspace-wrapper" className="h-full">
        <CanvasWorkspace />
      </div>
    );
  }

  return <CanvasListPanel />;
}
