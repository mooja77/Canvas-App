import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../../../stores/canvasStore';

/**
 * Sprint G — Canvases panel. Lists the user's canvases (most-recently
 * touched first) and provides a "+ New canvas" affordance. Mirrors the
 * data already shown on the CanvasList page but in the always-on activity
 * sidebar so users can switch canvases without leaving the workspace.
 */
export default function CanvasesPanel() {
  const navigate = useNavigate();
  const canvases = useCanvasStore((s) => s.canvases);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const fetchCanvases = useCanvasStore((s) => s.fetchCanvases);
  const openCanvas = useCanvasStore((s) => s.openCanvas);

  useEffect(() => {
    if (canvases.length === 0) {
      void fetchCanvases();
    }
  }, [canvases.length, fetchCanvases]);

  return (
    <div className="py-2">
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => navigate('/canvas')}
          className="w-full rounded-md border border-dashed border-gray-300 dark:border-gray-700 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-300"
        >
          + New canvas
        </button>
      </div>

      {canvases.length === 0 ? (
        <p className="px-3 text-[11px] text-gray-400 dark:text-gray-500">No canvases yet. Create one to get started.</p>
      ) : (
        <ul className="px-1">
          {canvases.map((c) => {
            const isActive = c.id === activeCanvasId;
            const counts = c._count;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void openCanvas(c.id)}
                  className={`w-full flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  data-testid={`canvases-panel-canvas-${c.id}`}
                >
                  <span className="text-xs font-medium truncate w-full">{c.name}</span>
                  {counts && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {counts.transcripts} transcript{counts.transcripts === 1 ? '' : 's'} · {counts.codings} coding
                      {counts.codings === 1 ? '' : 's'}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
