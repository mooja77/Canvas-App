import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../../stores/uiStore';

// A small, ALWAYS-VISIBLE "Help" entry point in the status bar. The product
// tour and keyboard shortcuts existed before this, but only inside the
// unlabelled "⋯" toolbar overflow — which non-technical users never open.
// The status bar is the one place a help affordance fits at every viewport
// without pushing the (width-budgeted) toolbar onto a second row.
export default function HelpMenu({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openFullProductTour = useUIStore((s) => s.openFullProductTour);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-colors"
        title="Help — tour, shortcuts, user guide"
        aria-label="Help"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg
          className="h-2.5 w-2.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
          />
        </svg>
        Help
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-50 mb-1.5 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              openFullProductTour();
            }}
          >
            Take the product tour
          </button>
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onShowShortcuts();
            }}
          >
            Keyboard shortcuts
            <kbd className="ml-auto rounded bg-gray-100 px-1 font-mono text-[9px] text-gray-400 dark:bg-gray-700">
              ?
            </kbd>
          </button>
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              window.open('/guide', '_blank', 'noopener');
            }}
          >
            User guide
          </button>
        </div>
      )}
    </div>
  );
}
