import { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: '?', description: 'Show keyboard shortcuts' },
      { keys: 'F', description: 'Fit view to all nodes' },
      { keys: '1', description: 'Zoom to 100%' },
      { keys: '0', description: 'Zoom to fit' },
      { keys: 'Space+Drag', description: 'Pan mode' },
      { keys: 'Esc', description: 'Close panel / overlay' },
    ],
  },
  {
    title: 'Edit',
    shortcuts: [
      { keys: 'Ctrl+C', description: 'Copy selected nodes' },
      { keys: 'Ctrl+V', description: 'Paste nodes' },
      { keys: 'Ctrl+D', description: 'Duplicate selected' },
      { keys: 'Ctrl+Z', description: 'Undo' },
      { keys: 'Ctrl+Shift+Z', description: 'Redo' },
      { keys: 'Delete', description: 'Delete selected node' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: 'Ctrl+A', description: 'Select all nodes' },
      { keys: 'Shift+A', description: 'Align selected left' },
      { keys: 'Shift+D', description: 'Distribute horizontally' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: 'G', description: 'Toggle snap to grid' },
      { keys: 'C', description: 'Collapse/expand selected node' },
      { keys: 'Ctrl+F', description: 'Search canvas' },
      { keys: 'Scroll', description: 'Zoom in / out' },
      { keys: 'Drag', description: 'Pan canvas' },
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
      <div className="modal-content w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-gray-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{group.title}</h4>
              <div className="space-y-1.5">
                {group.shortcuts.map(s => (
                  <div key={s.keys} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-300">{s.description}</span>
                    <kbd className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
