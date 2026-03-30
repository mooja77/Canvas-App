import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ComputedNodeType } from '@qualcanvas/shared';

interface QuickAddMenuProps {
  x: number;
  y: number;
  onAddTranscript: () => void;
  onAddQuestion: () => void;
  onAddMemo: () => void;
  onAddComputedNode: (type: ComputedNodeType, label: string) => void;
  onAddStickyNote?: () => void;
  onClose: () => void;
  /** Restrict menu to only show items matching these IDs */
  allowedItems?: string[];
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

const RECENT_STORAGE_KEY = 'qualcanvas-recent-nodes';
const MAX_RECENT = 3;

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function getRecentNodeIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((v): v is string => typeof v === 'string')) {
      return parsed.slice(0, MAX_RECENT);
    }
    return [];
  } catch {
    return [];
  }
}

function pushRecentNodeId(id: string): void {
  const recent = getRecentNodeIds().filter(r => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export default function QuickAddMenu({
  x,
  y,
  onAddTranscript,
  onAddQuestion,
  onAddMemo,
  onAddComputedNode,
  onAddStickyNote,
  onClose,
  allowedItems,
}: QuickAddMenuProps) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const baseItems = allowedItems
    ? ALL_ITEMS.filter(i => allowedItems.includes(i.id))
    : ALL_ITEMS;

  // Build filtered + categorized flat list for keyboard nav
  const filtered = filter
    ? baseItems.filter(i => fuzzyMatch(i.label, filter))
    : baseItems;

  // Build the display sections: Recent (when no filter) + normal categories
  const recentIds = getRecentNodeIds();
  const showRecent = !filter && recentIds.length > 0;
  const recentItems = showRecent
    ? recentIds
        .map(id => baseItems.find(item => item.id === id))
        .filter((item): item is typeof ALL_ITEMS[number] => item !== undefined)
    : [];

  // Build flat list of all visible items (for keyboard navigation indexing)
  const flatItems: typeof ALL_ITEMS[number][] = [];
  const sections: { label: string; items: typeof ALL_ITEMS[number][] }[] = [];

  if (showRecent && recentItems.length > 0) {
    sections.push({ label: 'Recent', items: recentItems });
    flatItems.push(...recentItems);
  }

  const categories = [...new Set(filtered.map(i => i.category))];
  for (const cat of categories) {
    const catItems = filtered.filter(i => i.category === cat);
    sections.push({ label: cat, items: catItems });
    flatItems.push(...catItems);
  }

  // Clamp selectedIndex when list changes
  useEffect(() => {
    setSelectedIndex(prev => {
      if (flatItems.length === 0) return 0;
      return Math.min(prev, flatItems.length - 1);
    });
  }, [flatItems.length]);

  // Scroll selected item into view
  useEffect(() => {
    const btn = itemRefs.current.get(selectedIndex);
    if (btn) {
      btn.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback((item: typeof ALL_ITEMS[0]) => {
    pushRecentNodeId(item.id);
    if (item.id === 'transcript') onAddTranscript();
    else if (item.id === 'question') onAddQuestion();
    else if (item.id === 'memo') onAddMemo();
    else if (item.id === 'sticky') onAddStickyNote?.();
    else if (item.computedType) onAddComputedNode(item.computedType, item.label);
    onClose();
  }, [onAddTranscript, onAddQuestion, onAddMemo, onAddStickyNote, onAddComputedNode, onClose]);

  useEffect(() => {
    inputRef.current?.focus();
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (flatItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (flatItems.length || 1)) % (flatItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems.length > 0 && selectedIndex < flatItems.length) {
          handleSelect(flatItems[selectedIndex]);
        }
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  // flatItems changes on every render so we use flatItems.length + filter as proxies
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, filter, flatItems.length, selectedIndex, handleSelect]);

  // Track flat index across sections
  let flatIndex = 0;

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
          onChange={e => { setFilter(e.target.value); setSelectedIndex(0); }}
        />
      </div>

      <div className="max-h-64 overflow-y-auto pb-1">
        {sections.map(section => {
          const sectionEl = (
            <div key={section.label}>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {section.label}
              </div>
              {section.items.map(item => {
                const idx = flatIndex++;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${section.label}-${item.id}`}
                    ref={el => {
                      if (el) itemRefs.current.set(idx, el);
                      else itemRefs.current.delete(idx);
                    }}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
          return sectionEl;
        })}
        {flatItems.length === 0 && (
          <p className="px-3 py-2 text-xs text-gray-400">No matching nodes</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
