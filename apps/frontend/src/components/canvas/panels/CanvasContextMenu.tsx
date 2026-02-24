import { useEffect, useRef } from 'react';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onAddTranscript: () => void;
  onAddQuestion: () => void;
  onAddMemo: () => void;
  onFitView: () => void;
  onShowShortcuts: () => void;
  onSelectAll: () => void;
  onToggleSnapGrid: () => void;
  snapToGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
}

export default function CanvasContextMenu({
  x,
  y,
  onAddTranscript,
  onAddQuestion,
  onAddMemo,
  onFitView,
  onShowShortcuts,
  onSelectAll,
  onToggleSnapGrid,
  snapToGrid,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClose,
}: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const btnClass = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-750';
  const kbdClass = 'ml-auto text-[10px] text-gray-400 font-mono';

  return (
    <div
      ref={ref}
      className="fixed z-50 w-52 rounded-xl border border-gray-200/60 bg-white/95 py-1 shadow-lg backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
      style={{ left: x, top: y }}
    >
      {/* Add nodes group */}
      <button onClick={() => { onAddTranscript(); onClose(); }} className={btnClass}>
        <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        Add Transcript
      </button>
      <button onClick={() => { onAddQuestion(); onClose(); }} className={btnClass}>
        <svg className="h-3.5 w-3.5 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
        </svg>
        Add Question
      </button>
      <button onClick={() => { onAddMemo(); onClose(); }} className={btnClass}>
        <svg className="h-3.5 w-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
        Add Memo
      </button>

      <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

      {/* Edit group */}
      <button onClick={() => { onUndo(); onClose(); }} disabled={!canUndo} className={`${btnClass} ${!canUndo ? 'opacity-40' : ''}`}>
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
        </svg>
        Undo
        <span className={kbdClass}>Ctrl+Z</span>
      </button>
      <button onClick={() => { onRedo(); onClose(); }} disabled={!canRedo} className={`${btnClass} ${!canRedo ? 'opacity-40' : ''}`}>
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
        </svg>
        Redo
        <span className={kbdClass}>Ctrl+Shift+Z</span>
      </button>
      <button onClick={() => { onSelectAll(); onClose(); }} className={btnClass}>
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
        Select All
        <span className={kbdClass}>Ctrl+A</span>
      </button>

      <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

      {/* View group */}
      <button onClick={() => { onFitView(); onClose(); }} className={btnClass}>
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
        Fit View
        <span className={kbdClass}>F</span>
      </button>
      <button onClick={() => { onToggleSnapGrid(); onClose(); }} className={btnClass}>
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-12.75m0 0A1.125 1.125 0 0 1 3.375 4.5h7.5c.621 0 1.125.504 1.125 1.125m-9.75 0h9.75m0 0v12.75" />
        </svg>
        Toggle Grid Snap
        {snapToGrid && <span className="ml-auto text-blue-500 text-[10px]">ON</span>}
        {!snapToGrid && <span className={kbdClass}>G</span>}
      </button>
      <button onClick={() => { onShowShortcuts(); onClose(); }} className={btnClass}>
        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
        </svg>
        Keyboard Shortcuts
        <span className={kbdClass}>?</span>
      </button>
    </div>
  );
}
