import { useState, useEffect, useCallback } from 'react';
import { useOpenCanvas } from '../../hooks/useOpenCanvas';
import { getCrossCanvasRef, removeCrossCanvasRef, CROSS_CANVAS_REFS_CHANGED } from '../../lib/crossCanvasRefs';

interface CrossCanvasRefBadgeProps {
  nodeId: string;
}

/**
 * A small badge that appears on a node when it has a cross-canvas reference.
 * Clicking it navigates to the linked canvas.
 */
export default function CrossCanvasRefBadge({ nodeId }: CrossCanvasRefBadgeProps) {
  const openCanvas = useOpenCanvas();
  const [ref, setRef] = useState(() => getCrossCanvasRef(nodeId));

  // Re-check on mount and when nodeId changes
  useEffect(() => {
    setRef(getCrossCanvasRef(nodeId));
  }, [nodeId]);

  // Storage events fire cross-tab only. The custom event from saveAll covers
  // same-tab updates (linking a node from the context menu, etc.).
  useEffect(() => {
    const refresh = () => setRef(getCrossCanvasRef(nodeId));
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'qualcanvas-cross-refs') refresh();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(CROSS_CANVAS_REFS_CHANGED, refresh);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CROSS_CANVAS_REFS_CHANGED, refresh);
    };
  }, [nodeId]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (ref) openCanvas(ref.canvasId);
    },
    [ref, openCanvas],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeCrossCanvasRef(nodeId);
      setRef(null);
    },
    [nodeId],
  );

  if (!ref) return null;

  return (
    <div
      className="nodrag nopan flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 cursor-pointer hover:bg-blue-200 transition-colors dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-800/50"
      onClick={handleClick}
      title={`Go to "${ref.canvasName}"`}
    >
      <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
      </svg>
      <span className="max-w-[100px] truncate">{ref.canvasName}</span>
      <button
        onClick={handleRemove}
        className="ml-0.5 rounded-full p-0.5 text-blue-500 hover:bg-blue-300/50 dark:hover:bg-blue-700/50 transition-colors"
        title="Remove link"
      >
        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
