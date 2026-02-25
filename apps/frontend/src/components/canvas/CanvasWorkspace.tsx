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
import CodingEdge from './edges/CodingEdge';
import RelationEdge from './edges/RelationEdge';
import CodeNavigator from './panels/CodeNavigator';
import CanvasToolbar from './panels/CanvasToolbar';
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
import ConfirmDialog from './ConfirmDialog';
import { ErrorBoundary } from '../ErrorBoundary';
import { useCanvasStore } from '../../stores/canvasStore';
import { useCanvasHistory } from '../../hooks/useCanvasHistory';
import { useCanvasKeyboard } from '../../hooks/useCanvasKeyboard';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
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
} from '@canvas-app/shared';
import toast from 'react-hot-toast';

// Wrap a node component with error boundary so computed node errors
// don't crash the entire canvas
function withErrorBoundary(NodeComponent: React.ComponentType<any>) {
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
};

const edgeTypes = {
  coding: CodingEdge,
  relation: RelationEdge,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export default function CanvasWorkspace() {
  const {
    activeCanvas,
    pendingSelection,
    setPendingSelection,
    createCoding,
    saveLayout,
    savingLayout,
    selectedQuestionId,
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

  const { showWarning: showSessionWarning, dismissWarning: dismissSessionWarning } = useSessionTimeout();

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
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ show: boolean; x: number; y: number; nodeId: string; nodeType: string; collapsed: boolean } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ show: boolean; x: number; y: number; edgeId: string; edgeType: string; label?: string } | null>(null);
  const [quickAddMenu, setQuickAddMenu] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;
  const [deleteConfirm, setDeleteConfirm] = useState<{ nodeId: string; label: string; type: string } | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);

  // Snap to grid
  const [snapToGrid, setSnapToGrid] = useState(false);

  // Drag-and-drop file import
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // Clipboard for copy/paste
  const clipboardRef = useRef<Node[]>([]);

  // Undo/Redo
  const { pushAction, undo, redo, canUndo, canRedo } = useCanvasHistory();

  // Build position map with dimensions and collapsed state
  const posMap = useMemo(() => {
    if (!activeCanvas) return new Map<string, CanvasNodePosition>();
    const map = new Map<string, CanvasNodePosition>();
    activeCanvas.nodePositions.forEach((p: CanvasNodePosition) => map.set(p.nodeId, p));
    return map;
  }, [activeCanvas?.nodePositions]);

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
      if (posData?.height) style.height = posData.height;
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
          zoomLevelRef,
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
      if (posData?.height) style.height = posData.height;
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
          zoomLevelRef,
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
      if (posData?.height) style.height = posData.height;
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
          zoomLevelRef,
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
      if (posData?.height) style.height = posData.height;
      result.push({
        id: nodeId,
        type: 'case',
        position: pos,
        dragHandle: '.drag-handle',
        style,
        data: {
          caseId: c.id,
          collapsed: posData?.collapsed ?? false,
          zoomLevelRef,
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
          zoomLevelRef,
        },
      });
    });

    return result;
  }, [activeCanvas, highlightedNodeIds, posMap]);

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

  // Sync when canvas data changes
  useEffect(() => {
    setNodes(buildNodes());
    setEdges(buildEdges());
    // Fit view after nodes render with their actual dimensions
    if (fitViewTimeoutRef.current) clearTimeout(fitViewTimeoutRef.current);
    fitViewTimeoutRef.current = setTimeout(() => {
      rfInstanceRef.current?.fitView({ padding: 0.4, maxZoom: 0.8 });
    }, 200);
  }, [activeCanvas, buildNodes, buildEdges, setNodes, setEdges]);

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
    [pendingSelection, createCoding, setPendingSelection, activeCanvas?.questions, mergeQuestions],
  );

  // Edge reconnection handler
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: any) => {
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
    let type = node.type || '';
    if (type === 'transcript') label = (node.data as any)?.title || 'transcript';
    else if (type === 'question') label = (node.data as any)?.text || 'question';
    else if (type === 'memo') label = (node.data as any)?.title || 'memo';
    else if (type === 'case') label = 'case';
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
      toast.success('Node deleted');
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
      } catch { /* continue */ }
    }
    toast.success(`Deleted ${selectedNodes.length} nodes`);
  }, [selectedNodes, deleteTranscript, deleteQuestion, deleteMemo, deleteCase, deleteComputedNode]);

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
        const d = node.data as any;
        if (node.type === 'transcript') {
          await addTranscript(d.title + ' (copy)', d.content);
          pasted++;
        } else if (node.type === 'question') {
          await addQuestion(d.text + ' (copy)', d.color);
          pasted++;
        } else if (node.type === 'memo') {
          await addMemo(d.content, d.title ? d.title + ' (copy)' : undefined, d.color);
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
    if (pasted > 0) toast.success(`Pasted ${pasted} node(s)`);
  }, [activeCanvas, addTranscript, addQuestion, addMemo, addComputedNode]);

  // Duplicate (copy + paste)
  const handleDuplicate = useCallback(async () => {
    handleCopy();
    await handlePaste();
  }, [handleCopy, handlePaste]);

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
  }, [selectedNodes, setNodes]);

  const handleAlignTop = useCallback(() => {
    if (selectedNodes.length < 2) return;
    const minY = Math.min(...selectedNodes.map(n => n.position.y));
    setNodes(nds => nds.map(n => selectedNodes.some(s => s.id === n.id) ? { ...n, position: { ...n.position, y: minY } } : n));
    triggerSaveLayout();
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
    undo,
    redo,
  });

  // Debounced layout save on node position/dimension change
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // Check if any drag ended or resize happened
      const hasDrag = changes.some(
        (c: NodeChange) => c.type === 'position' && 'dragging' in c && c.dragging === false,
      );
      const hasResize = changes.some(
        (c: NodeChange) => c.type === 'dimensions',
      );
      if (hasDrag || hasResize) {
        triggerSaveLayout();
      }
    },
    [onNodesChange, triggerSaveLayout],
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
      collapsed: (node.data as any)?.collapsed ?? false,
    });
  }, []);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setEdgeContextMenu({
      show: true,
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
      edgeType: edge.type || 'coding',
      label: edge.type === 'coding' ? (edge.data as any)?.codedText : (edge.data as any)?.label,
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
    if (!activeCanvas) return { transcripts: 0, questions: 0, codings: 0, memos: 0, coveragePct: 0 };

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
      coveragePct,
    };
  }, [activeCanvas]);

  // Context menu add actions
  const handleContextAddMemo = async () => {
    try {
      await addMemo('New memo — click to edit');
      toast.success('Memo added');
    } catch {
      toast.error('Failed to add memo');
    }
  };

  // Node context menu handlers
  const handleNodeDuplicate = useCallback(async () => {
    if (!nodeContextMenu) return;
    const node = nodes.find(n => n.id === nodeContextMenu.nodeId);
    if (!node) return;
    const d = node.data as any;
    try {
      if (node.type === 'transcript') await addTranscript(d.title + ' (copy)', d.content);
      else if (node.type === 'question') await addQuestion(d.text + ' (copy)', d.color);
      else if (node.type === 'memo') await addMemo(d.content, d.title ? d.title + ' (copy)' : undefined, d.color);
      toast.success('Node duplicated');
    } catch { toast.error('Failed to duplicate'); }
  }, [nodeContextMenu, nodes, addTranscript, addQuestion, addMemo]);

  const handleNodeDelete = useCallback(() => {
    if (!nodeContextMenu) return;
    const node = nodes.find(n => n.id === nodeContextMenu.nodeId);
    if (!node) return;
    let label = 'node';
    const type = node.type || '';
    if (type === 'transcript') label = (node.data as any)?.title || 'transcript';
    else if (type === 'question') label = (node.data as any)?.text || 'question';
    else if (type === 'memo') label = (node.data as any)?.title || 'memo';
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
        const { width, height, ...restStyle } = (n.style || {}) as Record<string, unknown>;
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
    } catch { toast.error('Failed to add question'); }
  }, [addQuestion]);

  const handleQuickAddMemo = useCallback(async () => {
    try {
      await addMemo('New memo — click to edit');
      toast.success('Memo added');
    } catch { toast.error('Failed to add memo'); }
  }, [addMemo]);

  const handleQuickAddComputed = useCallback(async (type: ComputedNodeType, label: string) => {
    try {
      await addComputedNode(type, label);
      toast.success(`${label} node added`);
    } catch { toast.error('Failed to add node'); }
  }, [addComputedNode]);

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
    const validFiles = files.filter(f =>
      f.name.endsWith('.txt') || f.name.endsWith('.csv') || f.name.endsWith('.md')
    );

    if (validFiles.length === 0) {
      toast.error('Drop .txt, .csv, or .md files to import transcripts');
      return;
    }

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
    <div className="flex h-full">
      {/* Code Navigator Sidebar */}
      {showNavigator && (
        <CodeNavigator onFocusNode={handleFocusNode} />
      )}
      <div className="flex flex-1 flex-col min-w-0">
        <CanvasToolbar
          showNavigator={showNavigator}
          onToggleNavigator={() => setShowNavigator(s => !s)}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
        />
        <div
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
            onInit={(instance) => { rfInstanceRef.current = instance; }}
            onMoveEnd={(_event, viewport) => setZoomLevel(Math.round(viewport.zoom * 100))}
            onPaneContextMenu={handlePaneContextMenu}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneClick={handlePaneClick}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            snapToGrid={snapToGrid}
            snapGrid={[20, 20]}
            edgesReconnectable
            panActivationKeyCode="Space"
            fitView
            fitViewOptions={{ padding: 0.4, maxZoom: 0.8 }}
            minZoom={0.15}
            className="bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900"
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={snapToGrid ? BackgroundVariant.Lines : BackgroundVariant.Dots}
              gap={snapToGrid ? 20 : 24}
              size={snapToGrid ? 0.5 : 0.8}
              color={snapToGrid ? '#d1d5db60' : '#d1d5db40'}
            />
            <Controls fitViewOptions={{ padding: 0.4, maxZoom: 0.8 }} className="!bg-white/90 !backdrop-blur-sm !shadow-node !rounded-xl dark:!bg-gray-800/90 !border-gray-200 dark:!border-gray-700" />
            <MiniMap
              nodeColor={minimapColor}
              maskColor="rgba(0,0,0,0.06)"
              className="!bg-white/90 !backdrop-blur-sm !rounded-xl !shadow-node dark:!bg-gray-800/90 !border-gray-200 dark:!border-gray-700"
            />
          </ReactFlow>

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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">.txt, .csv, or .md files</p>
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
              onFitView={() => rfInstanceRef.current?.fitView({ padding: 0.4, maxZoom: 0.8 })}
              onShowShortcuts={() => setShowShortcuts(true)}
              onSelectAll={handleSelectAll}
              onToggleSnapGrid={() => setSnapToGrid(s => !s)}
              snapToGrid={snapToGrid}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
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
              onClose={() => setQuickAddMenu(null)}
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
        <div data-tour="canvas-status-bar" className="flex items-center justify-between border-t border-gray-200/80 bg-white/90 px-4 py-1.5 text-[10px] text-gray-400 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/90 dark:text-gray-500">
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
          </div>
          <div className="flex items-center gap-3">
            {/* Undo/Redo buttons */}
            <button
              onClick={undo}
              disabled={!canUndo}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 dark:hover:text-gray-300"
              title="Undo (Ctrl+Z)"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 dark:hover:text-gray-300"
              title="Redo (Ctrl+Shift+Z)"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
              </svg>
            </button>
            {snapToGrid && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                GRID
              </span>
            )}
            <span>{savingLayout ? 'Saving...' : 'Saved'}</span>
            <span className="tabular-nums">{zoomLevel}%</span>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedQuestionId && <CodingDetailPanel />}

      {/* Keyboard shortcuts modal */}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* Command palette (Ctrl+K) */}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onFocusNode={handleFocusNode}
          onFitView={() => rfInstanceRef.current?.fitView({ padding: 0.4, maxZoom: 0.8 })}
          onToggleGrid={() => setSnapToGrid(s => !s)}
          onToggleNavigator={() => setShowNavigator(s => !s)}
          onShowShortcuts={() => { setShowCommandPalette(false); setShowShortcuts(true); }}
          onAddComputedNode={handleQuickAddComputed}
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

// Small inline component for the relation label prompt
function RelationLabelPrompt({
  onSubmit,
  onCancel,
}: {
  onSubmit: (label: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const presets = ['influences', 'contradicts', 'supports', 'causes', 'is-part-of'];

  return (
    <div className="modal-content rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 w-72">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Relationship Label</h4>
      <div className="flex flex-wrap gap-1 mb-2">
        {presets.map(p => (
          <button
            key={p}
            onClick={() => onSubmit(p)}
            className="btn-canvas rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {p}
          </button>
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
      <button onClick={onCancel} className="mt-2 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
    </div>
  );
}
