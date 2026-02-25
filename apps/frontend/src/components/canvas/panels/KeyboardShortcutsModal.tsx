import { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
      </svg>
    ),
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Command palette' },
      { keys: ['Ctrl', 'F'], description: 'Search canvas nodes' },
      { keys: ['?'], description: 'Keyboard shortcuts' },
      { keys: ['F'], description: 'Fit view to all nodes' },
      { keys: ['1'], description: 'Zoom to 100%' },
      { keys: ['0'], description: 'Zoom to fit' },
      { keys: ['Space', 'Drag'], description: 'Pan mode' },
      { keys: ['Esc'], description: 'Close panel / overlay' },
    ],
  },
  {
    title: 'Editing',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
    shortcuts: [
      { keys: ['Ctrl', 'C'], description: 'Copy selected nodes' },
      { keys: ['Ctrl', 'V'], description: 'Paste nodes' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate selected' },
      { keys: ['Ctrl', 'G'], description: 'Group selected nodes' },
      { keys: ['Ctrl', 'Shift', 'L'], description: 'Auto-arrange layout' },
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Delete'], description: 'Delete selected' },
      { keys: ['Dbl-click'], description: 'Quick-add menu' },
    ],
  },
  {
    title: 'Selection & Layout',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
    shortcuts: [
      { keys: ['Ctrl', 'A'], description: 'Select all nodes' },
      { keys: ['Shift', 'A'], description: 'Align selected left' },
      { keys: ['Shift', 'D'], description: 'Distribute horizontally' },
    ],
  },
  {
    title: 'View',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    shortcuts: [
      { keys: ['Ctrl', '.'], description: 'Toggle focus mode' },
      { keys: ['G'], description: 'Toggle snap to grid' },
      { keys: ['C'], description: 'Collapse/expand node' },
      { keys: ['Ctrl', 'Shift', '1-5'], description: 'Save viewport bookmark' },
      { keys: ['Alt', '1-5'], description: 'Recall viewport bookmark' },
      { keys: ['Scroll'], description: 'Zoom in / out' },
      { keys: ['Right-click'], description: 'Context menu' },
    ],
  },
];

export default function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="command-palette-enter w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Quick reference for all canvas actions</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <div className="flex items-center gap-1.5 mb-2.5 text-gray-400 dark:text-gray-500">
                {group.icon}
                <h4 className="text-[10px] font-semibold uppercase tracking-wider">{group.title}</h4>
              </div>
              <div className="space-y-1.5">
                {group.shortcuts.map(s => (
                  <div key={s.keys.join('+')} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{s.description}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {s.keys.map((key, ki) => (
                        <span key={ki} className="flex items-center">
                          {ki > 0 && <span className="text-[8px] text-gray-300 dark:text-gray-600 mx-0.5">+</span>}
                          <kbd className="inline-flex items-center justify-center min-w-[22px] rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400 border border-gray-200/50 dark:border-gray-600/50">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700/50 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Press <kbd className="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 font-mono">Ctrl+K</kbd> to open the command palette for quick access to all actions
          </p>
        </div>
      </div>
    </div>
  );
}
