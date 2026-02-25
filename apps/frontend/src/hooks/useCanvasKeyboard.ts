import { useEffect, type RefObject } from 'react';
import type { Node, ReactFlowInstance } from '@xyflow/react';
import toast from 'react-hot-toast';
import type { Bookmark } from './useCanvasBookmarks';

export interface CanvasKeyboardOptions {
  // UI state for Escape dismissal
  showSearch: boolean;
  showShortcuts: boolean;
  showCommandPalette: boolean;
  contextMenu: { show: boolean } | null;
  nodeContextMenu: { show: boolean } | null;
  edgeContextMenu: { show: boolean } | null;
  quickAddMenu: { x: number; y: number } | null;
  selectedQuestionId: string | null;

  // State setters for Escape dismissal
  setShowSearch: (v: boolean) => void;
  setShowShortcuts: (v: boolean | ((prev: boolean) => boolean)) => void;
  setShowCommandPalette: (v: boolean | ((prev: boolean) => boolean)) => void;
  setContextMenu: (v: null) => void;
  setNodeContextMenu: (v: null) => void;
  setEdgeContextMenu: (v: null) => void;
  setQuickAddMenu: (v: null) => void;
  setSelectedQuestionId: (v: null) => void;
  setHighlightedNodeIds: (v: Set<string>) => void;
  setSnapToGrid: (v: boolean | ((prev: boolean) => boolean)) => void;

  // Node state
  nodes: Node[];
  setNodes: (updater: (nds: Node[]) => Node[]) => void;

  // ReactFlow instance ref
  rfInstanceRef: RefObject<ReactFlowInstance | null>;

  // Action handlers
  handleCopy: () => void;
  handlePaste: () => void;
  handleDuplicate: () => void;
  handleSelectAll: () => void;
  handleDeleteSelected: () => void;
  handleAlignLeft: () => void;
  handleDistributeH: () => void;
  undo: () => void;
  redo: () => void;

  // Group creation
  handleCreateGroup: () => void;

  // Viewport bookmarks
  saveBookmark: (slot: number, viewport: { x: number; y: number; zoom: number }) => void;
  recallBookmark: (slot: number) => Bookmark | null;

  // Auto-layout & focus mode
  handleAutoLayout: () => void;
  setFocusMode: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export function useCanvasKeyboard(options: CanvasKeyboardOptions): void {
  const {
    showSearch,
    showShortcuts,
    showCommandPalette,
    contextMenu,
    nodeContextMenu,
    edgeContextMenu,
    quickAddMenu,
    selectedQuestionId,
    setShowSearch,
    setShowShortcuts,
    setShowCommandPalette,
    setContextMenu,
    setNodeContextMenu,
    setEdgeContextMenu,
    setQuickAddMenu,
    setSelectedQuestionId,
    setHighlightedNodeIds,
    setSnapToGrid,
    nodes,
    setNodes,
    rfInstanceRef,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleSelectAll,
    handleDeleteSelected,
    handleAlignLeft,
    handleDistributeH,
    undo,
    redo,
    handleCreateGroup,
    saveBookmark,
    recallBookmark,
    handleAutoLayout,
    setFocusMode,
  } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          e.preventDefault();
          handleCopy();
          return;
        }
        if (e.key === 'v') {
          e.preventDefault();
          handlePaste();
          return;
        }
        if (e.key === 'd') {
          e.preventDefault();
          handleDuplicate();
          return;
        }
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
          return;
        }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
        if (e.key === 'a') {
          e.preventDefault();
          handleSelectAll();
          return;
        }
        if (e.key === 'k') {
          e.preventDefault();
          setShowCommandPalette(s => !s);
          return;
        }
        if (e.key === 'f') {
          e.preventDefault();
          setShowSearch(true);
          return;
        }
        // Ctrl+.: toggle focus mode
        if (e.key === '.') {
          e.preventDefault();
          setFocusMode((prev: boolean) => !prev);
          return;
        }
        // Ctrl+Shift+L: auto-layout
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          handleAutoLayout();
          return;
        }
        // Ctrl+G: create group from selection
        if (e.key === 'g') {
          e.preventDefault();
          handleCreateGroup();
          return;
        }
        // Ctrl+Shift+1-5: save viewport bookmark
        if (e.shiftKey) {
          const digitMatch = e.code.match(/^Digit([1-5])$/);
          if (digitMatch) {
            e.preventDefault();
            const slot = parseInt(digitMatch[1]) - 1;
            const viewport = rfInstanceRef.current?.getViewport();
            if (viewport) {
              saveBookmark(slot, viewport);
              toast.success(`Bookmark ${digitMatch[1]} saved`);
            }
            return;
          }
        }
        return;
      }

      // Alt+1-5: recall viewport bookmark
      if (e.altKey) {
        const digitMatch = e.code.match(/^Digit([1-5])$/);
        if (digitMatch) {
          e.preventDefault();
          const slot = parseInt(digitMatch[1]) - 1;
          const bm = recallBookmark(slot);
          if (bm) {
            rfInstanceRef.current?.setViewport(bm, { duration: 300 });
          } else {
            toast(`Bookmark ${digitMatch[1]} is empty — save with Ctrl+Shift+${digitMatch[1]}`, { icon: '\u2139\uFE0F' });
          }
          return;
        }
      }

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts(s => !s);
        return;
      }

      if (e.key === 'f') {
        e.preventDefault();
        rfInstanceRef.current?.fitView({ padding: 0.4, maxZoom: 0.8 });
        return;
      }

      if (e.key === 'g') {
        e.preventDefault();
        setSnapToGrid(s => !s);
        return;
      }

      if (e.key === 'c' && !e.ctrlKey) {
        // Toggle collapse on selected node
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 1) {
          e.preventDefault();
          setNodes(nds => nds.map(n => {
            if (n.selected) {
              return { ...n, data: { ...n.data, collapsed: !(n.data as any).collapsed } };
            }
            return n;
          }));
        }
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        rfInstanceRef.current?.zoomTo(1);
        return;
      }

      if (e.key === '0') {
        e.preventDefault();
        rfInstanceRef.current?.fitView({ padding: 0.4, maxZoom: 0.8 });
        return;
      }

      if (e.key === 'Escape') {
        if (showCommandPalette) { setShowCommandPalette(false); return; }
        if (quickAddMenu) { setQuickAddMenu(null); return; }
        if (showSearch) { setShowSearch(false); setHighlightedNodeIds(new Set()); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (contextMenu) { setContextMenu(null); return; }
        if (nodeContextMenu) { setNodeContextMenu(null); return; }
        if (edgeContextMenu) { setEdgeContextMenu(null); return; }
        if (selectedQuestionId) { setSelectedQuestionId(null); return; }
        // Exit focus mode with Escape
        setFocusMode(false);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
        return;
      }

      // Shift+A = Align left, Shift+D = Distribute horizontally
      if (e.shiftKey && e.key === 'A') {
        e.preventDefault();
        handleAlignLeft();
        return;
      }
      if (e.shiftKey && e.key === 'D') {
        e.preventDefault();
        handleDistributeH();
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    showSearch,
    showShortcuts,
    showCommandPalette,
    contextMenu,
    nodeContextMenu,
    edgeContextMenu,
    quickAddMenu,
    selectedQuestionId,
    setSelectedQuestionId,
    setShowSearch,
    setShowShortcuts,
    setShowCommandPalette,
    setContextMenu,
    setNodeContextMenu,
    setEdgeContextMenu,
    setQuickAddMenu,
    setHighlightedNodeIds,
    setSnapToGrid,
    handleDeleteSelected,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleSelectAll,
    handleAlignLeft,
    handleDistributeH,
    undo,
    redo,
    nodes,
    setNodes,
    rfInstanceRef,
    handleCreateGroup,
    saveBookmark,
    recallBookmark,
    handleAutoLayout,
    setFocusMode,
  ]);
}
