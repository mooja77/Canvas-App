import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  type NodeChange,
  type ReactFlowInstance,
  type OnSelectionChangeParams,
  BackgroundVariant,
  reconnectEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TranscriptNode from './nodes/TranscriptNode';
import QuestionNode from './nodes/QuestionNode';
import MemoNode from './nodes/MemoNode';
import CaseNode from './nodes/CaseNode';
import GroupNode from './nodes/GroupNode';
import StickyNoteNode from './nodes/StickyNoteNode';
import RerouteNode from './nodes/RerouteNode';
import SearchResultNode from './nodes/SearchResultNode';
import CooccurrenceNode from './nodes/CooccurrenceNode';
import MatrixNode from './nodes/MatrixNode';
import StatsNode from './nodes/StatsNode';
import ComparisonNode from './nodes/ComparisonNode';
import WordCloudNode from './nodes/WordCloudNode';
import ClusterNode from './nodes/ClusterNode';
import CodingQueryNode from './nodes/CodingQueryNode';
import SentimentNode from './nodes/SentimentNode';
import TreemapNode from './nodes/TreemapNode';
import TimelineNode from './nodes/TimelineNode';
import GeoMapNode from './nodes/GeoMapNode';
import DocumentNode from './nodes/DocumentNode';
import DocumentPortraitNode from './nodes/DocumentPortraitNode';
import CodingEdge from './edges/CodingEdge';
import RelationEdge from './edges/RelationEdge';
import CodeNavigator from './panels/CodeNavigator';
import CanvasToolbar from './panels/CanvasToolbar';
import { useContainerSize } from '../../hooks/useContainerSize';
import CodingDetailPanel from './panels/CodingDetailPanel';
import KeyboardShortcutsModal from './panels/KeyboardShortcutsModal';
import CanvasSearchOverlay from './panels/CanvasSearchOverlay';
import CommandPalette from './panels/CommandPalette';
import OnboardingTour from './panels/OnboardingTour';
import CanvasContextMenu from './panels/CanvasContextMenu';
import NodeContextMenu from './panels/NodeContextMenu';
import EdgeContextMenu from './panels/EdgeContextMenu';
import SelectionToolbar from './panels/SelectionToolbar';
import QuickAddMenu from './panels/QuickAddMenu';
import ExcerptBrowserModal from './panels/ExcerptBrowserModal';
import RichExportModal from './panels/RichExportModal';
import IntercoderReliabilityModal from './panels/IntercoderReliabilityModal';
import IntercoderPanel from './panels/IntercoderPanel';
import CodeWeightingPanel from './panels/CodeWeightingPanel';
import CrossCaseAnalysisModal from './panels/CrossCaseAnalysisModal';
import PresentationMode from './panels/PresentationMode';
import CanvasTabBar from './panels/CanvasTabBar';
import AiSuggestPanel from './panels/AiSuggestPanel';
import AiAutoCodeModal from './panels/AiAutoCodeModal';
import AiSetupGuide from './panels/AiSetupGuide';
import PresenceAvatars from './panels/PresenceAvatars';
import CollabCursors from './CollabCursors';
import ConfirmDialog from './ConfirmDialog';
import { ErrorBoundary } from '../ErrorBoundary';
import { useCanvasStore, useActiveCanvas, usePendingSelection, useSelectedQuestionId } from '../../stores/canvasStore';
import { useCanvasKeyboard } from '../../hooks/useCanvasKeyboard';
import { useCanvasHistory } from '../../hooks/useCanvasHistory';
import { useCanvasBookmarks } from '../../hooks/useCanvasBookmarks';
import { useCanvasGroups } from '../../hooks/useCanvasGroups';
import { useCanvasStickyNotes } from '../../hooks/useCanvasStickyNotes';
import { useAutoLayout } from '../../hooks/useAutoLayout';
import { useNodeColors } from '../../hooks/useNodeColors';
import { useCanvasRerouteNodes } from '../../hooks/useCanvasRerouteNodes';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import { useMobile } from '../../hooks/useMobile';
import { useCollaboration } from '../../hooks/useCollaboration';
import { useAiSuggestions } from '../../hooks/useAiSuggestions';
import { useAiConfigStore } from '../../stores/aiConfigStore';
import { useUIStore } from '../../stores/uiStore';
import type {
  CanvasTranscript,
  CanvasQuestion,
  CanvasMemo,
  CanvasTextCoding,
  CanvasNodePosition,
  CanvasCase,
  CanvasRelation,
  CanvasComputedNode,
  ComputedNodeType,
} from '@qualcanvas/shared';
import toast from 'react-hot-toast';

// Wrap a node component with error boundary so computed node errors
// don't crash the entire canvas
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic node wrapper needs any for props forwarding
function withErrorBoundary(NodeComponent: React.ComponentType<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic node wrapper needs any for props forwarding
  const WrappedNode = function WrappedNode(props: any) {
    return (
      <ErrorBoundary>
        <NodeComponent {...props} />
      </ErrorBoundary>
    );
  };
  WrappedNode.displayName = `WithErrorBoundary(${NodeComponent.displayName || NodeComponent.name || 'Component'})`;
  return WrappedNode;
}

const nodeTypes = {
  // Base node types — no error boundary wrapping
  transcript: TranscriptNode,
  question: QuestionNode,
  memo: MemoNode,
  case: CaseNode,
  // Visual grouping node
  group: GroupNode,
  // Sticky notes
  sticky: StickyNoteNode,
  // Reroute waypoint nodes
  reroute: RerouteNode,
  // Computed node types — wrapped with error boundary
  search: withErrorBoundary(SearchResultNode),
  cooccurrence: withErrorBoundary(CooccurrenceNode),
  matrix: withErrorBoundary(MatrixNode),
  stats: withErrorBoundary(StatsNode),
  comparison: withErrorBoundary(ComparisonNode),
  wordcloud: withErrorBoundary(WordCloudNode),
  cluster: withErrorBoundary(ClusterNode),
  codingquery: withErrorBoundary(CodingQueryNode),
  sentiment: withErrorBoundary(SentimentNode),
  treemap: withErrorBoundary(TreemapNode),
  timeline: withErrorBoundary(TimelineNode),
  geomap: withErrorBoundary(GeoMapNode),
  document: withErrorBoundary(DocumentNode),
  documentportrait: withErrorBoundary(DocumentPortraitNode),
};

const edgeTypes = {
  coding: CodingEdge,
  relation: RelationEdge,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Stable references for ReactFlow props (avoids re-renders from inline objects)
const SNAP_GRID: [number, number] = [20, 20];
const FIT_VIEW_OPTIONS = { padding: 0.4, maxZoom: 1.0 };
const PRO_OPTIONS = { hideAttribution: true };

export default function CanvasWorkspace() {
  // Granular selector hooks for read-only data
  const activeCanvas = useActiveCanvas();
  const pendingSelection = usePendingSelection();
  const selectedQuestionId = useSelectedQuestionId();
  const scrollMode = useUIStore(s => s.scrollMode);
  const setScrollMode = useUIStore(s => s.setScrollMode);

  // Individual action selectors
  const {
    canvases,
    openCanvas,
    closeCanvas,
    setPendingSelection,
    createCoding,
    saveLayout,
    savingLayout,
    setSelectedQuestionId,
    addRelation,
    mergeQuestions,
    addMemo,
    addQuestion,
    addTranscript,
    addComputedNode,
    deleteTranscript,
    deleteQuestion,
    deleteMemo,
    deleteCase,
    deleteComputedNode,
    deleteCoding,
    deleteRelation,
    reassignCoding,
    refreshCanvas,
  } = useCanvasStore();

  const _isMobile = useMobile();

  const { showWarning: showSessionWarning, dismissWarning: dismissSessionWarning } = useSessionTimeout();

  // Real-time collaboration
  const collaboration = useCollaboration({ canvasId: activeCanvas?.id ?? null });

  // AI coding assistant
  const aiSuggestions = useAiSuggestions();
  const [showAiAutoCode, setShowAiAutoCode] = useState(false);
  const [showAiSetupGuide, setShowAiSetupGuide] = useState<string | null>(null);
  const { configured: aiConfigured, fetchConfig: fetchAiConfig } = useAiConfigStore();

  // Fetch AI config on mount
  useEffect(() => { fetchAiConfig(); }, [fetchAiConfig]);

  // Guard function: show setup guide if AI not configured
  const requireAiConfig = useCallback((featureName: string, callback: () => void) => {
    if (aiConfigured) {
      callback();
    } else {
      setShowAiSetupGuide(featureName);
    }
  }, [aiConfigured]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitViewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [relationLabel, setRelationLabel] = useState<{ show: boolean; source: string; target: string }>({ show: false, source: '', target: '' });
  const [mergeConfirm, setMergeConfirm] = useState<{ show: boolean; sourceId: string; targetId: string; sourceName: string; targetName: string }>({ show: false, sourceId: '', targetId: '', sourceName: '', targetName: '' });

  // UI state
  const [showNavigator, setShowNavigator] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showExcerpts, setShowExcerpts] = useState(false);
  const [showRichExport, setShowRichExport] = useState(false);
  const [showIntercoder, setShowIntercoder] = useState(false);
  const [showIntercoderPanel, setShowIntercoderPanel] = useState(false);
  const [showWeighting, setShowWeighting] = useState(false);
  const [showCrossCase, setShowCrossCase] = useState(false);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ show: boolean; x: number; y: number; nodeId: string; nodeType: string; collapsed: boolean } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ show: boolean; x: number; y: number; edgeId: string; edgeType: string; label?: string } | null>(null);
  const [quickAddMenu, setQuickAddMenu] = useState<{ x: number; y: number } | null>(null);
  const [_smartLinkSource, setSmartLinkSource] = useState<{ nodeId: string; nodeType: string } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;
  const { setZoomTier } = useUIStore();
  const [deleteConfirm, setDeleteConfirm] = useState<{ nodeId: string; label: string; type: string } | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);

  // Snap to grid
  const [snapToGrid, setSnapToGrid] = useState(false);

  // Muted/bypassed nodes
  const [mutedNodeIds, setMutedNodeIds] = useState<Set<string>>(new Set());

  // Drag-and-drop file import
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // Clipboard for copy/paste
  const clipboardRef = useRef<Node[]>([]);

  // Resize detection refs
  const workspaceRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // (userInteractedRef removed — resize handler now uses size-delta threshold instead)
  const manualNavToggleRef = useRef(false);
  const _resizeFitViewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceSize = useContainerSize(workspaceRef);
  const _canvasContainerSize = useContainerSize(canvasContainerRef);

  // Viewport bookmarks (5 slots, persisted per canvas)
  const { bookmarks, saveBookmark, recallBookmark, hasBookmark: _hasBookmark } = useCanvasBookmarks();

  // Visual groups (persisted in localStorage)
  const { groups, addGroup, removeGroup, updateGroup } = useCanvasGroups();

  // Sticky notes (persisted in localStorage)
  const { stickyNotes, addStickyNote, removeStickyNote, updateStickyNote } = useCanvasStickyNotes();

  // Auto-layout
  const { applyLayout } = useAutoLayout(setNodes);

  // Undo/redo history (layout changes only)
  const { pushState: pushHistory, undo: historyUndo, redo: historyRedo, canUndo, canRedo, clearHistory } = useCanvasHistory();

  // Snapshot current nodes/edges into undo history (reads state via updater without mutating)
  const pushHistorySnapshot = useCallback(() => {
    setNodes((currentNodes: Node[]) => {
      setEdges((currentEdges: Edge[]) => {
        pushHistory(currentNodes, currentEdges);
        return currentEdges;
      });
      return currentNodes;
    });
  }, [setNodes, setEdges, pushHistory]);

  // Custom node colors (persisted in localStorage)
  const { colorMap: nodeColorMap, setNodeColor, getNodeColor: _getNodeColor } = useNodeColors();

  // Reroute waypoint nodes (persisted in localStorage)
  const { rerouteNodes, addReroute, removeReroute: _removeReroute, updateReroutePosition: _updateReroutePosition } = useCanvasRerouteNodes();

  // Focus mode (hides toolbar, sidebar, status bar)
  const [focusMode, setFocusMode] = useState(false);

  // Presentation mode
  const [presentationMode, setPresentationMode] = useState(false);

  // Multi-canvas tabs
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('canvas-open-tabs');
      return stored ? [...new Set<string>(JSON.parse(stored))] : [];
    } catch { return []; }
  });
  const viewportCacheRef = useRef<Map<string, { x: number; y: number; zoom: number }>>(new Map());

  // Keep active canvas in tabs
  useEffect(() => {
    const canvasId = activeCanvas?.id;
    if (!canvasId) return;
    setOpenTabs(prev => {
      if (prev.includes(canvasId)) return prev;
      const next = [...new Set([...prev, canvasId])];
      try { localStorage.setItem('canvas-open-tabs', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [activeCanvas?.id]);

  // Build position map with dimensions and collapsed state
  const nodePositions = activeCanvas?.nodePositions;
  const posMap = useMemo(() => {
    if (!nodePositions) return new Map<string, CanvasNodePosition>();
    const map = new Map<string, CanvasNodePosition>();
    nodePositions.forEach((p: CanvasNodePosition) => map.set(p.nodeId, p));
    return map;
  }, [nodePositions]);

  // Build nodes from canvas data
  const buildNodes = useCallback((): Node[] => {
    if (!activeCanvas) return [];

    const isSearching = highlightedNodeIds.size > 0;
    const result: Node[] = [];

    activeCanvas.transcripts.forEach((t: CanvasTranscript, i: number) => {
      const nodeId = `transcript-${t.id}`;
      const posData = posMap.get(nodeId);
      const pos = posData ? { x: posData.x, y: posData.y } : { x: 50, y: 50 + i * 500 };
      const dimmed = isSearching && !highlightedNodeIds.has(nodeId);
      const style: Record<string, unknown> = { transition: 'opacity 0.2s' };
      if (dimmed) style.opacity = 0.15;
      if (posData?.width) style.width = posData.width;
      if (posData?.height) style.minHeight = posData.height;
      result.push({
        id: nodeId,
        type: 'transcript',
        position: pos,
        dragHandle: '.drag-handle',
        style,
        data: {
          transcriptId: t.id,
          title: t.title,
          content: t.content,
          caseId: t.caseId,
          collapsed: posData?.collapsed ?? false,
          customColor: nodeColorMap.get(nodeId),
          onAiSuggest: (tId: string, text: string, start: number, end: number) => {
            requireAiConfig('AI Code Suggestions', () => aiSuggestions.suggestCodes(tId, text, start, end));
          },
        },
      });
    });

    activeCanvas.questions.forEach((q: CanvasQuestion, i: number) => {
      const nodeId = `question-${q.id}`;
      const posData = posMap.get(nodeId);
      const pos = posData ? { x: posData.x, y: posData.y } : { x: 550, y: 50 + i * 280 };
      const dimmed = isSearching && !highlightedNodeIds.has(nodeId);
      const style: Record<string, unknown> = { transition: 'opacity 0.2s' };
      if (dimmed) style.opacity = 0.15;
      if (posData?.width) style.width = posData.width;
      if (posData?.height) style.minHeight = posData.height;
      result.push({
        id: nodeId,
        type: 'question',
        position: pos,
        dragHandle: '.drag-handle',
        style,
        data: {
          questionId: q.id,
          text: q.text,
          color: q.color,
          collapsed: posData?.collapsed ?? false,
        },
      });
    });

    activeCanvas.memos.forEach((m: CanvasMemo, i: number) => {
      const nodeId = `memo-${m.id}`;
      const posData = posMap.get(nodeId);
      const pos = posData ? { x: posData.x, y: posData.y } : { x: 900, y: 50 + i * 300 };
      const dimmed = isSearching && !highlightedNodeIds.has(nodeId);
      const style: Record<string, unknown> = { transition: 'opacity 0.2s' };
      if (dimmed) style.opacity = 0.15;
      if (posData?.width) style.width = posData.width;
      if (posData?.height) style.minHeight = posData.height;
      result.push({
        id: nodeId,
        type: 'memo',
        position: pos,
        dragHandle: '.drag-handle',
        style,
        data: {
          memoId: m.id,
          title: m.title,
          content: m.content,
          color: m.color,
          collapsed: posData?.collapsed ?? false,
        },
      });
    });

    // Case nodes
    (activeCanvas.cases ?? []).forEach((c: CanvasCase, i: number) => {
      const nodeId = `case-${c.id}`;
      const posData = posMap.get(nodeId);
      const pos = posData ? { x: posData.x, y: posData.y } : { x: -400, y: 50 + i * 300 };
      const style: Record<string, unknown> = { transition: 'opacity 0.2s' };
      if (isSearching) style.opacity = 0.15;
      if (posData?.width) style.width = posData.width;
      if (posData?.height) style.minHeight = posData.height;
      result.push({
        id: nodeId,
        type: 'case',
        position: pos,
        dragHandle: '.drag-handle',
        style,
        data: {
          caseId: c.id,
          collapsed: posData?.collapsed ?? false,
          customColor: nodeColorMap.get(nodeId),
        },
      });
    });

    // Computed nodes — 2-column grid to reduce vertical extent
    (activeCanvas.computedNodes ?? []).forEach((cn: CanvasComputedNode, i: number) => {
      const nodeId = `computed-${cn.id}`;
      const posData = posMap.get(nodeId);
      const col = i % 2;
      const row = Math.floor(i / 2);
      const pos = posData ? { x: posData.x, y: posData.y } : { x: 1250 + col * 400, y: 50 + row * 420 };
      const style: Record<string, unknown> = { transition: 'opacity 0.2s' };
      if (isSearching) style.opacity = 0.15;
      if (posData?.width) style.width = posData.width;
      if (posData?.height) style.height = posData.height;
      result.push({
        id: nodeId,
        type: cn.nodeType,
        position: pos,
        dragHandle: '.drag-handle',
        style,
        data: {
          computedNodeId: cn.id,
          collapsed: posData?.collapsed ?? false,
        },
      });
    });

    // Group nodes (visual-only, metadata from localStorage)
    groups.forEach((g) => {
      const nodeId = `group-${g.id}`;
      const posData = posMap.get(nodeId);
      const pos = posData ? { x: posData.x, y: posData.y } : { x: g.x, y: g.y };
      const w = posData?.width ?? g.width;
      const h = posData?.height ?? g.height;
      const style: Record<string, unknown> = {
        transition: 'opacity 0.2s',
        zIndex: -1,
      };
      if (w) style.width = w;
      if (h) style.height = h;
      result.unshift({
        id: nodeId,
        type: 'group',
        position: pos,
        dragHandle: '.drag-handle',
        zIndex: -1,
        style,
        data: {
          title: g.title,
          color: g.color,
          collapsed: posData?.collapsed ?? false,
          onTitleChange: (newTitle: string) => updateGroup(g.id, { title: newTitle }),
        },
      });
    });

    // Sticky note nodes (visual-only, from localStorage)
    stickyNotes.forEach((sn) => {
      const nodeId = `sticky-${sn.id}`;
      const posData = posMap.get(nodeId);
      const pos = posData ? { x: posData.x, y: posData.y } : { x: sn.x, y: sn.y };
      const style: Record<string, unknown> = { transition: 'opacity 0.2s' };
      if (posData?.width ?? sn.width) style.width = posData?.width ?? sn.width;
      if (posData?.height ?? sn.height) style.height = posData?.height ?? sn.height;
      result.push({
        id: nodeId,
        type: 'sticky',
        position: pos,
        dragHandle: '.drag-handle',
        style,
        data: {
          noteId: sn.id,
          text: sn.text,
          color: sn.color,
          onTextChange: (text: string) => updateStickyNote(sn.id, { text }),
          onColorChange: (color: string) => updateStickyNote(sn.id, { color }),
          onDelete: () => removeStickyNote(sn.id),
        },
      });
    });

    // Reroute waypoint nodes
    rerouteNodes.forEach(rn => {
      const posData = posMap.get(rn.id);
      result.push({
        id: rn.id,
        type: 'reroute',
        position: posData ? { x: posData.x, y: posData.y } : { x: rn.x, y: rn.y },
        data: {},
      });
    });

    // Apply muted styling to bypassed nodes
    for (const node of result) {
      if (mutedNodeIds.has(node.id)) {
        node.style = { ...node.style, opacity: 0.3, border: '2px dashed #9ca3af' };
        node.data = { ...node.data, muted: true };
      }
    }

    return result;
  }, [activeCanvas, highlightedNodeIds, posMap, groups, updateGroup, stickyNotes, updateStickyNote, removeStickyNote, nodeColorMap, rerouteNodes, aiSuggestions, requireAiConfig, mutedNodeIds]);

  // Build edges from codings and relations
  const buildEdges = useCallback((): Edge[] => {
    if (!activeCanvas) return [];
    const questionColorMap = new Map<string, string>();
    activeCanvas.questions.forEach((q: CanvasQuestion) => questionColorMap.set(q.id, q.color));

    const codingEdges: Edge[] = activeCanvas.codings.map((c: CanvasTextCoding) => ({
      id: `coding-${c.id}`,
      source: `transcript-${c.transcriptId}`,
      target: `question-${c.questionId}`,
      type: 'coding',
      reconnectable: true,
      data: {
        codingId: c.id,
        codedText: c.codedText,
        questionColor: questionColorMap.get(c.questionId) || '#3B82F6',
      },
    }));

    // Relation edges
    const relationEdges: Edge[] = (activeCanvas.relations ?? []).map((r: CanvasRelation) => ({
      id: `relation-${r.id}`,
      source: `${r.fromType}-${r.fromId}`,
      target: `${r.toType}-${r.toId}`,
      type: 'relation',
      data: {
        relationId: r.id,
        label: r.label,
      },
    }));

    return [...codingEdges, ...relationEdges];
  }, [activeCanvas]);

  // Sync nodes/edges when canvas data changes — preserve local positions, only fitView on canvas switch
  const loadedCanvasIdRef = useRef<string | null>(null);
  useEffect(() => {
    const canvasId = activeCanvas?.id ?? null;
    const isNewCanvas = canvasId !== loadedCanvasIdRef.current;

    if (isNewCanvas) {
      // Full rebuild on canvas switch or initial load
      clearHistory();
      const newNodes = buildNodes();
      const newEdges = buildEdges();
      setNodes(newNodes);
      setEdges(newEdges);
      // Capture initial state so first undo has a baseline
      pushHistory(newNodes, newEdges);
      if (canvasId) {
        loadedCanvasIdRef.current = canvasId;
        if (fitViewTimeoutRef.current) clearTimeout(fitViewTimeoutRef.current);
        fitViewTimeoutRef.current = setTimeout(() => {
          rfInstanceRef.current?.fitView(FIT_VIEW_OPTIONS);
        }, 200);
      }
    } else {
      // Same canvas — update node data but preserve local positions
      const freshNodes = buildNodes();
      setNodes((currentNodes: Node[]) => {
        const currentPosMap = new Map(currentNodes.map(n => [n.id, n.position]));
        return freshNodes.map(n => {
          const localPos = currentPosMap.get(n.id);
          return localPos ? { ...n, position: localPos } : n;
        });
      });
      setEdges(buildEdges());
    }
  }, [activeCanvas, buildNodes, buildEdges, setNodes, setEdges, clearHistory, pushHistory]);

  // Note: No automatic fitView on container resize — sidebar open/close, navigator toggle,
  // and other layout changes should not reset the user's viewport. Users can press F or
  // click Fit View to re-center manually. ReactFlow handles its own internal viewport
  // adjustments when the container size changes.

  // Auto-collapse navigator sidebar when workspace gets narrow
  useEffect(() => {
    if (!workspaceSize.width) return;
    if (workspaceSize.width < 900 && showNavigator && !focusMode) {
      if (!manualNavToggleRef.current) {
        setShowNavigator(false);
      }
    } else if (workspaceSize.width >= 900 && !showNavigator && !focusMode) {
      if (!manualNavToggleRef.current) {
        setShowNavigator(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showNavigator is read but intentionally omitted to prevent toggle loops
  }, [workspaceSize.width, focusMode]);

  // Handle connection: create coding or relation
  const onConnect: OnConnect = useCallback(
    async (connection) => {
      const sourceId = connection.source;
      const targetId = connection.target;

      if (!sourceId || !targetId) return;

      // Transcript -> Question: create coding
      if (sourceId.startsWith('transcript-') && targetId.startsWith('question-')) {
        if (!pendingSelection) {
          toast.error('Select text in the transcript first, then drag to a question');
          return;
        }

        const transcriptId = sourceId.replace('transcript-', '');
        const questionId = targetId.replace('question-', '');

        if (pendingSelection.transcriptId !== transcriptId) {
          toast.error('Selection is from a different transcript');
          setPendingSelection(null);
          return;
        }

        try {
          await createCoding(
            transcriptId,
            questionId,
            pendingSelection.startOffset,
            pendingSelection.endOffset,
            pendingSelection.codedText,
          );
          window.getSelection()?.removeAllRanges();
          toast.success('Text coded successfully');
        } catch {
          toast.error('Failed to create coding');
        }
        return;
      }

      // Question-to-Question: offer merge or relation
      if (sourceId.startsWith('question-') && targetId.startsWith('question-')) {
        const srcQid = sourceId.replace('question-', '');
        const tgtQid = targetId.replace('question-', '');
        const srcQ = activeCanvas?.questions.find(q => q.id === srcQid);
        const tgtQ = activeCanvas?.questions.find(q => q.id === tgtQid);
        setMergeConfirm({
          show: true,
          sourceId: srcQid,
          targetId: tgtQid,
          sourceName: srcQ?.text || 'Source',
          targetName: tgtQ?.text || 'Target',
        });
        return;
      }

      // Case-to-Case, Question-to-Case: create relation
      const validRelationSources = ['case-', 'question-'];
      const isValidSource = validRelationSources.some(prefix => sourceId.startsWith(prefix));
      const isValidTarget = validRelationSources.some(prefix => targetId.startsWith(prefix));

      if (isValidSource && isValidTarget) {
        setRelationLabel({ show: true, source: sourceId, target: targetId });
        return;
      }

      toast.error('Invalid connection. Drag from transcript to question, or between cases/questions.');
    },
    [pendingSelection, createCoding, setPendingSelection, activeCanvas?.questions],
  );

  // Edge reconnection handler
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Parameters<typeof reconnectEdge>[1]) => {
      // Update edges visually
      setEdges((els) => reconnectEdge(oldEdge, newConnection, els));

      // If it's a coding edge being reconnected to a different question
      const edgeData = oldEdge.data as Record<string, unknown> | undefined;
      if (oldEdge.type === 'coding' && edgeData?.codingId) {
        const newTarget = newConnection.target;
        if (newTarget?.startsWith('question-')) {
          const newQuestionId = newTarget.replace('question-', '');
          reassignCoding(edgeData.codingId as string, newQuestionId)
            .then(() => toast.success('Coding reassigned'))
            .catch(() => toast.error('Failed to reassign coding'));
        }
      }
    },
    [setEdges, reassignCoding],
  );

  // Smart Link: when connection dropped on empty canvas, open filtered QuickAddMenu
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      // Only handle if connection was NOT completed (no target)
      const targetIsPane = (event.target as HTMLElement)?.classList?.contains('react-flow__pane');
      if (!targetIsPane) return;

      // Find the source node type from the connection start
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing internal ReactFlow API
      const _connectingNodeId = (rfInstanceRef.current as any)?.toObject?.()?.nodes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal ReactFlow node shape
        ?.find((n: any) => n.selected)?.id;

      // Fall back to checking which node started the connection via the store
      // We get the source from the onConnectStart event stored in a ref
      const sourceInfo = connectStartRef.current;
      if (!sourceInfo) return;

      const clientX = 'touches' in event ? event.touches[0]?.clientX ?? 0 : event.clientX;
      const clientY = 'touches' in event ? event.touches[0]?.clientY ?? 0 : event.clientY;

      // Determine allowed items based on source type
      let allowedItems: string[] | undefined;
      if (sourceInfo.nodeType === 'transcript') {
        allowedItems = ['question'];
      } else if (sourceInfo.nodeType === 'question') {
        allowedItems = ['question', 'memo'];
      } else if (sourceInfo.nodeType === 'case') {
        allowedItems = ['question', 'memo'];
      }

      setSmartLinkSource(sourceInfo);
      setQuickAddMenu({ x: clientX, y: clientY });
      // Store allowed items in a ref so QuickAddMenu can use it
      smartLinkAllowedRef.current = allowedItems || null;
    },
    [],
  );

  const connectStartRef = useRef<{ nodeId: string; nodeType: string } | null>(null);
  const smartLinkAllowedRef = useRef<string[] | null>(null);

  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: { nodeId: string | null; handleType: string | null }) => {
      if (!params.nodeId) return;
      const nodeType = params.nodeId.split('-')[0]; // 'transcript', 'question', 'case', etc.
      connectStartRef.current = { nodeId: params.nodeId, nodeType };
    },
    [],
  );

  const handleMerge = async () => {
    try {
      await mergeQuestions(mergeConfirm.sourceId, mergeConfirm.targetId);
      toast.success('Questions merged successfully');
    } catch {
      toast.error('Failed to merge questions');
    }
    setMergeConfirm({ show: false, sourceId: '', targetId: '', sourceName: '', targetName: '' });
  };

  const handleCreateRelation = async (label: string) => {
    const { source, target } = relationLabel;
    const fromType = source.startsWith('case-') ? 'case' : 'question';
    const fromId = source.replace(/^(case|question)-/, '');
    const toType = target.startsWith('case-') ? 'case' : 'question';
    const toId = target.replace(/^(case|question)-/, '');

    try {
      await addRelation(fromType as 'case' | 'question', fromId, toType as 'case' | 'question', toId, label);
      toast.success('Relation created');
    } catch {
      toast.error('Failed to create relation');
    }
    setRelationLabel({ show: false, source: '', target: '' });
  };

  // Delete selected node handler
  const handleDeleteSelected = useCallback(() => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) return;
    const node = selected[0];

    let label = 'node';
    const type = node.type || '';
    const d = node.data as Record<string, unknown>;
    if (type === 'transcript') label = (d?.title as string) || 'transcript';
    else if (type === 'question') label = (d?.text as string) || 'question';
    else if (type === 'memo') label = (d?.title as string) || 'memo';
    else if (type === 'case') label = 'case';
    else if (type === 'group') label = (d?.title as string) || 'group';
    else label = type + ' node';

    setDeleteConfirm({ nodeId: node.id, label, type });
  }, [nodes]);

  const confirmDeleteNode = async () => {
    if (!deleteConfirm) return;
    const { nodeId } = deleteConfirm;
    try {
      if (nodeId.startsWith('transcript-')) await deleteTranscript(nodeId.replace('transcript-', ''));
      else if (nodeId.startsWith('question-')) await deleteQuestion(nodeId.replace('question-', ''));
      else if (nodeId.startsWith('memo-')) await deleteMemo(nodeId.replace('memo-', ''));
      else if (nodeId.startsWith('case-')) await deleteCase(nodeId.replace('case-', ''));
      else if (nodeId.startsWith('computed-')) await deleteComputedNode(nodeId.replace('computed-', ''));
      else if (nodeId.startsWith('group-')) {
        removeGroup(nodeId.replace('group-', ''));
        setNodes(nds => nds.filter(n => n.id !== nodeId));
      }
      toast.success('Node deleted');
      setTimeout(() => pushHistorySnapshot(), 300);
    } catch {
      toast.error('Failed to delete node');
    }
    setDeleteConfirm(null);
  };

  // Delete multiple selected nodes
  const handleDeleteAllSelected = useCallback(async () => {
    for (const node of selectedNodes) {
      try {
        if (node.id.startsWith('transcript-')) await deleteTranscript(node.id.replace('transcript-', ''));
        else if (node.id.startsWith('question-')) await deleteQuestion(node.id.replace('question-', ''));
        else if (node.id.startsWith('memo-')) await deleteMemo(node.id.replace('memo-', ''));
        else if (node.id.startsWith('case-')) await deleteCase(node.id.replace('case-', ''));
        else if (node.id.startsWith('computed-')) await deleteComputedNode(node.id.replace('computed-', ''));
        else if (node.id.startsWith('group-')) removeGroup(node.id.replace('group-', ''));
      } catch { /* continue */ }
    }
    toast.success(`Deleted ${selectedNodes.length} nodes`);
    setTimeout(() => pushHistorySnapshot(), 300);
  }, [selectedNodes, deleteTranscript, deleteQuestion, deleteMemo, deleteCase, deleteComputedNode, removeGroup, pushHistorySnapshot]);

  // Copy selected nodes
  const handleCopy = useCallback(() => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) return;
    clipboardRef.current = selected;
    toast.success(`Copied ${selected.length} node(s)`);
  }, [nodes]);

  // Paste nodes
  const handlePaste = useCallback(async () => {
    const toPaste = clipboardRef.current;
    if (toPaste.length === 0) return;
    let pasted = 0;
    for (const node of toPaste) {
      try {
        const d = node.data as Record<string, unknown>;
        if (node.type === 'transcript') {
          await addTranscript(d.title + ' (copy)', d.content as string);
          pasted++;
        } else if (node.type === 'question') {
          await addQuestion(d.text + ' (copy)', d.color as string);
          pasted++;
        } else if (node.type === 'memo') {
          await addMemo(d.content as string, d.title ? (d.title as string) + ' (copy)' : undefined, d.color as string);
          pasted++;
        } else if (d.computedNodeId) {
          const cn = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === d.computedNodeId);
          if (cn) {
            await addComputedNode(cn.nodeType as ComputedNodeType, cn.label + ' (copy)', cn.config as Record<string, unknown>);
            pasted++;
          }
        }
      } catch { /* skip */ }
    }
    if (pasted > 0) {
      toast.success(`Pasted ${pasted} node(s)`);
      setTimeout(() => pushHistorySnapshot(), 300);
    }
  }, [activeCanvas, addTranscript, addQuestion, addMemo, addComputedNode, pushHistorySnapshot]);

  // Duplicate (copy + paste)
  const handleDuplicate = useCallback(async () => {
    handleCopy();
    await handlePaste();
  }, [handleCopy, handlePaste]);

  // Alt+Drag to duplicate: when user starts dragging with Alt held, duplicate selected nodes
  const altDragDuplicatedRef = useRef(false);
  const handleNodeDragStart = useCallback((_event: React.MouseEvent, _node: Node) => {
    if (_event.altKey && !altDragDuplicatedRef.current) {
      altDragDuplicatedRef.current = true;
      handleDuplicate();
    }
  }, [handleDuplicate]);

  const handleNodeDragStop = useCallback(() => {
    altDragDuplicatedRef.current = false;
  }, []);

  // Select all
  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map(n => ({ ...n, selected: true })));
  }, [setNodes]);

  // Selection change tracking
  const handleSelectionChange = useCallback(({ nodes: selNodes }: OnSelectionChangeParams) => {
    setSelectedNodes(selNodes);
  }, []);

  // Selection toolbar position
  const selectionToolbarPos = useMemo(() => {
    if (selectedNodes.length < 2 || !rfInstanceRef.current) return { x: 0, y: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity;
    for (const n of selectedNodes) {
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.y < minY) minY = n.position.y;
      if (n.position.x > maxX) maxX = n.position.x;
    }
    const centerX = (minX + maxX) / 2;
    // Convert flow coordinates to screen coordinates
    const viewport = rfInstanceRef.current.getViewport();
    return {
      x: centerX * viewport.zoom + viewport.x,
      y: minY * viewport.zoom + viewport.y,
    };
  }, [selectedNodes]);

  // Alignment functions
  const handleAlignLeft = useCallback(() => {
    if (selectedNodes.length < 2) return;
    const minX = Math.min(...selectedNodes.map(n => n.position.x));
    setNodes(nds => nds.map(n => selectedNodes.some(s => s.id === n.id) ? { ...n, position: { ...n.position, x: minX } } : n));
    triggerSaveLayout();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- triggerSaveLayout is defined below but stable; adding it causes TDZ error
  }, [selectedNodes, setNodes]);

  const handleAlignTop = useCallback(() => {
    if (selectedNodes.length < 2) return;
    const minY = Math.min(...selectedNodes.map(n => n.position.y));
    setNodes(nds => nds.map(n => selectedNodes.some(s => s.id === n.id) ? { ...n, position: { ...n.position, y: minY } } : n));
    triggerSaveLayout();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- triggerSaveLayout is defined below but stable; adding it causes TDZ error
  }, [selectedNodes, setNodes]);

  const handleDistributeH = useCallback(() => {
    if (selectedNodes.length < 3) return;
    const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const minX = sorted[0].position.x;
    const maxX = sorted[sorted.length - 1].position.x;
    const gap = (maxX - minX) / (sorted.length - 1);
    const idToX = new Map(sorted.map((n, i) => [n.id, minX + i * gap]));
    setNodes(nds => nds.map(n => idToX.has(n.id) ? { ...n, position: { ...n.position, x: idToX.get(n.id)! } } : n));
    triggerSaveLayout();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- triggerSaveLayout is defined below but stable; adding it causes TDZ error
  }, [selectedNodes, setNodes]);

  const handleDistributeV = useCallback(() => {
    if (selectedNodes.length < 3) return;
    const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
    const minY = sorted[0].position.y;
    const maxY = sorted[sorted.length - 1].position.y;
    const gap = (maxY - minY) / (sorted.length - 1);
    const idToY = new Map(sorted.map((n, i) => [n.id, minY + i * gap]));
    setNodes(nds => nds.map(n => idToY.has(n.id) ? { ...n, position: { ...n.position, y: idToY.get(n.id)! } } : n));
    triggerSaveLayout();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- triggerSaveLayout is defined below but stable; adding it causes TDZ error
  }, [selectedNodes, setNodes]);

  // Trigger layout save helper
  const triggerSaveLayout = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setNodes((currentNodes: Node[]) => {
        const positions = currentNodes.map((n: Node) => ({
          id: '',
          canvasId: '',
          nodeId: n.id,
          nodeType: n.type || 'unknown',
          x: n.position.x,
          y: n.position.y,
          width: (n.style?.width as number) || (n.measured?.width) || undefined,
          height: (n.style?.height as number) || (n.measured?.height) || undefined,
        }));
        saveLayout(positions);
        return currentNodes;
      });
    }, 300);
  }, [saveLayout, setNodes]);

  // Debounced layout save on node position/dimension change
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // Check if any drag ended (save position) — ignore dimension changes from zoom/re-measurement
      const hasDrag = changes.some(
        (c: NodeChange) => c.type === 'position' && 'dragging' in c && c.dragging === false,
      );
      // Only save on user-initiated node resize (resizing flag), not zoom-triggered re-measurement
      const hasUserResize = changes.some(
        (c: NodeChange) => c.type === 'dimensions' && 'resizing' in c && (c as unknown as { resizing: boolean }).resizing === false,
      );
      if (hasDrag || hasUserResize) {
        triggerSaveLayout();
        // Capture layout state for undo after ReactFlow applies the changes
        requestAnimationFrame(() => pushHistorySnapshot());
      }
    },
    [onNodesChange, triggerSaveLayout, pushHistorySnapshot],
  );

  // Minimap color
  const minimapColor = useCallback((node: Node) => {
    switch (node.type) {
      case 'transcript': return '#3B82F6';
      case 'question': return '#8B5CF6';
      case 'memo': return '#F59E0B';
      case 'case': return '#14B8A6';
      case 'search': return '#059669';
      case 'cooccurrence': return '#7C3AED';
      case 'matrix': return '#D97706';
      case 'stats': return '#3B82F6';
      case 'comparison': return '#EC4899';
      case 'wordcloud': return '#6366F1';
      case 'cluster': return '#14B8A6';
      case 'codingquery': return '#DC2626';
      case 'sentiment': return '#F59E0B';
      case 'treemap': return '#8B5CF6';
      case 'group': return '#94A3B8';
      case 'sticky': return '#FBBF24';
      default: return '#6B7280';
    }
  }, []);

  // Context menu handlers
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ show: true, x: event.clientX, y: event.clientY });
  }, []);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setNodeContextMenu({
      show: true,
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
      nodeType: node.type || '',
      collapsed: Boolean((node.data as Record<string, unknown>)?.collapsed),
    });
  }, []);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    const edgeData = edge.data as Record<string, unknown> | undefined;
    setEdgeContextMenu({
      show: true,
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
      edgeType: edge.type || 'coding',
      label: edge.type === 'coding' ? (edgeData?.codedText as string | undefined) : (edgeData?.label as string | undefined),
    });
  }, []);

  const lastPaneClickRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    if (contextMenu) setContextMenu(null);
    if (nodeContextMenu) setNodeContextMenu(null);
    if (edgeContextMenu) setEdgeContextMenu(null);
    if (quickAddMenu) setQuickAddMenu(null);

    // Detect double-click via timestamp (React Flow doesn't propagate dblclick)
    const now = Date.now();
    const last = lastPaneClickRef.current;
    const dx = Math.abs(event.clientX - last.x);
    const dy = Math.abs(event.clientY - last.y);
    if (now - last.time < 400 && dx < 10 && dy < 10) {
      setQuickAddMenu({ x: event.clientX, y: event.clientY });
      lastPaneClickRef.current = { time: 0, x: 0, y: 0 };
      return;
    }
    lastPaneClickRef.current = { time: now, x: event.clientX, y: event.clientY };
  }, [contextMenu, nodeContextMenu, edgeContextMenu, quickAddMenu]);

  // Node counts for status bar
  const nodeCounts = useMemo(() => {
    if (!activeCanvas) return { transcripts: 0, questions: 0, codings: 0, memos: 0, relations: 0, coveragePct: 0 };

    // Calculate overall coding coverage
    let totalChars = 0;
    const codedChars = new Set<string>();
    activeCanvas.transcripts.forEach((t: CanvasTranscript) => {
      totalChars += t.content.length;
      const tCodings = activeCanvas.codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
      tCodings.forEach((c: CanvasTextCoding) => {
        for (let i = c.startOffset; i < Math.min(c.endOffset, t.content.length); i++) {
          codedChars.add(`${t.id}-${i}`);
        }
      });
    });
    const coveragePct = totalChars > 0 ? Math.round((codedChars.size / totalChars) * 100) : 0;

    return {
      transcripts: activeCanvas.transcripts.length,
      questions: activeCanvas.questions.length,
      codings: activeCanvas.codings.length,
      memos: activeCanvas.memos.length,
      relations: (activeCanvas.relations ?? []).length,
      coveragePct,
    };
  }, [activeCanvas]);

  // Context menu add actions
  const handleContextAddMemo = async () => {
    try {
      await addMemo('New memo — click to edit');
      toast.success('Memo added');
      setTimeout(() => pushHistorySnapshot(), 300);
    } catch {
      toast.error('Failed to add memo');
    }
  };

  // Node context menu handlers
  const handleNodeDuplicate = useCallback(async () => {
    if (!nodeContextMenu) return;
    const node = nodes.find(n => n.id === nodeContextMenu.nodeId);
    if (!node) return;
    const d = node.data as Record<string, unknown>;
    try {
      if (node.type === 'transcript') await addTranscript(d.title + ' (copy)', d.content as string);
      else if (node.type === 'question') await addQuestion(d.text + ' (copy)', d.color as string);
      else if (node.type === 'memo') await addMemo(d.content as string, d.title ? d.title + ' (copy)' : undefined, d.color as string);
      toast.success('Node duplicated');
    } catch { toast.error('Failed to duplicate'); }
  }, [nodeContextMenu, nodes, addTranscript, addQuestion, addMemo]);

  const handleNodeDelete = useCallback(() => {
    if (!nodeContextMenu) return;
    const node = nodes.find(n => n.id === nodeContextMenu.nodeId);
    if (!node) return;
    let label = 'node';
    const type = node.type || '';
    const d = node.data as Record<string, unknown>;
    if (type === 'transcript') label = (d?.title as string) || 'transcript';
    else if (type === 'question') label = (d?.text as string) || 'question';
    else if (type === 'memo') label = (d?.title as string) || 'memo';
    else if (type === 'case') label = 'case';
    else label = type + ' node';
    setDeleteConfirm({ nodeId: node.id, label, type });
  }, [nodeContextMenu, nodes]);

  const handleNodeToggleCollapse = useCallback(() => {
    if (!nodeContextMenu) return;
    setNodes(nds => nds.map(n => n.id === nodeContextMenu.nodeId ? { ...n, data: { ...n.data, collapsed: !nodeContextMenu.collapsed } } : n));
  }, [nodeContextMenu, setNodes]);

  const handleNodeResetSize = useCallback(() => {
    if (!nodeContextMenu) return;
    setNodes(nds => nds.map(n => {
      if (n.id === nodeContextMenu.nodeId) {
        const { width: _width, height: _height, ...restStyle } = (n.style || {}) as Record<string, unknown>;
        return { ...n, style: restStyle };
      }
      return n;
    }));
    triggerSaveLayout();
  }, [nodeContextMenu, setNodes, triggerSaveLayout]);

  // Edge context menu delete handler
  const handleEdgeDelete = useCallback(async () => {
    if (!edgeContextMenu) return;
    try {
      if (edgeContextMenu.edgeType === 'coding') {
        const codingId = edgeContextMenu.edgeId.replace('coding-', '');
        await deleteCoding(codingId);
      } else if (edgeContextMenu.edgeType === 'relation') {
        const relId = edgeContextMenu.edgeId.replace('relation-', '');
        await deleteRelation(relId);
      }
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  }, [edgeContextMenu, deleteCoding, deleteRelation]);

  // Collapse all / Expand all for selection
  const handleCollapseAll = useCallback(() => {
    setNodes(nds => nds.map(n => selectedNodes.some(s => s.id === n.id) ? { ...n, data: { ...n.data, collapsed: true } } : n));
  }, [selectedNodes, setNodes]);

  const handleExpandAll = useCallback(() => {
    setNodes(nds => nds.map(n => selectedNodes.some(s => s.id === n.id) ? { ...n, data: { ...n.data, collapsed: false } } : n));
  }, [selectedNodes, setNodes]);

  // Quick-add menu handlers
  const handleQuickAddTranscript = useCallback(async () => {
    toast('Use the Transcript button in the toolbar to add transcripts', { icon: '\u2139\uFE0F' });
  }, []);

  const handleQuickAddQuestion = useCallback(async () => {
    try {
      await addQuestion('New question — double-click to edit');
      toast.success('Question added');
      setTimeout(() => pushHistorySnapshot(), 300);
    } catch { toast.error('Failed to add question'); }
  }, [addQuestion, pushHistorySnapshot]);

  const handleQuickAddMemo = useCallback(async () => {
    try {
      await addMemo('New memo — click to edit');
      toast.success('Memo added');
      setTimeout(() => pushHistorySnapshot(), 300);
    } catch { toast.error('Failed to add memo'); }
  }, [addMemo, pushHistorySnapshot]);

  const handleQuickAddComputed = useCallback(async (type: ComputedNodeType, label: string) => {
    try {
      await addComputedNode(type, label);
      toast.success(`${label} node added`);
      setTimeout(() => pushHistorySnapshot(), 300);
    } catch { toast.error('Failed to add node'); }
  }, [addComputedNode, pushHistorySnapshot]);

  // Create visual group from selected nodes (Ctrl+G)
  const handleCreateGroup = useCallback(() => {
    if (selectedNodes.length < 2) {
      toast('Select 2+ nodes to create a group', { icon: '\u2139\uFE0F' });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of selectedNodes) {
      const w = (node.style?.width as number) || (node.measured?.width) || 300;
      const h = (node.style?.height as number) || (node.measured?.height) || 200;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }
    const pad = 40;
    const gx = minX - pad;
    const gy = minY - pad - 36;
    const gw = maxX - minX + pad * 2;
    const gh = maxY - minY + pad * 2 + 36;
    const groupId = addGroup('Group', '#3B82F6', gx, gy, gw, gh);
    if (!groupId) return;
    triggerSaveLayout();
    toast.success('Group created — double-click title to rename');
  }, [selectedNodes, addGroup, triggerSaveLayout]);

  // Auto-layout handler
  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) {
      toast('No nodes to arrange', { icon: '\u2139\uFE0F' });
      return;
    }
    applyLayout(nodes, edges, { direction: 'LR', nodeSpacing: 60, rankSpacing: 120 });
    // Save layout after animation and fit view
    setTimeout(() => {
      triggerSaveLayout();
      pushHistorySnapshot();
      rfInstanceRef.current?.fitView({ padding: 0.4, maxZoom: 1.0, duration: 300 });
    }, 700);
    toast.success('Canvas arranged');
  }, [nodes, edges, applyLayout, triggerSaveLayout, pushHistorySnapshot]);

  // Mute/unmute selected nodes (Ctrl+M)
  const handleToggleMute = useCallback(() => {
    const selectedIds = nodes.filter(n => n.selected).map(n => n.id);
    if (selectedIds.length === 0) return;
    setMutedNodeIds(prev => {
      const next = new Set(prev);
      const allMuted = selectedIds.every(id => next.has(id));
      selectedIds.forEach(id => allMuted ? next.delete(id) : next.add(id));
      return next;
    });
    const selectedCount = nodes.filter(n => n.selected).length;
    const allCurrentlyMuted = nodes.filter(n => n.selected).every(n => mutedNodeIds.has(n.id));
    toast.success(allCurrentlyMuted
      ? (selectedCount === 1 ? 'Node unmuted' : `${selectedCount} nodes unmuted`)
      : (selectedCount === 1 ? 'Node muted' : `${selectedCount} nodes muted`)
    );
  }, [nodes, mutedNodeIds]);

  // Export canvas as PNG
  const handleExportPNG = useCallback(async () => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) return;
    try {
      toast.loading('Exporting...', { id: 'export' });
      const { toPng } = await import('html-to-image');
      const { embedCanvasInPNG } = await import('../../utils/pngMetadata');
      let dataUrl = await toPng(viewport, {
        backgroundColor: '#ffffff',
        style: { transform: '' },
        width: viewport.scrollWidth || 2000,
        height: viewport.scrollHeight || 1500,
      });
      // Embed canvas data in PNG metadata
      if (activeCanvas) {
        try {
          dataUrl = await embedCanvasInPNG(dataUrl, activeCanvas);
        } catch {
          // Non-critical — export without metadata
        }
      }
      const link = document.createElement('a');
      link.download = `${activeCanvas?.name || 'canvas'}-export.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Canvas exported as PNG (with embedded data)', { id: 'export' });
    } catch {
      toast.error('Export failed — try zooming to fit first', { id: 'export' });
    }
  }, [activeCanvas]);

  // Quick add sticky note handler
  const handleQuickAddStickyNote = useCallback(() => {
    const viewport = rfInstanceRef.current?.getViewport();
    const x = viewport ? (-viewport.x + 400) / viewport.zoom : 600;
    const y = viewport ? (-viewport.y + 300) / viewport.zoom : 300;
    addStickyNote(x, y);
    toast.success('Sticky note added');
  }, [addStickyNote]);

  // Undo handler: restore previous layout state
  const handleUndo = useCallback(() => {
    const state = historyUndo();
    if (!state) return;
    // Merge restored positions/styles onto current nodes (preserving data)
    const posMap = new Map(state.nodes.map(n => [n.id, n]));
    setNodes(currentNodes => {
      // Keep nodes that exist in the restored state, with their current data
      const restoredIds = new Set(state.nodes.map(n => n.id));
      const result = currentNodes
        .filter(n => restoredIds.has(n.id))
        .map(n => {
          const restored = posMap.get(n.id);
          if (!restored) return n;
          return { ...n, position: restored.position, style: restored.style };
        });
      // Add nodes from restored state that aren't in current (were deleted)
      for (const rn of state.nodes) {
        if (!currentNodes.find(n => n.id === rn.id)) {
          result.push(rn);
        }
      }
      return result;
    });
    setEdges(() => {
      // For edges, use the restored edge set entirely (edges carry less heavy data)
      return state.edges;
    });
  }, [historyUndo, setNodes, setEdges]);

  // Redo handler: restore next layout state
  const handleRedo = useCallback(() => {
    const state = historyRedo();
    if (!state) return;
    const posMap = new Map(state.nodes.map(n => [n.id, n]));
    setNodes(currentNodes => {
      const restoredIds = new Set(state.nodes.map(n => n.id));
      const result = currentNodes
        .filter(n => restoredIds.has(n.id))
        .map(n => {
          const restored = posMap.get(n.id);
          if (!restored) return n;
          return { ...n, position: restored.position, style: restored.style };
        });
      for (const rn of state.nodes) {
        if (!currentNodes.find(n => n.id === rn.id)) {
          result.push(rn);
        }
      }
      return result;
    });
    setEdges(() => state.edges);
  }, [historyRedo, setNodes, setEdges]);

  // Global keyboard shortcuts (extracted to custom hook)
  useCanvasKeyboard({
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
    onUndo: handleUndo,
    onRedo: handleRedo,
    canUndo,
    canRedo,
    onToggleMute: handleToggleMute,
  });

  const handleFocusNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && rfInstanceRef.current) {
      rfInstanceRef.current.setCenter(
        node.position.x + 150,
        node.position.y + 100,
        { zoom: 0.8, duration: 500 }
      );
      // Select the node
      setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })));
    }
  }, [nodes, setNodes]);

  // ── Drag-and-drop file import handlers ──
  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer.files);

    // Check for PNG with embedded canvas data
    const pngFiles = files.filter(f => f.name.endsWith('.png'));
    if (pngFiles.length > 0) {
      try {
        const { extractCanvasFromPNG } = await import('../../utils/pngMetadata');
        for (const png of pngFiles) {
          const canvasData = await extractCanvasFromPNG(png);
          if (canvasData) {
            toast.success(`Found embedded canvas data in ${png.name}`);
            // Canvas data detected — could be used for import in future
          }
        }
      } catch {
        // Non-critical
      }
    }

    // Check for JSON canvas exports
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));
    for (const jf of jsonFiles) {
      try {
        const text = await jf.text();
        const data = JSON.parse(text);
        if (data && data.transcripts && Array.isArray(data.transcripts)) {
          let imported = 0;
          for (const t of data.transcripts) {
            if (t.title && t.content) {
              await addTranscript(t.title, t.content);
              imported++;
            }
          }
          if (imported > 0) {
            await refreshCanvas();
            toast.success(`Imported ${imported} transcript${imported > 1 ? 's' : ''} from ${jf.name}`);
          }
        }
      } catch {
        toast.error(`Failed to parse ${jf.name}`);
      }
    }

    const validFiles = files.filter(f =>
      f.name.endsWith('.txt') || f.name.endsWith('.csv') || f.name.endsWith('.md')
    );

    if (validFiles.length === 0 && jsonFiles.length === 0 && pngFiles.length === 0) {
      toast.error('Drop .txt, .csv, .md, .json, or .png files to import');
      return;
    }

    if (validFiles.length === 0) return;

    let imported = 0;
    for (const file of validFiles) {
      try {
        const text = await file.text();
        if (file.name.endsWith('.csv')) {
          // Parse CSV: each row becomes a transcript
          const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
          for (const line of lines) {
            const fields: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              if (inQuotes) {
                if (ch === '"') {
                  if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
                  else inQuotes = false;
                } else current += ch;
              } else {
                if (ch === '"') inQuotes = true;
                else if (ch === ',') { fields.push(current.trim()); current = ''; }
                else current += ch;
              }
            }
            fields.push(current.trim());
            const title = fields[0] || `Row ${imported + 1}`;
            const content = fields.length >= 2 ? fields[1] : fields[0] || '';
            if (content) {
              await addTranscript(title, content);
              imported++;
            }
          }
        } else {
          // Plain text / markdown file
          const title = file.name.replace(/\.(txt|md)$/, '');
          await addTranscript(title, text);
          imported++;
        }
      } catch {
        toast.error(`Failed to import ${file.name}`);
      }
    }

    if (imported > 0) {
      await refreshCanvas();
      toast.success(`Imported ${imported} transcript${imported > 1 ? 's' : ''}`);
    }
  }, [addTranscript, refreshCanvas]);

  return (
    <div ref={workspaceRef} className="flex h-full">
      {/* Code Navigator Sidebar — animated collapse */}
      {!focusMode && (
        <div className={`transition-all duration-200 overflow-hidden ${showNavigator ? 'w-60' : 'w-0'}`}>
          <ErrorBoundary>
            <CodeNavigator onFocusNode={handleFocusNode} />
          </ErrorBoundary>
        </div>
      )}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Multi-canvas tabs */}
        {openTabs.length > 1 && !focusMode && (
          <CanvasTabBar
            tabs={openTabs.map(id => {
              const canvas = canvases.find(c => c.id === id);
              return {
                id,
                name: canvas?.name || (activeCanvas?.id === id ? (activeCanvas?.name || 'Canvas') : 'Canvas'),
                description: canvas?.description,
                transcriptCount: canvas?._count?.transcripts ?? 0,
                codeCount: canvas?._count?.questions ?? 0,
                codingCount: canvas?._count?.codings ?? 0,
              };
            })}
            activeTabId={activeCanvas?.id || null}
            onSwitchTab={async (canvasId) => {
              // Save current viewport
              if (activeCanvas?.id) {
                const vp = rfInstanceRef.current?.getViewport();
                if (vp) viewportCacheRef.current.set(activeCanvas.id, vp);
              }
              await openCanvas(canvasId);
              // Restore viewport after switch
              setTimeout(() => {
                const cached = viewportCacheRef.current.get(canvasId);
                if (cached) rfInstanceRef.current?.setViewport(cached, { duration: 200 });
              }, 300);
            }}
            onCloseTab={(canvasId) => {
              setOpenTabs(prev => {
                const next = prev.filter(id => id !== canvasId);
                try { localStorage.setItem('canvas-open-tabs', JSON.stringify(next)); } catch {}
                if (canvasId === activeCanvas?.id && next.length > 0) {
                  openCanvas(next[next.length - 1]);
                } else if (next.length === 0) {
                  closeCanvas();
                }
                return next;
              });
              viewportCacheRef.current.delete(canvasId);
            }}
            onNewTab={() => closeCanvas()}
          />
        )}
        {!focusMode && (
          <CanvasToolbar
            showNavigator={showNavigator}
            onToggleNavigator={() => { manualNavToggleRef.current = true; setShowNavigator(s => !s); }}
            onOpenCommandPalette={() => setShowCommandPalette(true)}
            onAutoLayout={handleAutoLayout}
            onExportPNG={handleExportPNG}
            onToggleFocusMode={() => setFocusMode(true)}
            onTogglePresentationMode={() => setPresentationMode(true)}
            onAiAutoCode={() => requireAiConfig('AI Auto-Code', () => setShowAiAutoCode(true))}
            requireAiConfig={requireAiConfig}
          />
        )}
        <div className="flex flex-1 min-h-0">
        <div
          ref={canvasContainerRef}
          data-tour="canvas-flow-area"
          className="relative flex-1"
          onDragEnter={handleFileDragEnter}
          onDragLeave={handleFileDragLeave}
          onDragOver={handleFileDragOver}
          onDrop={handleFileDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onInit={(instance) => { rfInstanceRef.current = instance; }}
            onMoveEnd={(_event, viewport) => {
              const pct = Math.round(viewport.zoom * 100);
              setZoomLevel(pct);
              const newTier = pct >= 35 ? 'full' : pct >= 18 ? 'reduced' : 'minimal';
              setZoomTier(newTier);
            }}
            onPaneContextMenu={handlePaneContextMenu}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneClick={handlePaneClick}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            snapToGrid={snapToGrid}
            snapGrid={SNAP_GRID}
            edgesReconnectable
            zoomOnScroll={scrollMode === 'zoom'}
            panOnScroll={scrollMode === 'pan'}
            zoomOnDoubleClick
            panActivationKeyCode="Space"
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            minZoom={0.15}
            maxZoom={2}
            className="bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900"
            onlyRenderVisibleElements
            proOptions={PRO_OPTIONS}
          >
            <Background
              variant={snapToGrid ? BackgroundVariant.Lines : BackgroundVariant.Dots}
              gap={snapToGrid ? 20 : 24}
              size={snapToGrid ? 0.5 : 0.8}
              color={snapToGrid ? '#d1d5db60' : '#d1d5db40'}
            />
            {!focusMode && <Controls fitViewOptions={FIT_VIEW_OPTIONS} className="!bg-white/90 !backdrop-blur-sm !shadow-node !rounded-xl dark:!bg-gray-800/90 !border-gray-200 dark:!border-gray-700" />}
            {!focusMode && <MiniMap
              nodeColor={minimapColor}
              maskColor="rgba(0,0,0,0.06)"
              className="!bg-white/90 !backdrop-blur-sm !rounded-xl !shadow-node dark:!bg-gray-800/90 !border-gray-200 dark:!border-gray-700"
            />}
            {collaboration.isConnected && <CollabCursors cursors={collaboration.cursors} />}
          </ReactFlow>

          {/* Focus mode exit button */}
          {focusMode && (
            <div className="absolute top-4 right-4 z-50 animate-fade-in">
              <button
                onClick={() => setFocusMode(false)}
                className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-500 shadow-lg ring-1 ring-black/5 backdrop-blur-md hover:bg-white hover:text-gray-700 dark:bg-gray-800/90 dark:text-gray-400 dark:ring-white/10 dark:hover:bg-gray-800 transition-all"
                title="Exit focus mode (Ctrl+. or Esc)"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
                </svg>
                Exit Focus
              </button>
            </div>
          )}

          {/* Drag-and-drop file overlay */}
          {isDraggingFile && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-brand-500/10 backdrop-blur-[2px] border-2 border-dashed border-brand-400 rounded-xl pointer-events-none animate-fade-in">
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/90 dark:bg-gray-800/90 px-8 py-6 shadow-xl">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-900/30">
                  <svg className="h-7 w-7 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Drop files to import</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">.txt, .csv, .md, .json, or .png files</p>
                </div>
              </div>
            </div>
          )}

          {/* Selection toolbar */}
          {selectedNodes.length >= 2 && (
            <SelectionToolbar
              selectedNodes={selectedNodes}
              position={selectionToolbarPos}
              onDeleteAll={handleDeleteAllSelected}
              onCollapseAll={handleCollapseAll}
              onExpandAll={handleExpandAll}
              onAlignLeft={handleAlignLeft}
              onAlignTop={handleAlignTop}
              onDistributeH={handleDistributeH}
              onDistributeV={handleDistributeV}
              onAnalyzeSelection={(transcriptIds, questionIds) => {
                toast.success(`Analyzing ${transcriptIds.length} transcripts, ${questionIds.length} codes`);
              }}
            />
          )}

          {/* Canvas-wide search overlay */}
          {showSearch && (
            <CanvasSearchOverlay
              onClose={() => setShowSearch(false)}
              onResults={setHighlightedNodeIds}
            />
          )}

          {/* Pane context menu */}
          {contextMenu?.show && (
            <CanvasContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onAddTranscript={() => {
                toast('Use the Transcript button in the toolbar to add transcripts', { icon: '\u2139\uFE0F' });
              }}
              onAddQuestion={() => {
                toast('Use the Question button in the toolbar to add questions', { icon: '\u2139\uFE0F' });
              }}
              onAddMemo={handleContextAddMemo}
              onAddComputedNode={handleQuickAddComputed}
              onFitView={() => rfInstanceRef.current?.fitView(FIT_VIEW_OPTIONS)}
              onShowShortcuts={() => setShowShortcuts(true)}
              onSelectAll={handleSelectAll}
              onToggleSnapGrid={() => setSnapToGrid(s => !s)}
              snapToGrid={snapToGrid}
              onAutoLayout={handleAutoLayout}
              onClose={() => setContextMenu(null)}
            />
          )}

          {/* Node context menu */}
          {nodeContextMenu?.show && (
            <NodeContextMenu
              x={nodeContextMenu.x}
              y={nodeContextMenu.y}
              nodeId={nodeContextMenu.nodeId}
              nodeType={nodeContextMenu.nodeType}
              collapsed={nodeContextMenu.collapsed}
              onDuplicate={handleNodeDuplicate}
              onDelete={handleNodeDelete}
              onToggleCollapse={handleNodeToggleCollapse}
              onResetSize={handleNodeResetSize}
              onSetNodeColor={setNodeColor}
              onClose={() => setNodeContextMenu(null)}
            />
          )}

          {/* Edge context menu */}
          {edgeContextMenu?.show && (
            <EdgeContextMenu
              x={edgeContextMenu.x}
              y={edgeContextMenu.y}
              edgeId={edgeContextMenu.edgeId}
              edgeType={edgeContextMenu.edgeType}
              label={edgeContextMenu.label}
              onDelete={handleEdgeDelete}
              onAddWaypoint={(edgeId, x, y) => {
                const viewport = rfInstanceRef.current?.getViewport();
                if (viewport) {
                  const canvasX = (x - viewport.x) / viewport.zoom;
                  const canvasY = (y - viewport.y) / viewport.zoom;
                  addReroute(canvasX, canvasY, edgeId);
                }
              }}
              onClose={() => setEdgeContextMenu(null)}
            />
          )}

          {/* Quick-add menu (double-click) */}
          {quickAddMenu && (
            <QuickAddMenu
              x={quickAddMenu.x}
              y={quickAddMenu.y}
              onAddTranscript={handleQuickAddTranscript}
              onAddQuestion={handleQuickAddQuestion}
              onAddMemo={handleQuickAddMemo}
              onAddComputedNode={handleQuickAddComputed}
              onAddStickyNote={() => {
                const viewport = rfInstanceRef.current?.getViewport();
                if (viewport) {
                  const x = (quickAddMenu.x - viewport.x) / viewport.zoom;
                  const y = (quickAddMenu.y - viewport.y) / viewport.zoom;
                  addStickyNote(x, y);
                } else {
                  addStickyNote(quickAddMenu.x, quickAddMenu.y);
                }
              }}
              onClose={() => { setQuickAddMenu(null); setSmartLinkSource(null); smartLinkAllowedRef.current = null; }}
              allowedItems={smartLinkAllowedRef.current || undefined}
            />
          )}

          {/* Empty state overlay */}
          {activeCanvas && activeCanvas.transcripts.length === 0 && activeCanvas.questions.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center animate-fade-in">
              <div className="max-w-lg text-center px-8">
                {/* Icon */}
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-blue-50 dark:from-brand-900/20 dark:to-blue-900/20 gentle-pulse">
                  <svg className="h-10 w-10 text-brand-400 dark:text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>

                {/* Heading */}
                <h3 className="text-xl font-semibold text-gray-400 dark:text-gray-500">
                  Your workspace is ready
                </h3>
                <p className="mt-2 text-sm text-gray-300 dark:text-gray-600 max-w-sm mx-auto leading-relaxed">
                  Start by adding your interview transcripts, then create research questions to begin coding.
                </p>

                {/* Steps */}
                <div className="mt-8 grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20">
                      <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Step 1</p>
                      <p className="text-[11px] text-gray-300 dark:text-gray-600">Add transcripts</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/20">
                      <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Step 2</p>
                      <p className="text-[11px] text-gray-300 dark:text-gray-600">Create questions</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Step 3</p>
                      <p className="text-[11px] text-gray-300 dark:text-gray-600">Select text & code</p>
                    </div>
                  </div>
                </div>

                {/* Hint */}
                <p className="mt-6 text-[11px] text-gray-300 dark:text-gray-600">
                  Drop .txt/.csv files to import &middot; Double-click canvas to quick-add &middot; Press <kbd className="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 font-mono text-[10px]">Ctrl+K</kbd> for commands
                </p>
              </div>
            </div>
          )}

          {/* Relation label prompt */}
          {relationLabel.show && (
            <div className="modal-backdrop absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <RelationLabelPrompt
                onSubmit={handleCreateRelation}
                onCancel={() => setRelationLabel({ show: false, source: '', target: '' })}
              />
            </div>
          )}

          {/* Merge questions confirm */}
          {mergeConfirm.show && (
            <div className="modal-backdrop absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <div className="modal-content rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 w-80">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Merge Codes</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Merge <strong>"{mergeConfirm.sourceName}"</strong> into <strong>"{mergeConfirm.targetName}"</strong>?
                  All codings from the source will move to the target. The source code will be deleted.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleMerge} className="btn-primary h-8 px-3 text-xs">Merge</button>
                  <button
                    onClick={() => {
                      setMergeConfirm({ show: false, sourceId: '', targetId: '', sourceName: '', targetName: '' });
                      setRelationLabel({ show: true, source: `question-${mergeConfirm.sourceId}`, target: `question-${mergeConfirm.targetId}` });
                    }}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-750"
                  >
                    Create Relation Instead
                  </button>
                  <button
                    onClick={() => setMergeConfirm({ show: false, sourceId: '', targetId: '', sourceName: '', targetName: '' })}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        {!focusMode && <div data-tour="canvas-status-bar" className="flex items-center justify-between border-t border-gray-200/80 bg-white/90 px-4 py-1.5 text-[10px] text-gray-400 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/90 dark:text-gray-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              {nodeCounts.transcripts}
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
              {nodeCounts.questions}
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {nodeCounts.codings}
            </span>
            {/* Coverage bar */}
            {nodeCounts.transcripts > 0 && (
              <span className="flex items-center gap-1.5">
                <div className="h-1 w-16 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${nodeCounts.coveragePct}%`,
                      backgroundColor: nodeCounts.coveragePct < 30 ? '#f59e0b' : nodeCounts.coveragePct < 70 ? '#3b82f6' : '#10b981',
                    }}
                  />
                </div>
                <span className="tabular-nums">{nodeCounts.coveragePct}% coded</span>
              </span>
            )}
            {selectedNodes.length > 0 && (
              <span className="text-blue-500 font-medium">{selectedNodes.length} selected</span>
            )}
            {/* Edge type legend */}
            {(nodeCounts.codings > 0 || nodeCounts.relations > 0) && (
              <div className="flex items-center gap-2.5 ml-1 border-l border-gray-200/60 dark:border-gray-700/60 pl-2.5">
                {nodeCounts.codings > 0 && (
                  <span className="flex items-center gap-1">
                    <svg width="16" height="6" className="shrink-0"><line x1="0" y1="3" x2="16" y2="3" stroke="#3B82F6" strokeWidth="1.5" /></svg>
                    <span>Coding</span>
                  </span>
                )}
                {nodeCounts.relations > 0 && (
                  <span className="flex items-center gap-1">
                    <svg width="16" height="6" className="shrink-0"><line x1="0" y1="3" x2="16" y2="3" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
                    <span>Relation</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Bookmark slot indicators */}
            <div className="flex items-center gap-0.5" title="Viewport bookmarks (Ctrl+Shift+1-5 save, Alt+1-5 recall)">
              {bookmarks.map((b, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${b ? 'bg-blue-400 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                  title={b ? `Bookmark ${i + 1} saved` : `Bookmark ${i + 1} empty`}
                />
              ))}
            </div>
            {snapToGrid && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                GRID
              </span>
            )}
            <span>{savingLayout ? 'Saving...' : 'Saved'}</span>
            {collaboration.isConnected && collaboration.collaborators.length > 0 && (
              <PresenceAvatars collaborators={collaboration.collaborators} isConnected={collaboration.isConnected} />
            )}
            <button
              onClick={() => setScrollMode(scrollMode === 'zoom' ? 'pan' : 'zoom')}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-300 transition-colors"
              title={`Scroll mode: ${scrollMode === 'zoom' ? 'Zoom' : 'Pan'} (click to toggle)`}
            >
              {scrollMode === 'zoom' ? 'Scroll: Zoom' : 'Scroll: Pan'}
            </button>
            <span className="tabular-nums">{zoomLevel}%</span>
          </div>
        </div>}
      </div>
      {/* Detail panel — inside flex row with canvas, below toolbar */}
      {selectedQuestionId && <ErrorBoundary><CodingDetailPanel /></ErrorBoundary>}
      </div>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* Command palette (Ctrl+K) */}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onFocusNode={handleFocusNode}
          onFitView={() => rfInstanceRef.current?.fitView(FIT_VIEW_OPTIONS)}
          onToggleGrid={() => setSnapToGrid(s => !s)}
          onToggleNavigator={() => { manualNavToggleRef.current = true; setShowNavigator(s => !s); }}
          onShowShortcuts={() => { setShowCommandPalette(false); setShowShortcuts(true); }}
          onAddComputedNode={handleQuickAddComputed}
          onAutoLayout={handleAutoLayout}
          onToggleFocusMode={() => setFocusMode(f => !f)}
          onExportPNG={handleExportPNG}
          onAddStickyNote={handleQuickAddStickyNote}
          onShowExcerpts={() => { setShowCommandPalette(false); setShowExcerpts(true); }}
          onShowRichExport={() => { setShowCommandPalette(false); setShowRichExport(true); }}
          onShowIntercoder={() => { setShowCommandPalette(false); setShowIntercoder(true); }}
          onShowWeighting={() => { setShowCommandPalette(false); setShowWeighting(true); }}
          onShowCrossCase={() => { setShowCommandPalette(false); setShowCrossCase(true); }}
        />
      )}

      {/* Excerpt Browser */}
      {showExcerpts && <ExcerptBrowserModal onClose={() => setShowExcerpts(false)} />}

      {/* Rich Export */}
      {showRichExport && <RichExportModal onClose={() => setShowRichExport(false)} />}

      {/* Intercoder Reliability (code-vs-code) */}
      {showIntercoder && <IntercoderReliabilityModal onClose={() => setShowIntercoder(false)} />}

      {/* Intercoder Reliability (user-vs-user) */}
      {showIntercoderPanel && <IntercoderPanel onClose={() => setShowIntercoderPanel(false)} />}

      {/* Code Weighting */}
      {showWeighting && <CodeWeightingPanel onClose={() => setShowWeighting(false)} />}

      {/* Cross-Case Analysis */}
      {showCrossCase && <CrossCaseAnalysisModal onClose={() => setShowCrossCase(false)} />}

      {/* Presentation mode */}
      {presentationMode && <PresentationMode onExit={() => setPresentationMode(false)} />}

      {/* AI Suggestion Panel */}
      {(aiSuggestions.suggestions.length > 0 || aiSuggestions.loading) && (
        <AiSuggestPanel
          suggestions={aiSuggestions.suggestions}
          loading={aiSuggestions.loading}
          onAccept={aiSuggestions.acceptSuggestion}
          onReject={aiSuggestions.rejectSuggestion}
          onBulkAccept={(ids) => aiSuggestions.bulkAction(ids, 'accepted')}
          onBulkReject={(ids) => aiSuggestions.bulkAction(ids, 'rejected')}
          onClose={aiSuggestions.clearSuggestions}
        />
      )}

      {/* AI Auto-Code Modal */}
      {showAiAutoCode && (
        <AiAutoCodeModal
          loading={aiSuggestions.loading}
          onSubmit={(transcriptId, instructions) => {
            aiSuggestions.autoCodeTranscript(transcriptId, instructions);
            setShowAiAutoCode(false);
          }}
          onClose={() => setShowAiAutoCode(false)}
        />
      )}

      {/* AI Setup Guide */}
      {showAiSetupGuide && (
        <AiSetupGuide
          trigger={showAiSetupGuide}
          onClose={() => setShowAiSetupGuide(null)}
        />
      )}

      {/* Onboarding tour for first-time users */}
      <OnboardingTour />

      {/* Delete node confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          title={`Delete ${deleteConfirm.type}`}
          message={`Delete "${deleteConfirm.label}"? This cannot be undone.`}
          onConfirm={confirmDeleteNode}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Session timeout warning */}
      {showSessionWarning && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="modal-content rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 w-96" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Session Expiring</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">You have been inactive for 30 minutes</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              Your session will be automatically logged out in 5 minutes for security. Click below to continue working.
            </p>
            <button onClick={dismissSessionWarning} className="btn-primary w-full text-sm">
              Continue Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Semantic relationship presets organized by category (ATLAS.ti-inspired)
const RELATION_PRESETS: { category: string; color: string; relations: string[] }[] = [
  { category: 'Causal', color: '#EF4444', relations: ['causes', 'leads to', 'results in', 'triggers'] },
  { category: 'Logical', color: '#3B82F6', relations: ['supports', 'contradicts', 'explains', 'justifies'] },
  { category: 'Structural', color: '#8B5CF6', relations: ['is part of', 'contains', 'is type of', 'is property of'] },
  { category: 'Associative', color: '#10B981', relations: ['is associated with', 'co-occurs with', 'is similar to', 'contrasts with'] },
  { category: 'Temporal', color: '#F59E0B', relations: ['precedes', 'follows', 'co-occurs during', 'evolves into'] },
];

// Small inline component for the relation label prompt
function RelationLabelPrompt({
  onSubmit,
  onCancel,
}: {
  onSubmit: (label: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');

  return (
    <div className="modal-content rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 w-80">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Semantic Relationship</h4>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">Choose or type a relationship label between these nodes</p>
      <div className="space-y-2 mb-3 max-h-[240px] overflow-y-auto">
        {RELATION_PRESETS.map(group => (
          <div key={group.category}>
            <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: group.color }}>{group.category}</p>
            <div className="flex flex-wrap gap-1">
              {group.relations.map(r => (
                <button
                  key={r}
                  onClick={() => onSubmit(r)}
                  className="rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:shadow-sm"
                  style={{
                    borderColor: group.color + '40',
                    color: group.color,
                    backgroundColor: group.color + '08',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = group.color + '18'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = group.color + '08'; }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="input h-8 flex-1 text-xs"
          placeholder="Custom label..."
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && label.trim()) onSubmit(label.trim()); }}
          autoFocus
        />
        <button onClick={() => label.trim() && onSubmit(label.trim())} disabled={!label.trim()} className="btn-primary h-8 px-3 text-xs disabled:opacity-50">
          Add
        </button>
      </div>
      <button onClick={onCancel} className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Cancel</button>
    </div>
  );
}
