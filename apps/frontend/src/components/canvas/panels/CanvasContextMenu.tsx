import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ComputedNodeType } from '@canvas-app/shared';

// ─── Analysis node definitions (matching QuickAddMenu colors) ───

const ANALYSIS_ITEMS: { type: ComputedNodeType; label: string; color: string }[] = [
  { type: 'wordcloud', label: 'Word Cloud', color: '#6366F1' },
  { type: 'stats', label: 'Statistics', color: '#3B82F6' },
  { type: 'comparison', label: 'Comparison', color: '#EC4899' },
  { type: 'matrix', label: 'Framework Matrix', color: '#D97706' },
  { type: 'sentiment', label: 'Sentiment', color: '#F59E0B' },
  { type: 'cooccurrence', label: 'Co-occurrence', color: '#7C3AED' },
  { type: 'codingquery', label: 'Coding Query', color: '#DC2626' },
  { type: 'search', label: 'Text Search', color: '#059669' },
  { type: 'cluster', label: 'Clustering', color: '#14B8A6' },
  { type: 'treemap', label: 'Theme Map', color: '#8B5CF6' },
];

// ─── Interface ───

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onAddTranscript: () => void;
  onAddQuestion: () => void;
  onAddMemo: () => void;
  onAddComputedNode: (type: ComputedNodeType, label: string) => void;
  onFitView: () => void;
  onShowShortcuts: () => void;
  onSelectAll: () => void;
  onToggleSnapGrid: () => void;
  snapToGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout?: () => void;
  onClose: () => void;
}

export default function CanvasContextMenu({
  x,
  y,
  onAddTranscript,
  onAddQuestion,
  onAddMemo,
  onAddComputedNode,
  onFitView,
  onShowShortcuts,
  onSelectAll,
  onToggleSnapGrid,
  snapToGrid,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoLayout,
  onClose,
}: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const analysisHoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const inMain = ref.current?.contains(target);
      const inSub = analysisRef.current?.contains(target);
      if (!inMain && !inSub) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      if (analysisHoverTimeout.current) clearTimeout(analysisHoverTimeout.current);
    };
  }, [onClose]);

  const btnClass = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-750';
  const kbdClass = 'ml-auto text-[10px] text-gray-400 font-mono';
  const separator = <div className="my-1 border-t border-gray-200 dark:border-gray-700" />;

  const Icon = ({ d, className }: { d: string; className?: string }) => (
    <svg className={className || 'h-3.5 w-3.5 text-gray-400'} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );

  // ─── Analysis submenu position ───
  // Place to the right of the main menu. If near right edge, flip to left.
  const submenuLeft = x + 208 + 192 > window.innerWidth ? -192 : 208;

  const handleAnalysisEnter = () => {
    if (analysisHoverTimeout.current) clearTimeout(analysisHoverTimeout.current);
    setShowAnalysis(true);
  };

  const handleAnalysisLeave = () => {
    analysisHoverTimeout.current = setTimeout(() => setShowAnalysis(false), 200);
  };

  const handleSubmenuEnter = () => {
    if (analysisHoverTimeout.current) clearTimeout(analysisHoverTimeout.current);
  };

  const handleSubmenuLeave = () => {
    analysisHoverTimeout.current = setTimeout(() => setShowAnalysis(false), 200);
  };

  return createPortal(
    <>
      <div
        ref={ref}
        className="context-menu-enter fixed z-[9999] w-52 rounded-xl border border-gray-200/60 bg-white/95 py-1 shadow-lg backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
        style={{ left: x, top: y }}
      >
        {/* ─── Section 1: Add Data ─── */}
        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Add Data
        </div>
        <button onClick={() => { onAddTranscript(); onClose(); }} className={btnClass}>
          <Icon d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" className="h-3.5 w-3.5 text-blue-500" />
          Add Transcript
        </button>
        <button onClick={() => { onAddQuestion(); onClose(); }} className={btnClass}>
          <Icon d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" className="h-3.5 w-3.5 text-purple-500" />
          Add Question
        </button>
        <button onClick={() => { onAddMemo(); onClose(); }} className={btnClass}>
          <Icon d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" className="h-3.5 w-3.5 text-yellow-500" />
          Add Memo
        </button>

        {/* ─── Section 2: Add Analysis (hover submenu) ─── */}
        <div
          onMouseEnter={handleAnalysisEnter}
          onMouseLeave={handleAnalysisLeave}
        >
          <button
            className={`${btnClass} relative`}
            onClick={() => setShowAnalysis(prev => !prev)}
          >
            <Icon d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" className="h-3.5 w-3.5 text-emerald-500" />
            Add Analysis...
            <svg className="ml-auto h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {separator}

        {/* ─── Section 3: Edit ─── */}
        <button onClick={() => { onUndo(); onClose(); }} disabled={!canUndo} className={`${btnClass} ${!canUndo ? 'opacity-40' : ''}`}>
          <Icon d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
          Undo
          <span className={kbdClass}>Ctrl+Z</span>
        </button>
        <button onClick={() => { onRedo(); onClose(); }} disabled={!canRedo} className={`${btnClass} ${!canRedo ? 'opacity-40' : ''}`}>
          <Icon d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
          Redo
          <span className={kbdClass}>Ctrl+Shift+Z</span>
        </button>
        <button onClick={() => { onSelectAll(); onClose(); }} className={btnClass}>
          <Icon d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          Select All
          <span className={kbdClass}>Ctrl+A</span>
        </button>

        {separator}

        {/* ─── Section 4: View ─── */}
        {onAutoLayout && (
          <button onClick={() => { onAutoLayout(); onClose(); }} className={btnClass}>
            <Icon d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" className="h-3.5 w-3.5 text-blue-500" />
            Auto-Arrange
            <span className={kbdClass}>Ctrl+Shift+L</span>
          </button>
        )}
        <button onClick={() => { onFitView(); onClose(); }} className={btnClass}>
          <Icon d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          Fit View
          <span className={kbdClass}>F</span>
        </button>
        <button onClick={() => { onToggleSnapGrid(); onClose(); }} className={btnClass}>
          <Icon d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-12.75m0 0A1.125 1.125 0 0 1 3.375 4.5h7.5c.621 0 1.125.504 1.125 1.125m-9.75 0h9.75m0 0v12.75" />
          Toggle Grid Snap
          {snapToGrid && <span className="ml-auto text-blue-500 text-[10px]">ON</span>}
          {!snapToGrid && <span className={kbdClass}>G</span>}
        </button>
        <button onClick={() => { onShowShortcuts(); onClose(); }} className={btnClass}>
          <Icon d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
          Keyboard Shortcuts
          <span className={kbdClass}>?</span>
        </button>
      </div>

      {/* ─── Analysis Submenu (rendered as sibling portal for proper z-index) ─── */}
      {showAnalysis && (
        <div
          ref={analysisRef}
          className="context-menu-enter fixed z-[10000] w-48 rounded-xl border border-gray-200/60 bg-white/95 py-1 shadow-lg backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
          style={{
            left: x + submenuLeft,
            top: y + 100, // roughly aligned with the "Add Analysis..." button row
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Analysis Nodes
          </div>
          {ANALYSIS_ITEMS.map(item => (
            <button
              key={item.type}
              onClick={() => {
                onAddComputedNode(item.type, item.label);
                onClose();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-750"
            >
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>,
    document.body,
  );
}
