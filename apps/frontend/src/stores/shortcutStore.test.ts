import { describe, it, expect, beforeEach } from 'vitest';
import {
  useShortcutStore,
  DEFAULT_SHORTCUTS,
  matchesShortcut,
  eventToCombo,
} from './shortcutStore';

function resetStore() {
  useShortcutStore.setState({ shortcuts: { ...DEFAULT_SHORTCUTS } });
}

function makeKeyboardEvent(
  key: string,
  opts: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean } = {}
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    metaKey: opts.metaKey ?? false,
  });
}

describe('shortcutStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('default shortcuts', () => {
    it('loads fitView as "f"', () => {
      expect(useShortcutStore.getState().shortcuts.fitView).toBe('f');
    });

    it('loads undo as "ctrl+z"', () => {
      expect(useShortcutStore.getState().shortcuts.undo).toBe('ctrl+z');
    });

    it('loads redo as "ctrl+shift+z"', () => {
      expect(useShortcutStore.getState().shortcuts.redo).toBe('ctrl+shift+z');
    });

    it('loads delete as "delete"', () => {
      expect(useShortcutStore.getState().shortcuts.delete).toBe('delete');
    });

    it('has all expected default actions', () => {
      const shortcuts = useShortcutStore.getState().shortcuts;
      expect(Object.keys(shortcuts).length).toBe(Object.keys(DEFAULT_SHORTCUTS).length);
    });
  });

  describe('setShortcut', () => {
    it('changes a shortcut value', () => {
      useShortcutStore.getState().setShortcut('fitView', 'ctrl+f');
      expect(useShortcutStore.getState().shortcuts.fitView).toBe('ctrl+f');
    });

    it('does not affect other shortcuts', () => {
      useShortcutStore.getState().setShortcut('fitView', 'ctrl+f');
      expect(useShortcutStore.getState().shortcuts.undo).toBe('ctrl+z');
    });

    it('can set a new action not in defaults', () => {
      useShortcutStore.getState().setShortcut('customAction', 'ctrl+alt+x');
      expect(useShortcutStore.getState().shortcuts.customAction).toBe('ctrl+alt+x');
    });
  });

  describe('resetShortcut', () => {
    it('reverts a changed shortcut to its default', () => {
      useShortcutStore.getState().setShortcut('fitView', 'ctrl+f');
      useShortcutStore.getState().resetShortcut('fitView');
      expect(useShortcutStore.getState().shortcuts.fitView).toBe('f');
    });

    it('sets empty string for unknown action', () => {
      useShortcutStore.getState().setShortcut('unknown', 'x');
      useShortcutStore.getState().resetShortcut('unknown');
      expect(useShortcutStore.getState().shortcuts.unknown).toBe('');
    });
  });

  describe('resetAll', () => {
    it('reverts all shortcuts to defaults', () => {
      useShortcutStore.getState().setShortcut('fitView', 'ctrl+f');
      useShortcutStore.getState().setShortcut('undo', 'ctrl+y');
      useShortcutStore.getState().setShortcut('delete', 'x');
      useShortcutStore.getState().resetAll();
      const shortcuts = useShortcutStore.getState().shortcuts;
      expect(shortcuts.fitView).toBe('f');
      expect(shortcuts.undo).toBe('ctrl+z');
      expect(shortcuts.delete).toBe('delete');
    });
  });

  describe('getShortcut', () => {
    it('returns the current shortcut for an action', () => {
      expect(useShortcutStore.getState().getShortcut('fitView')).toBe('f');
    });

    it('returns empty string for unknown action', () => {
      expect(useShortcutStore.getState().getShortcut('nonexistent')).toBe('');
    });
  });
});

describe('matchesShortcut', () => {
  it('matches ctrl+key combos', () => {
    const e = makeKeyboardEvent('z', { ctrlKey: true });
    expect(matchesShortcut(e, 'ctrl+z')).toBe(true);
  });

  it('matches ctrl+shift+key combos', () => {
    const e = makeKeyboardEvent('z', { ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(e, 'ctrl+shift+z')).toBe(true);
  });

  it('matches single key shortcuts', () => {
    const e = makeKeyboardEvent('f');
    expect(matchesShortcut(e, 'f')).toBe(true);
  });

  it('rejects when modifier missing', () => {
    const e = makeKeyboardEvent('z');
    expect(matchesShortcut(e, 'ctrl+z')).toBe(false);
  });

  it('rejects when extra modifier present', () => {
    const e = makeKeyboardEvent('z', { ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(e, 'ctrl+z')).toBe(false);
  });

  it('matches delete key', () => {
    const e = makeKeyboardEvent('Delete');
    expect(matchesShortcut(e, 'delete')).toBe(true);
  });

  it('matches backspace as delete', () => {
    const e = makeKeyboardEvent('Backspace');
    expect(matchesShortcut(e, 'delete')).toBe(true);
  });

  it('matches ? key', () => {
    const e = makeKeyboardEvent('?');
    expect(matchesShortcut(e, '?')).toBe(true);
  });

  it('matches . key with ctrl', () => {
    const e = makeKeyboardEvent('.', { ctrlKey: true });
    expect(matchesShortcut(e, 'ctrl+.')).toBe(true);
  });

  it('matches metaKey as ctrl', () => {
    const e = makeKeyboardEvent('k', { metaKey: true });
    expect(matchesShortcut(e, 'ctrl+k')).toBe(true);
  });

  it('returns false for empty combo', () => {
    const e = makeKeyboardEvent('a');
    expect(matchesShortcut(e, '')).toBe(false);
  });

  it('matches alt+key combos', () => {
    const e = makeKeyboardEvent('d', { altKey: true });
    expect(matchesShortcut(e, 'alt+d')).toBe(true);
  });
});

describe('eventToCombo', () => {
  it('converts simple key to combo string', () => {
    const e = makeKeyboardEvent('f');
    expect(eventToCombo(e)).toBe('f');
  });

  it('converts ctrl+key to combo string', () => {
    const e = makeKeyboardEvent('z', { ctrlKey: true });
    expect(eventToCombo(e)).toBe('ctrl+z');
  });

  it('converts ctrl+shift+key to combo string', () => {
    const e = makeKeyboardEvent('z', { ctrlKey: true, shiftKey: true });
    expect(eventToCombo(e)).toBe('ctrl+shift+z');
  });

  it('converts alt+key to combo string', () => {
    const e = makeKeyboardEvent('d', { altKey: true });
    expect(eventToCombo(e)).toBe('alt+d');
  });

  it('returns null for modifier-only key press', () => {
    const e = makeKeyboardEvent('Control', { ctrlKey: true });
    expect(eventToCombo(e)).toBeNull();
  });

  it('returns null for Shift-only key press', () => {
    const e = makeKeyboardEvent('Shift', { shiftKey: true });
    expect(eventToCombo(e)).toBeNull();
  });

  it('normalizes space key', () => {
    const e = makeKeyboardEvent(' ');
    expect(eventToCombo(e)).toBe('space');
  });

  it('converts metaKey as ctrl', () => {
    const e = makeKeyboardEvent('k', { metaKey: true });
    expect(eventToCombo(e)).toBe('ctrl+k');
  });
});

describe('persist behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('persists shortcuts to localStorage under the correct key', () => {
    useShortcutStore.getState().setShortcut('fitView', 'ctrl+f');
    // Zustand persist writes to localStorage synchronously
    const stored = localStorage.getItem('qualcanvas-shortcuts');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.shortcuts.fitView).toBe('ctrl+f');
  });

  it('only persists the shortcuts slice (partialize)', () => {
    useShortcutStore.getState().setShortcut('undo', 'ctrl+y');
    const stored = localStorage.getItem('qualcanvas-shortcuts');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    // Should have shortcuts but NOT function keys like getShortcut, setShortcut, etc.
    expect(parsed.state).toHaveProperty('shortcuts');
    expect(parsed.state).not.toHaveProperty('getShortcut');
    expect(parsed.state).not.toHaveProperty('setShortcut');
    expect(parsed.state).not.toHaveProperty('resetShortcut');
    expect(parsed.state).not.toHaveProperty('resetAll');
  });
});
