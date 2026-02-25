import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ComputedNodeType } from '@canvas-app/shared';

interface QuickAddMenuProps {
  x: number;
  y: number;
  onAddTranscript: () => void;
  onAddQuestion: () => void;
  onAddMemo: () => void;
  onAddComputedNode: (type: ComputedNodeType, label: string) => void;
  onAddStickyNote?: () => void;
  onClose: () => void;
}

const ALL_ITEMS: { id: string; label: string; category: string; color: string; computedType?: ComputedNodeType }[] = [
  { id: 'transcript', label: 'Transcript', category: 'Core', color: '#3B82F6' },
  { id: 'question', label: 'Research Question', category: 'Core', color: '#8B5CF6' },
  { id: 'memo', label: 'Memo', category: 'Core', color: '#F59E0B' },
  { id: 'sticky', label: 'Sticky Note', category: 'Core', color: '#FBBF24' },
  { id: 'search', label: 'Text Search', category: 'Analysis', color: '#059669', computedType: 'search' },
  { id: 'cooccurrence', label: 'Co-occurrence', category: 'Analysis', color: '#7C3AED', computedType: 'cooccurrence' },
  { id: 'matrix', label: 'Framework Matrix', category: 'Analysis', color: '#D97706', computedType: 'matrix' },
  { id: 'stats', label: 'Statistics', category: 'Analysis', color: '#3B82F6', computedType: 'stats' },
  { id: 'comparison', label: 'Comparison', category: 'Analysis', color: '#EC4899', computedType: 'comparison' },
  { id: 'wordcloud', label: 'Word Cloud', category: 'Analysis', color: '#6366F1', computedType: 'wordcloud' },
  { id: 'cluster', label: 'Clustering', category: 'Analysis', color: '#14B8A6', computedType: 'cluster' },
  { id: 'codingquery', label: 'Coding Query', category: 'Analysis', color: '#DC2626', computedType: 'codingquery' },
  { id: 'sentiment', label: 'Sentiment', category: 'Analysis', color: '#F59E0B', computedType: 'sentiment' },
  { id: 'treemap', label: 'Theme Map', category: 'Analysis', color: '#8B5CF6', computedType: 'treemap' },
];

export default function QuickAddMenu({
  x,
  y,
  onAddTranscript,
  onAddQuestion,
  onAddMemo,
  onAddComputedNode,
  onAddStickyNote,
  onClose,
}: QuickAddMenuProps) {
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
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

  const filtered = filter
    ? ALL_ITEMS.filter(i => i.label.toLowerCase().includes(filter.toLowerCase()))
    : ALL_ITEMS;

  const categories = [...new Set(filtered.map(i => i.category))];

  const handleSelect = (item: typeof ALL_ITEMS[0]) => {
    if (item.id === 'transcript') onAddTranscript();
    else if (item.id === 'question') onAddQuestion();
    else if (item.id === 'memo') onAddMemo();
    else if (item.id === 'sticky') onAddStickyNote?.();
    else if (item.computedType) onAddComputedNode(item.computedType, item.label);
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] w-56 rounded-xl border border-gray-200/60 bg-white/95 shadow-lg backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
      style={{ left: x, top: y }}
    >
      <div className="p-2">
        <input
          ref={inputRef}
          type="text"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          placeholder="Search nodes..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      <div className="max-h-64 overflow-y-auto pb-1">
        {categories.map(cat => (
          <div key={cat}>
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {cat}
            </div>
            {filtered.filter(i => i.category === cat).map(item => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-750"
              >
                <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-xs text-gray-400">No matching nodes</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
