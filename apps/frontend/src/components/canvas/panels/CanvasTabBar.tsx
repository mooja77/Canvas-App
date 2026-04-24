import { useRef, useEffect, useState, useCallback } from 'react';

interface CanvasTab {
  id: string;
  name: string;
  description?: string;
  transcriptCount?: number;
  codeCount?: number;
  codingCount?: number;
}

interface CanvasTabBarProps {
  tabs: CanvasTab[];
  activeTabId: string | null;
  onSwitchTab: (canvasId: string) => void;
  onCloseTab: (canvasId: string) => void;
  onNewTab: () => void;
}

function TabPreview({ tab, visible }: { tab: CanvasTab; visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg bg-white p-2.5 shadow-lg ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10">
      <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1 break-words">{tab.name}</div>
      {tab.description && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 line-clamp-2">{tab.description}</div>
      )}
      <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
        <span>{tab.transcriptCount ?? 0} transcripts</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span>{tab.codeCount ?? 0} codes</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span>{tab.codingCount ?? 0} codings</span>
      </div>
    </div>
  );
}

export default function CanvasTabBar({ tabs, activeTabId, onSwitchTab, onCloseTab, onNewTab }: CanvasTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to active tab
  useEffect(() => {
    if (!scrollRef.current || !activeTabId) return;
    const active = scrollRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTabId]);

  const handleMouseEnter = useCallback((tabId: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredTabId(tabId);
    }, 300);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setHoveredTabId(null);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  if (tabs.length <= 1) return null;

  return (
    <div className="flex items-center border-b border-gray-200/80 bg-gray-50/90 backdrop-blur-sm dark:border-gray-700/80 dark:bg-gray-850/90">
      <div ref={scrollRef} className="flex items-center gap-0 overflow-x-auto scrollbar-none flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            title={tab.name}
            className={`group relative flex items-center gap-1.5 shrink-0 px-3 py-1.5 text-xs cursor-pointer border-b-2 transition-colors ${
              tab.id === activeTabId
                ? 'border-brand-500 text-brand-700 bg-white dark:bg-gray-800 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50'
            }`}
            onClick={() => onSwitchTab(tab.id)}
            onMouseEnter={() => handleMouseEnter(tab.id)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="truncate max-w-[120px]">{tab.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-all"
              title="Close tab"
            >
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <TabPreview tab={tab} visible={hoveredTabId === tab.id} />
          </div>
        ))}
      </div>
      <button
        onClick={onNewTab}
        className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
        title="Open another canvas"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  );
}
