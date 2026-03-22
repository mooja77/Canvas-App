import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanvasKeyboard, type CanvasKeyboardOptions } from './useCanvasKeyboard';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
}));

function createMockOptions(overrides: Partial<CanvasKeyboardOptions> = {}): CanvasKeyboardOptions {
  return {
    showSearch: false,
    showShortcuts: false,
    showCommandPalette: false,
    contextMenu: null,
    nodeContextMenu: null,
    edgeContextMenu: null,
    quickAddMenu: null,
    selectedQuestionId: null,

    setShowSearch: vi.fn(),
    setShowShortcuts: vi.fn(),
    setShowCommandPalette: vi.fn(),
    setContextMenu: vi.fn(),
    setNodeContextMenu: vi.fn(),
    setEdgeContextMenu: vi.fn(),
    setQuickAddMenu: vi.fn(),
    setSelectedQuestionId: vi.fn(),
    setHighlightedNodeIds: vi.fn(),
    setSnapToGrid: vi.fn(),

    nodes: [],
    setNodes: vi.fn(),

    rfInstanceRef: { current: { fitView: vi.fn(), zoomTo: vi.fn(), getViewport: vi.fn(), setViewport: vi.fn() } } as any,

    handleCopy: vi.fn(),
    handlePaste: vi.fn(),
    handleDuplicate: vi.fn(),
    handleSelectAll: vi.fn(),
    handleDeleteSelected: vi.fn(),
    handleAlignLeft: vi.fn(),
    handleDistributeH: vi.fn(),
    handleCreateGroup: vi.fn(),

    saveBookmark: vi.fn(),
    recallBookmark: vi.fn(),

    handleAutoLayout: vi.fn(),
    setFocusMode: vi.fn(),

    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,

    onNextTab: vi.fn(),
    onPrevTab: vi.fn(),
    ...overrides,
  };
}

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}, target?: HTMLElement) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
  if (target) {
    // Append to DOM so event bubbles up to document listener
    document.body.appendChild(target);
    target.dispatchEvent(event);
    document.body.removeChild(target);
  } else {
    document.dispatchEvent(event);
  }
}

describe('useCanvasKeyboard', () => {
  let options: CanvasKeyboardOptions;

  beforeEach(() => {
    options = createMockOptions();
  });

  describe('ignores keys on form elements', () => {
    it('ignores keys when target is INPUT element', () => {
      renderHook(() => useCanvasKeyboard(options));
      const input = document.createElement('input');
      fireKey('Delete', {}, input);
      expect(options.handleDeleteSelected).not.toHaveBeenCalled();
    });

    it('ignores keys when target is TEXTAREA element', () => {
      renderHook(() => useCanvasKeyboard(options));
      const textarea = document.createElement('textarea');
      fireKey('Delete', {}, textarea);
      expect(options.handleDeleteSelected).not.toHaveBeenCalled();
    });

    it('ignores keys when target is contentEditable', () => {
      renderHook(() => useCanvasKeyboard(options));
      const div = document.createElement('div');
      div.contentEditable = 'true';
      // jsdom doesn't implement isContentEditable, so we polyfill it
      Object.defineProperty(div, 'isContentEditable', { value: true });
      fireKey('Delete', {}, div);
      expect(options.handleDeleteSelected).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl shortcuts', () => {
    it('Ctrl+K toggles command palette', () => {
      renderHook(() => useCanvasKeyboard(options));
      fireKey('k', { ctrlKey: true });
      expect(options.setShowCommandPalette).toHaveBeenCalledWith(expect.any(Function));
    });

    it('Ctrl+A calls handleSelectAll', () => {
      renderHook(() => useCanvasKeyboard(options));
      fireKey('a', { ctrlKey: true });
      expect(options.handleSelectAll).toHaveBeenCalled();
    });

    it('Ctrl+D calls handleDuplicate', () => {
      renderHook(() => useCanvasKeyboard(options));
      fireKey('d', { ctrlKey: true });
      expect(options.handleDuplicate).toHaveBeenCalled();
    });
  });

  describe('single key shortcuts', () => {
    it('"f" key calls fitView on rfInstance', () => {
      renderHook(() => useCanvasKeyboard(options));
      fireKey('f');
      expect(options.rfInstanceRef.current!.fitView).toHaveBeenCalledWith({ padding: 0.4, maxZoom: 1.0 });
    });

    it('"1" key calls zoomTo(1) on rfInstance', () => {
      renderHook(() => useCanvasKeyboard(options));
      fireKey('1');
      expect(options.rfInstanceRef.current!.zoomTo).toHaveBeenCalledWith(1, { duration: 300 });
    });

    it('"?" key toggles shortcuts modal', () => {
      renderHook(() => useCanvasKeyboard(options));
      fireKey('?');
      expect(options.setShowShortcuts).toHaveBeenCalledWith(expect.any(Function));
    });

    it('"g" key toggles snap to grid', () => {
      renderHook(() => useCanvasKeyboard(options));
      fireKey('g');
      expect(options.setSnapToGrid).toHaveBeenCalledWith(expect.any(Function));
    });

    it('Delete key calls handleDeleteSelected', () => {
      renderHook(() => useCanvasKeyboard(options));
      fireKey('Delete');
      expect(options.handleDeleteSelected).toHaveBeenCalled();
    });
  });

  describe('Escape key', () => {
    it('closes command palette if open', () => {
      options = createMockOptions({ showCommandPalette: true });
      renderHook(() => useCanvasKeyboard(options));
      fireKey('Escape');
      expect(options.setShowCommandPalette).toHaveBeenCalledWith(false);
    });

    it('closes search if open (and command palette closed)', () => {
      options = createMockOptions({ showSearch: true });
      renderHook(() => useCanvasKeyboard(options));
      fireKey('Escape');
      expect(options.setShowSearch).toHaveBeenCalledWith(false);
      expect(options.setHighlightedNodeIds).toHaveBeenCalledWith(new Set());
    });

    it('closes command palette before search when both open', () => {
      options = createMockOptions({ showCommandPalette: true, showSearch: true });
      renderHook(() => useCanvasKeyboard(options));
      fireKey('Escape');
      expect(options.setShowCommandPalette).toHaveBeenCalledWith(false);
      // search should NOT be closed in same keypress
      expect(options.setShowSearch).not.toHaveBeenCalled();
    });
  });
});
