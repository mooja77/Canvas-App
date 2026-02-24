import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  edgeId: string;
  edgeType: string; // 'coding' | 'relation'
  label?: string;
  onDelete: () => void;
  onClose: () => void;
}

export default function EdgeContextMenu({
  x,
  y,
  edgeType,
  label,
  onDelete,
  onClose,
}: EdgeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] w-44 rounded-xl border border-gray-200/60 bg-white/95 py-1 shadow-lg backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {edgeType === 'coding' ? 'Coding Edge' : 'Relation'}
      </div>
      {label && (
        <div className="px-3 py-1 text-xs text-gray-600 dark:text-gray-300 truncate">
          {label}
        </div>
      )}
      <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-red-600 hover:bg-gray-50 dark:text-red-400 dark:hover:bg-gray-750"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
        Delete {edgeType === 'coding' ? 'Coding' : 'Relation'}
      </button>
    </div>,
    document.body,
  );
}
