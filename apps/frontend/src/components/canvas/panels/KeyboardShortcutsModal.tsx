import { useEffect, useState, useCallback } from 'react';
import {
  useShortcutStore,
  DEFAULT_SHORTCUTS,
  SHORTCUT_LABELS,
  eventToCombo,
} from '../../../stores/shortcutStore';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

/** Format a combo string for display, e.g. 'ctrl+shift+z' → ['Ctrl', 'Shift', 'Z'] */
function comboToKeys(combo: string): string[] {
  if (!combo) return [];
  return combo.split('+').map((part) => {
    if (part === 'ctrl') return 'Ctrl';
    if (part === 'shift') return 'Shift';
    if (part === 'alt') return 'Alt';
    if (part === 'delete') return 'Delete';
    if (part === '?') return '?';
    if (part === '.') return '.';
    return part.charAt(0).toUpperCase() + part.slice(1);
  });
}

interface ShortcutGroup {
  title: string;
  icon: React.ReactNode;
  actions: string[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
      </svg>
    ),
    actions: ['commandPalette', 'search', 'showShortcuts', 'fitView', 'zoomTo100', 'zoomToFit'],
  },
  {
    title: 'Editing',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
    actions: ['copy', 'paste', 'duplicate', 'group', 'autoLayout', 'undo', 'redo', 'mute', 'delete'],
  },
  {
    title: 'Selection & Layout',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
    actions: ['selectAll', 'alignLeft', 'distributeH'],
  },
  {
    title: 'View',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    actions: ['focusMode', 'toggleGrid', 'toggleCollapse', 'collapseAll'],
  },
];

export default function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const setShortcut = useShortcutStore((s) => s.setShortcut);
  const resetShortcut = useShortcutStore((s) => s.resetShortcut);
  const resetAll = useShortcutStore((s) => s.resetAll);

  const [recordingAction, setRecordingAction] = useState<string | null>(null);

  // Handle escape to close modal (but not when recording)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !recordingAction) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, recordingAction]);

  // Handle key recording
  const handleRecordKey = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingAction) return;

      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === 'Escape') {
        setRecordingAction(null);
        return;
      }

      const combo = eventToCombo(e);
      if (combo) {
        setShortcut(recordingAction, combo);
        setRecordingAction(null);
      }
    },
    [recordingAction, setShortcut]
  );

  useEffect(() => {
    if (recordingAction) {
      document.addEventListener('keydown', handleRecordKey, true);
      return () => document.removeEventListener('keydown', handleRecordKey, true);
    }
  }, [recordingAction, handleRecordKey]);

  return (
    <div className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard Shortcuts">
      <div
        className="command-palette-enter w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Tab') {
            const modal = e.currentTarget;
            const focusable = modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
              if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
          }
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Click any shortcut to reassign it</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <div className="flex items-center gap-1.5 mb-2.5 text-gray-400 dark:text-gray-500">
                {group.icon}
                <h4 className="text-[10px] font-semibold uppercase tracking-wider">{group.title}</h4>
              </div>
              <div className="space-y-1.5">
                {group.actions.map(action => {
                  const combo = shortcuts[action] ?? DEFAULT_SHORTCUTS[action] ?? '';
                  const isRecording = recordingAction === action;
                  const isCustomized = combo !== DEFAULT_SHORTCUTS[action];
                  const keys = comboToKeys(combo);
                  const label = SHORTCUT_LABELS[action] ?? action;

                  return (
                    <div key={action} className="flex items-center justify-between gap-2 group">
                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {isCustomized && (
                          <button
                            onClick={() => resetShortcut(action)}
                            className="opacity-0 group-hover:opacity-100 text-[9px] text-gray-400 hover:text-blue-500 transition-opacity"
                            title="Reset to default"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => setRecordingAction(isRecording ? null : action)}
                          className={`flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors ${
                            isRecording
                              ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                          title="Click to reassign"
                        >
                          {isRecording ? (
                            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 animate-pulse">
                              Press keys...
                            </span>
                          ) : (
                            keys.map((key, ki) => (
                              <span key={ki} className="flex items-center">
                                {ki > 0 && <span className="text-[8px] text-gray-300 dark:text-gray-600 mx-0.5">+</span>}
                                <kbd className={`inline-flex items-center justify-center min-w-[22px] rounded px-1.5 py-0.5 text-[10px] font-mono font-medium border border-gray-200/50 dark:border-gray-600/50 ${
                                  isCustomized
                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                }`}>
                                  {key}
                                </kbd>
                              </span>
                            ))
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Customized shortcuts are highlighted in blue
          </p>
          <button
            onClick={resetAll}
            className="text-[10px] font-medium text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
          >
            Reset all to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
