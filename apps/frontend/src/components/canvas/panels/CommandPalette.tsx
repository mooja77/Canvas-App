import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { useUIStore } from '../../../stores/uiStore';
import type { CanvasTranscript, CanvasQuestion, CanvasMemo, CanvasComputedNode, ComputedNodeType } from '@canvas-app/shared';

interface CommandPaletteProps {
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onFitView: () => void;
  onToggleGrid: () => void;
  onToggleNavigator: () => void;
  onShowShortcuts: () => void;
  onAddComputedNode: (type: ComputedNodeType, label: string) => Promise<void>;
  onAutoLayout?: () => void;
  onToggleFocusMode?: () => void;
  onExportPNG?: () => void;
  onAddStickyNote?: () => void;
}

interface CommandItem {
  id: string;
  category: 'action' | 'navigate' | 'analysis';
  icon: JSX.Element;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
}

export default function CommandPalette({
  onClose,
  onFocusNode,
  onFitView,
  onToggleGrid,
  onToggleNavigator,
  onShowShortcuts,
  onAddComputedNode,
  onAutoLayout,
  onToggleFocusMode,
  onExportPNG,
  onAddStickyNote,
}: CommandPaletteProps) {
  const { activeCanvas, addQuestion, addMemo, toggleCodingStripes } = useCanvasStore();
  const { toggleDarkMode, darkMode } = useUIStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const allItems = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [];

    // ── Quick Actions ──
    items.push(
      {
        id: 'action-add-code',
        category: 'action',
        icon: <IconPlus />,
        label: 'Add New Code',
        description: 'Create a research code',
        action: async () => { await addQuestion('New code — double-click to edit'); onClose(); },
      },
      {
        id: 'action-add-memo',
        category: 'action',
        icon: <IconMemo />,
        label: 'Add Memo',
        description: 'Create a research memo',
        action: async () => { await addMemo('New memo — click to edit'); onClose(); },
      },
      {
        id: 'action-fit-view',
        category: 'action',
        icon: <IconFitView />,
        label: 'Fit View',
        description: 'Zoom to show all nodes',
        shortcut: 'F',
        action: () => { onFitView(); onClose(); },
      },
      {
        id: 'action-toggle-grid',
        category: 'action',
        icon: <IconGrid />,
        label: 'Toggle Snap to Grid',
        description: 'Align nodes to grid',
        shortcut: 'G',
        action: () => { onToggleGrid(); onClose(); },
      },
      {
        id: 'action-toggle-navigator',
        category: 'action',
        icon: <IconSidebar />,
        label: 'Toggle Navigator',
        description: 'Show/hide the sidebar',
        action: () => { onToggleNavigator(); onClose(); },
      },
      {
        id: 'action-toggle-dark',
        category: 'action',
        icon: darkMode ? <IconSun /> : <IconMoon />,
        label: darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        description: 'Toggle theme',
        action: () => { toggleDarkMode(); onClose(); },
      },
      {
        id: 'action-coding-stripes',
        category: 'action',
        icon: <IconStripes />,
        label: 'Toggle Coding Stripes',
        description: 'Show coding colors on transcripts',
        action: () => { toggleCodingStripes(); onClose(); },
      },
      {
        id: 'action-shortcuts',
        category: 'action',
        icon: <IconKeyboard />,
        label: 'Keyboard Shortcuts',
        description: 'View all shortcuts',
        shortcut: '?',
        action: () => { onShowShortcuts(); onClose(); },
      },
    );

    if (onAutoLayout) {
      items.push({
        id: 'action-auto-layout',
        category: 'action',
        icon: <IconLayout />,
        label: 'Auto-Arrange Canvas',
        description: 'Organize nodes automatically',
        shortcut: 'Ctrl+Shift+L',
        action: () => { onAutoLayout(); onClose(); },
      });
    }

    if (onToggleFocusMode) {
      items.push({
        id: 'action-focus-mode',
        category: 'action',
        icon: <IconFocus />,
        label: 'Focus Mode',
        description: 'Hide toolbar and sidebar for clean view',
        shortcut: 'Ctrl+.',
        action: () => { onToggleFocusMode(); onClose(); },
      });
    }

    if (onExportPNG) {
      items.push({
        id: 'action-export-png',
        category: 'action',
        icon: <IconExport />,
        label: 'Export as PNG',
        description: 'Save canvas as an image',
        action: () => { onExportPNG(); onClose(); },
      });
    }

    if (onAddStickyNote) {
      items.push({
        id: 'action-add-sticky',
        category: 'action',
        icon: <IconSticky />,
        label: 'Add Sticky Note',
        description: 'Quick post-it note on canvas',
        action: () => { onAddStickyNote(); onClose(); },
      });
    }

    // ── Analysis nodes ──
    const analysisNodes: { type: ComputedNodeType; label: string; description: string }[] = [
      { type: 'search', label: 'Text Search', description: 'Find patterns across transcripts' },
      { type: 'cooccurrence', label: 'Co-occurrence', description: 'Find overlapping codings' },
      { type: 'matrix', label: 'Framework Matrix', description: 'Case x Question grid' },
      { type: 'stats', label: 'Statistics', description: 'Coding frequency charts' },
      { type: 'comparison', label: 'Comparison', description: 'Compare transcript profiles' },
      { type: 'wordcloud', label: 'Word Cloud', description: 'Frequency visualization' },
      { type: 'cluster', label: 'Clustering', description: 'Group similar segments' },
      { type: 'codingquery', label: 'Coding Query', description: 'Boolean AND/OR/NOT queries' },
      { type: 'sentiment', label: 'Sentiment', description: 'Emotional tone analysis' },
      { type: 'treemap', label: 'Theme Map', description: 'Visual theme proportions' },
    ];

    analysisNodes.forEach(n => {
      items.push({
        id: `analysis-${n.type}`,
        category: 'analysis',
        icon: <IconAnalysis />,
        label: `Add ${n.label}`,
        description: n.description,
        action: async () => { await onAddComputedNode(n.type, n.label); onClose(); },
      });
    });

    // ── Navigation: Transcripts, Codes, Memos, Computed ──
    if (activeCanvas) {
      activeCanvas.transcripts.forEach((t: CanvasTranscript) => {
        items.push({
          id: `nav-transcript-${t.id}`,
          category: 'navigate',
          icon: <IconDoc />,
          label: t.title,
          description: `Transcript · ${t.content.split(/\s+/).filter(Boolean).length} words`,
          action: () => { onFocusNode(`transcript-${t.id}`); onClose(); },
        });
      });

      activeCanvas.questions.forEach((q: CanvasQuestion) => {
        const count = activeCanvas.codings.filter(c => c.questionId === q.id).length;
        items.push({
          id: `nav-question-${q.id}`,
          category: 'navigate',
          icon: <IconColorDot color={q.color} />,
          label: q.text,
          description: `Code · ${count} coding${count !== 1 ? 's' : ''}`,
          action: () => { onFocusNode(`question-${q.id}`); onClose(); },
        });
      });

      activeCanvas.memos.forEach((m: CanvasMemo) => {
        items.push({
          id: `nav-memo-${m.id}`,
          category: 'navigate',
          icon: <IconMemo />,
          label: m.title || 'Memo',
          description: `Memo · ${m.content.slice(0, 60)}${m.content.length > 60 ? '...' : ''}`,
          action: () => { onFocusNode(`memo-${m.id}`); onClose(); },
        });
      });

      (activeCanvas.computedNodes ?? []).forEach((cn: CanvasComputedNode) => {
        items.push({
          id: `nav-computed-${cn.id}`,
          category: 'navigate',
          icon: <IconAnalysis />,
          label: cn.label,
          description: `Analysis · ${cn.nodeType}`,
          action: () => { onFocusNode(`computed-${cn.id}`); onClose(); },
        });
      });
    }

    return items;
  }, [activeCanvas, addQuestion, addMemo, toggleCodingStripes, toggleDarkMode, darkMode, onClose, onFocusNode, onFitView, onToggleGrid, onToggleNavigator, onShowShortcuts, onAddComputedNode, onAutoLayout, onToggleFocusMode, onExportPNG, onAddStickyNote]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q))
    );
  }, [allItems, query]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  }, [filteredItems, selectedIndex]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: { key: string; label: string; items: (CommandItem & { globalIndex: number })[] }[] = [];
    const categoryOrder: { key: CommandItem['category']; label: string }[] = [
      { key: 'action', label: 'Actions' },
      { key: 'navigate', label: 'Navigate' },
      { key: 'analysis', label: 'Analysis' },
    ];

    let globalIndex = 0;
    for (const cat of categoryOrder) {
      const catItems = filteredItems.filter(i => i.category === cat.key);
      if (catItems.length > 0) {
        groups.push({
          key: cat.key,
          label: cat.label,
          items: catItems.map(item => ({ ...item, globalIndex: globalIndex++ })),
        });
      }
    }
    return groups;
  }, [filteredItems]);

  return (
    <div className="modal-backdrop fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="command-palette-enter w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
            placeholder="Search actions, codes, transcripts..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="hidden sm:inline-flex rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 dark:text-gray-500">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              No results found
            </div>
          ) : (
            groupedItems.map(group => (
              <div key={group.key}>
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {group.label}
                </p>
                {group.items.map(item => (
                  <button
                    key={item.id}
                    data-index={item.globalIndex}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(item.globalIndex)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-75 ${
                      item.globalIndex === selectedIndex
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-400 dark:text-gray-500">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.label}</p>
                      {item.description && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{item.description}</p>
                      )}
                    </div>
                    {item.shortcut && (
                      <kbd className="shrink-0 rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 dark:text-gray-500">
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 font-mono">&uarr;&darr;</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 font-mono">&crarr;</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 font-mono">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Inline icon components ──

function IconPlus() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IconMemo() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  );
}

function IconFitView() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
    </svg>
  );
}

function IconSidebar() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12H12m-8.25 5.25h16.5" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  );
}

function IconStripes() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function IconKeyboard() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function IconAnalysis() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
    </svg>
  );
}

function IconColorDot({ color }: { color: string }) {
  return (
    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
  );
}

function IconLayout() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
    </svg>
  );
}

function IconFocus() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  );
}

function IconExport() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
    </svg>
  );
}

function IconSticky() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
