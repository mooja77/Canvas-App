import { useEffect, useRef } from 'react';

interface TranscriptContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  onCodeInVivo: () => void;
  onSpreadToParagraph: () => void;
  onClose: () => void;
}

export default function TranscriptContextMenu({
  x,
  y,
  hasSelection,
  onCodeInVivo,
  onSpreadToParagraph,
  onClose,
}: TranscriptContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!hasSelection) return null;

  return (
    <div
      ref={ref}
      className="context-menu-enter fixed z-[100] min-w-[180px] rounded-xl border border-gray-200/60 bg-white/95 py-1 shadow-node backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
      style={{ left: x, top: y }}
    >
      <button
        onClick={onCodeInVivo}
        className="btn-canvas flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-gray-700 transition-colors duration-100 hover:bg-blue-50 dark:text-gray-300 dark:hover:bg-gray-750"
        title="Turn selected text into a new code"
      >
        <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
        </svg>
        Code In-Vivo
      </button>
      <button
        onClick={onSpreadToParagraph}
        className="btn-canvas flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-gray-700 transition-colors duration-100 hover:bg-blue-50 dark:text-gray-300 dark:hover:bg-gray-750"
        title="Expand this selection to the full paragraph"
      >
        <svg className="h-3.5 w-3.5 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        Spread to Paragraph
      </button>
      <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
      <button
        onClick={onClose}
        className="btn-canvas flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs text-gray-400 transition-colors duration-100 hover:bg-gray-50 dark:hover:bg-gray-750"
      >
        Cancel
      </button>
    </div>
  );
}
