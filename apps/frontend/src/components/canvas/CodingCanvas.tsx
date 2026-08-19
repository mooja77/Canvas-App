import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCanvasStore, useActiveCanvas, useActiveCanvasId, useCanvasError } from '../../stores/canvasStore';
import CanvasListPanel from './panels/CanvasListPanel';
import CanvasWorkspace from './CanvasWorkspace';

export default function CodingCanvas() {
  const activeCanvasId = useActiveCanvasId();
  const activeCanvas = useActiveCanvas();
  const error = useCanvasError();
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
    // openCanvas refuses to serve a cached copy when the server answered 403 /
    // 404 (access revoked, or the canvas is in the trash). Without this branch
    // that lands on a "Loading canvas..." placeholder that never resolves.
    if (error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-gray-700 dark:text-gray-300">{error}</p>
          <Link
            to="/canvas"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Back to your canvases
          </Link>
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Loading canvas...
      </div>
    );
  }

  // The list lives inside CanvasPage's `<main className="overflow-hidden">`
  // (which is correct for the React Flow workspace, since it pans internally).
  // The list, however, can be taller than the viewport — so it needs its own
  // scroll container, or lower canvases get clipped with no way to reach them.
  return (
    <div className="h-full overflow-y-auto">
      <CanvasListPanel />
    </div>
  );
}
