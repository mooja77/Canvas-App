import type { Node } from '@xyflow/react';

interface SelectionToolbarProps {
  selectedNodes: Node[];
  position: { x: number; y: number };
  onDeleteAll: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onAlignLeft: () => void;
  onAlignTop: () => void;
  onDistributeH: () => void;
  onDistributeV: () => void;
  onAnalyzeSelection?: (transcriptIds: string[], questionIds: string[]) => void;
}

export default function SelectionToolbar({
  selectedNodes,
  position,
  onDeleteAll,
  onCollapseAll,
  onExpandAll,
  onAlignLeft,
  onAlignTop,
  onDistributeH,
  onDistributeV,
  onAnalyzeSelection,
}: SelectionToolbarProps) {
  if (selectedNodes.length < 2) return null;

  const btnClass = 'rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors';

  return (
    <div
      className="absolute z-40 flex items-center gap-0.5 rounded-xl border border-gray-200/60 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
      style={{ left: position.x, top: position.y - 50, transform: 'translateX(-50%)' }}
    >
      <span className="px-1.5 text-[10px] font-medium text-gray-400">
        {selectedNodes.length} selected
      </span>

      <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />

      {/* Alignment buttons */}
      <button onClick={onAlignLeft} className={btnClass} title="Align Left (Shift+A)">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v18M7.5 6h9M7.5 12h12M7.5 18h6" />
        </svg>
      </button>
      <button onClick={onAlignTop} className={btnClass} title="Align Top">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3.75h18M6 7.5v9M12 7.5v12M18 7.5v6" />
        </svg>
      </button>
      <button onClick={onDistributeH} className={btnClass} title="Distribute Horizontally (Shift+D)">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v18m10.5-18v18M3.75 12h16.5" />
        </svg>
      </button>
      <button onClick={onDistributeV} className={btnClass} title="Distribute Vertically">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75h18m-18 10.5h18M12 3.75v16.5" />
        </svg>
      </button>

      <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />

      {/* Collapse/Expand */}
      <button onClick={onCollapseAll} className={btnClass} title="Collapse All">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
        </svg>
      </button>
      <button onClick={onExpandAll} className={btnClass} title="Expand All">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
      </button>

      {/* Analyze Selection */}
      {onAnalyzeSelection && (() => {
        const transcriptIds = selectedNodes.filter(n => n.type === 'transcript').map(n => n.id.replace('transcript-', ''));
        const questionIds = selectedNodes.filter(n => n.type === 'question').map(n => n.id.replace('question-', ''));
        if (transcriptIds.length > 0 || questionIds.length > 0) {
          return (
            <>
              <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
              <button
                onClick={() => onAnalyzeSelection(transcriptIds, questionIds)}
                className={btnClass}
                title="Analyze Selection"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </button>
            </>
          );
        }
        return null;
      })()}

      <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />

      {/* Delete */}
      <button onClick={onDeleteAll} className="rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors" title="Delete All Selected">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </button>
    </div>
  );
}
