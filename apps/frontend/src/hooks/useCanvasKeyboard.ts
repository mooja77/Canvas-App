import { useEffect, type RefObject } from 'react';
import type { Node, ReactFlowInstance } from '@xyflow/react';
import toast from 'react-hot-toast';
import type { Bookmark } from './useCanvasBookmarks';
import { useShortcutStore, matchesShortcut } from '../stores/shortcutStore';

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

  // Group creation
  handleCreateGroup: () => void;

  // Viewport bookmarks
  saveBookmark: (slot: number, viewport: { x: number; y: number; zoom: number }) => void;
  recallBookmark: (slot: number) => Bookmark | null;

  // Auto-layout & focus mode
  handleAutoLayout: () => void;
  setFocusMode: (v: boolean | ((prev: boolean) => boolean)) => void;

  // Undo / Redo
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Tab navigation
  onNextTab?: () => void;
  onPrevTab?: () => void;

  // Mute/bypass
  onToggleMute?: () => void;
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
    handleCreateGroup,
    saveBookmark,
    recallBookmark,
    handleAutoLayout,
    setFocusMode,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onNextTab,
    onPrevTab,
    onToggleMute,
  } = options;

  const shortcuts = useShortcutStore((s) => s.shortcuts);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      // Escape is always hardcoded (not remappable)
      if (e.key === 'Escape') {
        if (showCommandPalette) { setShowCommandPalette(false); return; }
        if (quickAddMenu) { setQuickAddMenu(null); return; }
        if (showSearch) { setShowSearch(false); setHighlightedNodeIds(new Set()); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (contextMenu) { setContextMenu(null); return; }
        if (nodeContextMenu) { setNodeContextMenu(null); return; }
        if (edgeContextMenu) { setEdgeContextMenu(null); return; }
        if (selectedQuestionId) { setSelectedQuestionId(null); return; }
        setFocusMode(false);
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab: switch tabs (not remappable)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) onPrevTab?.();
        else onNextTab?.();
        return;
      }

      // Ctrl+Shift+1-5: save viewport bookmark (not remappable)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
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

      // Alt+1-5: recall viewport bookmark (not remappable)
      if (e.altKey) {
        const digitMatch = e.code.match(/^Digit([1-5])$/);
        if (digitMatch) {
          e.preventDefault();
          const slot = parseInt(digitMatch[1]) - 1;
          const bm = recallBookmark(slot);
          if (bm) {
            rfInstanceRef.current?.setViewport(bm, { duration: 300 });
          } else {
            toast(`Bookmark ${digitMatch[1]} is empty \u2014 save with Ctrl+Shift+${digitMatch[1]}`, { icon: '\u2139\uFE0F' });
          }
          return;
        }
      }

      // --- Remappable shortcuts via the store ---

      // Redo must be checked before Undo (since ctrl+shift+z contains ctrl+z)
      if (matchesShortcut(e, shortcuts.redo)) {
        e.preventDefault();
        if (canRedo) {
          onRedo();
          toast('Redone', { duration: 1500 });
        }
        return;
      }

      // Also support Ctrl+Y for redo regardless of mapping
      if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (canRedo) {
          onRedo();
          toast('Redone', { duration: 1500 });
        }
        return;
      }

      if (matchesShortcut(e, shortcuts.collapseAll)) {
        e.preventDefault();
        setNodes(nds => {
          const anyExpanded = nds.some(n => !(n.data as Record<string, unknown>).collapsed && ['transcript', 'question', 'memo', 'case'].includes(n.type || ''));
          return nds.map(n => {
            if (['transcript', 'question', 'memo', 'case'].includes(n.type || '')) {
              return { ...n, data: { ...n.data, collapsed: anyExpanded } };
            }
            return n;
          });
        });
        return;
      }

      if (matchesShortcut(e, shortcuts.copy)) {
        e.preventDefault();
        handleCopy();
        return;
      }
      if (matchesShortcut(e, shortcuts.paste)) {
        e.preventDefault();
        handlePaste();
        return;
      }
      if (matchesShortcut(e, shortcuts.duplicate)) {
        e.preventDefault();
        handleDuplicate();
        return;
      }
      if (matchesShortcut(e, shortcuts.selectAll)) {
        e.preventDefault();
        handleSelectAll();
        return;
      }
      if (matchesShortcut(e, shortcuts.commandPalette)) {
        e.preventDefault();
        setShowCommandPalette(s => !s);
        return;
      }
      if (matchesShortcut(e, shortcuts.undo)) {
        e.preventDefault();
        if (canUndo) {
          onUndo();
          toast('Undone', { duration: 1500 });
        }
        return;
      }
      if (matchesShortcut(e, shortcuts.search)) {
        e.preventDefault();
        setShowSearch(true);
        return;
      }
      if (matchesShortcut(e, shortcuts.focusMode)) {
        e.preventDefault();
        setFocusMode((prev: boolean) => !prev);
        return;
      }
      if (matchesShortcut(e, shortcuts.autoLayout)) {
        e.preventDefault();
        handleAutoLayout();
        return;
      }
      if (matchesShortcut(e, shortcuts.group)) {
        e.preventDefault();
        handleCreateGroup();
        return;
      }
      if (matchesShortcut(e, shortcuts.mute)) {
        e.preventDefault();
        onToggleMute?.();
        return;
      }
      if (matchesShortcut(e, shortcuts.showShortcuts)) {
        e.preventDefault();
        setShowShortcuts(s => !s);
        return;
      }
      if (matchesShortcut(e, shortcuts.fitView)) {
        e.preventDefault();
        rfInstanceRef.current?.fitView({ padding: 0.4, maxZoom: 1.0 });
        return;
      }
      if (matchesShortcut(e, shortcuts.toggleGrid)) {
        e.preventDefault();
        setSnapToGrid(s => !s);
        return;
      }
      if (matchesShortcut(e, shortcuts.toggleCollapse)) {
        const selected = nodes.filter(n => n.selected);
        if (selected.length === 1) {
          e.preventDefault();
          setNodes(nds => nds.map(n => {
            if (n.selected) {
              return { ...n, data: { ...n.data, collapsed: !(n.data as Record<string, unknown>).collapsed } };
            }
            return n;
          }));
        }
        return;
      }
      if (matchesShortcut(e, shortcuts.zoomTo100)) {
        e.preventDefault();
        rfInstanceRef.current?.zoomTo(1, { duration: 300 });
        return;
      }
      if (matchesShortcut(e, shortcuts.zoomToFit)) {
        e.preventDefault();
        rfInstanceRef.current?.fitView({ padding: 0.4, maxZoom: 1.0 });
        return;
      }
      if (matchesShortcut(e, shortcuts.delete)) {
        handleDeleteSelected();
        return;
      }
      if (matchesShortcut(e, shortcuts.alignLeft)) {
        e.preventDefault();
        handleAlignLeft();
        return;
      }
      if (matchesShortcut(e, shortcuts.distributeH)) {
        e.preventDefault();
        handleDistributeH();
        return;
      }

      // Arrow key panning (no ctrl/alt/meta modifier, shift for larger jump)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const rfInstance = rfInstanceRef.current;
        if (!rfInstance) return;
        e.preventDefault();
        const step = e.shiftKey ? 200 : 50;
        const vp = rfInstance.getViewport();
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = step;
        if (e.key === 'ArrowDown') dy = -step;
        if (e.key === 'ArrowLeft') dx = step;
        if (e.key === 'ArrowRight') dx = -step;
        rfInstance.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 100 });
        return;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    shortcuts,
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
    nodes,
    setNodes,
    rfInstanceRef,
    handleCreateGroup,
    saveBookmark,
    recallBookmark,
    handleAutoLayout,
    setFocusMode,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onNextTab,
    onPrevTab,
    onToggleMute,
  ]);
}
