import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ShortcutMap {
  [action: string]: string; // action name → key combo (e.g. 'ctrl+shift+z')
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  fitView: 'f',
  zoomTo100: '1',
  zoomToFit: '0',
  toggleGrid: 'g',
  toggleCollapse: 'c',
  showShortcuts: '?',
  commandPalette: 'ctrl+k',
  search: 'ctrl+f',
  copy: 'ctrl+c',
  paste: 'ctrl+v',
  duplicate: 'ctrl+d',
  selectAll: 'ctrl+a',
  undo: 'ctrl+z',
  redo: 'ctrl+shift+z',
  mute: 'ctrl+m',
  autoLayout: 'ctrl+shift+l',
  focusMode: 'ctrl+.',
  group: 'ctrl+g',
  delete: 'delete',
  collapseAll: 'ctrl+shift+c',
  alignLeft: 'shift+a',
  distributeH: 'shift+d',
};

export const SHORTCUT_LABELS: Record<string, string> = {
  fitView: 'Fit view to all nodes',
  zoomTo100: 'Zoom to 100%',
  zoomToFit: 'Zoom to fit',
  toggleGrid: 'Toggle snap to grid',
  toggleCollapse: 'Collapse/expand node',
  showShortcuts: 'Keyboard shortcuts',
  commandPalette: 'Command palette',
  search: 'Search canvas nodes',
  copy: 'Copy selected nodes',
  paste: 'Paste nodes',
  duplicate: 'Duplicate selected',
  selectAll: 'Select all nodes',
  undo: 'Undo',
  redo: 'Redo',
  mute: 'Mute/unmute selected nodes',
  autoLayout: 'Auto-arrange layout',
  focusMode: 'Toggle focus mode',
  group: 'Group selected nodes',
  delete: 'Delete selected',
  collapseAll: 'Collapse/expand all nodes',
  alignLeft: 'Align selected left',
  distributeH: 'Distribute horizontally',
};

interface ShortcutState {
  shortcuts: ShortcutMap;
  getShortcut: (action: string) => string;
  setShortcut: (action: string, combo: string) => void;
  resetShortcut: (action: string) => void;
  resetAll: () => void;
}

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set, get) => ({
      shortcuts: { ...DEFAULT_SHORTCUTS },

      getShortcut: (action: string) => {
        return get().shortcuts[action] ?? DEFAULT_SHORTCUTS[action] ?? '';
      },

      setShortcut: (action: string, combo: string) =>
        set((s) => ({
          shortcuts: { ...s.shortcuts, [action]: combo },
        })),

      resetShortcut: (action: string) =>
        set((s) => ({
          shortcuts: {
            ...s.shortcuts,
            [action]: DEFAULT_SHORTCUTS[action] ?? '',
          },
        })),

      resetAll: () => set({ shortcuts: { ...DEFAULT_SHORTCUTS } }),
    }),
    {
      name: 'canvas-app-shortcuts',
      partialize: (state) => ({ shortcuts: state.shortcuts }),
    }
  )
);

/**
 * Check if a KeyboardEvent matches a shortcut combo string.
 * Combo format: modifiers joined with '+', e.g. 'ctrl+shift+z', 'f', 'delete'
 */
export function matchesShortcut(e: KeyboardEvent, combo: string): boolean {
  if (!combo) return false;

  const parts = combo.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const needsCtrl = parts.includes('ctrl');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');

  const hasCtrl = e.ctrlKey || e.metaKey;
  const hasShift = e.shiftKey;
  const hasAlt = e.altKey;

  if (needsCtrl !== hasCtrl) return false;
  if (needsShift !== hasShift) return false;
  if (needsAlt !== hasAlt) return false;

  // Normalize the event key for comparison
  const eventKey = e.key.toLowerCase();

  // Special key mappings
  if (key === 'delete') return eventKey === 'delete' || eventKey === 'backspace';
  if (key === '?') return eventKey === '?';
  if (key === '.') return eventKey === '.';

  return eventKey === key;
}

/**
 * Convert a KeyboardEvent to a combo string for recording shortcuts.
 */
export function eventToCombo(e: KeyboardEvent): string | null {
  const key = e.key;

  // Ignore modifier-only key presses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');

  // Normalize key name
  let normalizedKey = key.toLowerCase();
  if (normalizedKey === ' ') normalizedKey = 'space';
  if (normalizedKey === 'escape') normalizedKey = 'escape';

  parts.push(normalizedKey);
  return parts.join('+');
}
