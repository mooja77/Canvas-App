import { useRef, useEffect } from 'react';

interface CanvasTab {
  id: string;
  name: string;
}

interface CanvasTabBarProps {
  tabs: CanvasTab[];
  activeTabId: string | null;
  onSwitchTab: (canvasId: string) => void;
  onCloseTab: (canvasId: string) => void;
  onNewTab: () => void;
}

export default function CanvasTabBar({ tabs, activeTabId, onSwitchTab, onCloseTab, onNewTab }: CanvasTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active tab
  useEffect(() => {
    if (!scrollRef.current || !activeTabId) return;
    const active = scrollRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTabId]);

  if (tabs.length <= 1) return null;

  return (
    <div className="flex items-center border-b border-gray-200/80 bg-gray-50/90 backdrop-blur-sm dark:border-gray-700/80 dark:bg-gray-850/90">
      <div
        ref={scrollRef}
        className="flex items-center gap-0 overflow-x-auto scrollbar-none flex-1"
      >
        {tabs.map(tab => (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            className={`group flex items-center gap-1.5 shrink-0 px-3 py-1.5 text-xs cursor-pointer border-b-2 transition-colors ${
              tab.id === activeTabId
                ? 'border-brand-500 text-brand-700 bg-white dark:bg-gray-800 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50'
            }`}
            onClick={() => onSwitchTab(tab.id)}
          >
            <span className="truncate max-w-[120px]">{tab.name}</span>
            <button
              onClick={e => { e.stopPropagation(); onCloseTab(tab.id); }}
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-all"
              title="Close tab"
            >
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
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
