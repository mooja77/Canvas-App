import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useCanvasStore, useActiveCanvas } from '../../../stores/canvasStore';
import type { CanvasTextCoding, CanvasQuestion, CodingCanvas } from '@qualcanvas/shared';
import { getCrossCanvasRef, setCrossCanvasRef, removeCrossCanvasRef } from '../../../lib/crossCanvasRefs';

// ─── Preset colors (same as ColorPicker) ───

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#78716C', '#6B7280',
];

// ─── Computed node types for refresh detection ───

const COMPUTED_NODE_TYPES = new Set([
  'search', 'cooccurrence', 'matrix', 'stats', 'comparison',
  'wordcloud', 'cluster', 'codingquery', 'sentiment', 'treemap',
]);

// ─── Interface ───

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  nodeType: string;
  collapsed: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
  onResetSize: () => void;
  onSetNodeColor?: (nodeId: string, color: string) => void;
  onClose: () => void;
}

// ─── Helpers ───

function extractEntityId(nodeId: string): string {
  // node IDs are formatted as "question-{id}", "transcript-{id}", "memo-{id}", etc.
  const dashIdx = nodeId.indexOf('-');
  return dashIdx >= 0 ? nodeId.slice(dashIdx + 1) : nodeId;
}

// ─── Component ───

export default function NodeContextMenu({
  x,
  y,
  nodeId,
  nodeType,
  collapsed,
  onDuplicate,
  onDelete,
  onToggleCollapse,
  onResetSize,
  onSetNodeColor,
  onClose,
}: NodeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);
  const [showCanvasLinker, setShowCanvasLinker] = useState(false);
  const [canvasSearch, setCanvasSearch] = useState('');

  const activeCanvas = useActiveCanvas();
  const canvases = useCanvasStore(s => s.canvases);
  const activeCanvasId = useCanvasStore(s => s.activeCanvasId);
  const fetchCanvases = useCanvasStore(s => s.fetchCanvases);
  const setSelectedQuestionId = useCanvasStore(s => s.setSelectedQuestionId);
  const updateQuestion = useCanvasStore(s => s.updateQuestion);
  const updateMemo = useCanvasStore(s => s.updateMemo);
  const addQuestion = useCanvasStore(s => s.addQuestion);
  const refreshCanvas = useCanvasStore(s => s.refreshCanvas);

  // Existing cross-canvas ref for this node
  const existingRef = useMemo(() => getCrossCanvasRef(nodeId), [nodeId]);

  const entityId = extractEntityId(nodeId);

  // ─── Close on outside click or Escape ───

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // ─── Current entity data ───

  const currentQuestion = useMemo(() => {
    if (nodeType !== 'question' || !activeCanvas) return null;
    return activeCanvas.questions.find((q: CanvasQuestion) => q.id === entityId) ?? null;
  }, [nodeType, entityId, activeCanvas]);

  const currentMemo = useMemo(() => {
    if (nodeType !== 'memo' || !activeCanvas) return null;
    return activeCanvas.memos.find(m => m.id === entityId) ?? null;
  }, [nodeType, entityId, activeCanvas]);

  // ─── Transcript coverage stats ───

  const coverageStats = useMemo(() => {
    if (nodeType !== 'transcript' || !activeCanvas) return null;
    const transcript = activeCanvas.transcripts.find(t => t.id === entityId);
    if (!transcript) return null;

    const codings = activeCanvas.codings.filter((c: CanvasTextCoding) => c.transcriptId === entityId);
    const wordCount = transcript.content.split(/\s+/).filter(Boolean).length;
    const totalChars = transcript.content.length;

    // Calculate coded characters using a merge-intervals approach
    const intervals = codings
      .map(c => [c.startOffset, c.endOffset] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    let codedChars = 0;
    let maxEnd = 0;
    for (const [start, end] of intervals) {
      const effectiveStart = Math.max(start, maxEnd);
      if (end > effectiveStart) {
        codedChars += end - effectiveStart;
      }
      maxEnd = Math.max(maxEnd, end);
    }

    const uniqueQuestionIds = new Set(codings.map(c => c.questionId));
    const coveragePct = totalChars > 0 ? (codedChars / totalChars) * 100 : 0;

    return {
      wordCount,
      codingCount: codings.length,
      uniqueCodeCount: uniqueQuestionIds.size,
      coveragePct: Math.round(coveragePct * 10) / 10,
    };
  }, [nodeType, entityId, activeCanvas]);

  // ─── Handlers ───

  const handleColorChange = async (color: string) => {
    try {
      if (nodeType === 'question') {
        await updateQuestion(entityId, { color });
        toast.success('Color updated');
      } else if (nodeType === 'memo') {
        await updateMemo(entityId, { color });
        toast.success('Color updated');
      } else if ((nodeType === 'transcript' || nodeType === 'case') && onSetNodeColor) {
        onSetNodeColor(nodeId, color);
        toast.success('Color updated');
      }
    } catch {
      toast.error('Failed to update color');
    }
    setShowColorPicker(false);
    onClose();
  };

  const handleRenameQuestion = () => {
    setSelectedQuestionId(entityId);
    onClose();
  };

  const handleAddSubCode = async () => {
    try {
      const name = window.prompt('Sub-code name:', '');
      if (name === null) { onClose(); return; }
      const newQ = await addQuestion(name.trim() || 'New sub-code');
      await updateQuestion(newQ.id, { parentQuestionId: entityId });
      toast.success('Sub-code created');
    } catch {
      toast.error('Failed to create sub-code');
    }
    onClose();
  };

  const handleViewCodings = () => {
    setSelectedQuestionId(entityId);
    onClose();
  };

  const handleRefresh = async () => {
    try {
      await refreshCanvas();
      toast.success('Canvas refreshed');
    } catch {
      toast.error('Refresh failed');
    }
    onClose();
  };

  const handleOpenCanvasLinker = useCallback(() => {
    setShowCanvasLinker(prev => !prev);
    // Ensure canvas list is loaded
    if (canvases.length === 0) fetchCanvases();
  }, [canvases.length, fetchCanvases]);

  const handleLinkCanvas = useCallback((canvas: CodingCanvas) => {
    setCrossCanvasRef(nodeId, { canvasId: canvas.id, canvasName: canvas.name });
    toast.success(`Linked to "${canvas.name}"`);
    setShowCanvasLinker(false);
    onClose();
  }, [nodeId, onClose]);

  const handleUnlinkCanvas = useCallback(() => {
    removeCrossCanvasRef(nodeId);
    toast.success('Cross-canvas link removed');
    setShowCanvasLinker(false);
    onClose();
  }, [nodeId, onClose]);

  const filteredCanvases = useMemo(() => {
    const others = canvases.filter(c => c.id !== activeCanvasId);
    if (!canvasSearch.trim()) return others;
    const q = canvasSearch.toLowerCase();
    return others.filter(c => c.name.toLowerCase().includes(q));
  }, [canvases, activeCanvasId, canvasSearch]);

  // ─── Styling constants ───

  const btnClass = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-750';
  const btnClassRed = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-750';
  const kbdClass = 'ml-auto text-[10px] text-gray-400 font-mono';
  const separator = <div className="my-1 border-t border-gray-200 dark:border-gray-700" />;

  // ─── Icon paths (heroicons outline 24x24) ───

  const icons = {
    color: 'M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z',
    rename: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10',
    addChild: 'M12 4.5v15m7.5-7.5h-15',
    viewCodings: 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    coverage: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
    refresh: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182',
    duplicate: 'M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75',
    collapse: 'M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25',
    expand: 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15',
    resetSize: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182',
    delete: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
    chevronDown: 'M19.5 8.25l-7.5 7.5-7.5-7.5',
    chevronUp: 'M4.5 15.75l7.5-7.5 7.5 7.5',
    link: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244',
    unlink: 'M6 18 18 6M6 6l12 12',
    arrowRight: 'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
  };

  const Icon = ({ d, className }: { d: string; className?: string }) => (
    <svg className={className || 'h-3.5 w-3.5'} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );

  // ─── Shared menu items (Duplicate, Collapse/Expand, Reset Size) ───

  const sharedItems = (
    <>
      <button onClick={() => { onDuplicate(); onClose(); }} className={btnClass}>
        <Icon d={icons.duplicate} />
        Duplicate
        <span className={kbdClass}>Ctrl+D</span>
      </button>
      <button onClick={() => { onToggleCollapse(); onClose(); }} className={btnClass}>
        <Icon d={collapsed ? icons.expand : icons.collapse} />
        {collapsed ? 'Expand' : 'Collapse'}
        <span className={kbdClass}>C</span>
      </button>
      <button onClick={() => { onResetSize(); onClose(); }} className={btnClass}>
        <Icon d={icons.resetSize} />
        Reset Size
      </button>
    </>
  );

  // ─── Delete item ───

  const deleteItem = (
    <button onClick={() => { onDelete(); onClose(); }} className={btnClassRed}>
      <Icon d={icons.delete} />
      Delete
      <span className={kbdClass}>Del</span>
    </button>
  );

  // ─── Inline color picker section ───

  const colorPickerSection = (
    <>
      <button
        onClick={() => setShowColorPicker(prev => !prev)}
        className={btnClass}
      >
        <Icon d={icons.color} />
        Change Color
        <span className="ml-auto flex items-center gap-1.5">
          {(currentQuestion?.color || currentMemo?.color) && (
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: currentQuestion?.color || currentMemo?.color }}
            />
          )}
          <Icon
            d={showColorPicker ? icons.chevronUp : icons.chevronDown}
            className="h-3 w-3 text-gray-400"
          />
        </span>
      </button>
      {showColorPicker && (
        <div className="mx-2 mb-1 rounded-lg border border-gray-100 bg-gray-50/80 p-2 dark:border-gray-700 dark:bg-gray-750/80">
          <div className="grid grid-cols-8 gap-1">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => handleColorChange(c)}
                className={`h-5 w-5 rounded-md transition-all duration-100 hover:scale-110 focus:outline-none ${
                  c === (currentQuestion?.color || currentMemo?.color)
                    ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500 dark:ring-offset-gray-800 scale-110'
                    : 'hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-600'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );

  // ─── Coverage tooltip section for transcripts ───

  const coverageSection = (
    <>
      <button
        onClick={() => setShowCoverage(prev => !prev)}
        className={btnClass}
      >
        <Icon d={icons.coverage} />
        View Coverage
        <span className="ml-auto">
          <Icon
            d={showCoverage ? icons.chevronUp : icons.chevronDown}
            className="h-3 w-3 text-gray-400"
          />
        </span>
      </button>
      {showCoverage && coverageStats && (
        <div className="mx-2 mb-1 rounded-lg border border-gray-100 bg-gray-50/80 p-2.5 dark:border-gray-700 dark:bg-gray-750/80">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">Words</span>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                {coverageStats.wordCount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">Codings</span>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                {coverageStats.codingCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">Codes</span>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                {coverageStats.uniqueCodeCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">Coverage</span>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                {coverageStats.coveragePct}%
              </span>
            </div>
          </div>
          {/* Mini coverage bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(coverageStats.coveragePct, 100)}%` }}
            />
          </div>
        </div>
      )}
    </>
  );

  // ─── Determine if this is a computed/analysis node ───

  const isComputedNode = COMPUTED_NODE_TYPES.has(nodeType);

  // ─── Render ───

  return createPortal(
    <div
      ref={ref}
      className="context-menu-enter fixed z-[9999] w-52 rounded-xl border border-gray-200/60 bg-white/95 py-1 shadow-lg backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
      style={{ left: x, top: y }}
    >
      {/* ─── Question-specific items ─── */}
      {nodeType === 'question' && (
        <>
          {colorPickerSection}
          <button onClick={handleRenameQuestion} className={btnClass}>
            <Icon d={icons.rename} />
            Rename
          </button>
          <button onClick={handleAddSubCode} className={btnClass}>
            <Icon d={icons.addChild} />
            Add Sub-Code
          </button>
          <button onClick={handleViewCodings} className={btnClass}>
            <Icon d={icons.viewCodings} />
            View Codings
          </button>
          {separator}
        </>
      )}

      {/* ─── Transcript-specific items ─── */}
      {nodeType === 'transcript' && (
        <>
          {onSetNodeColor && colorPickerSection}
          {coverageSection}
          {separator}
        </>
      )}

      {/* ─── Case-specific items ─── */}
      {nodeType === 'case' && onSetNodeColor && (
        <>
          {colorPickerSection}
          {separator}
        </>
      )}

      {/* ─── Memo-specific items ─── */}
      {nodeType === 'memo' && (
        <>
          {colorPickerSection}
          {separator}
        </>
      )}

      {/* ─── Computed/analysis node-specific items ─── */}
      {isComputedNode && (
        <>
          <button onClick={handleRefresh} className={btnClass}>
            <Icon d={icons.refresh} />
            Refresh
          </button>
          {separator}
        </>
      )}

      {/* ─── Cross-canvas link (all node types) ─── */}
      <button onClick={handleOpenCanvasLinker} className={btnClass}>
        <Icon d={icons.link} />
        {existingRef ? 'Change Canvas Link' : 'Link to Canvas'}
        <span className="ml-auto">
          <Icon
            d={showCanvasLinker ? icons.chevronUp : icons.chevronDown}
            className="h-3 w-3 text-gray-400"
          />
        </span>
      </button>
      {existingRef && (
        <div className="mx-2 mb-1 flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50/80 px-2 py-1.5 dark:border-blue-900 dark:bg-blue-950/50">
          <Icon d={icons.arrowRight} className="h-3 w-3 flex-shrink-0 text-blue-500" />
          <span className="flex-1 truncate text-[11px] font-medium text-blue-700 dark:text-blue-300">
            {existingRef.canvasName}
          </span>
          <button
            onClick={handleUnlinkCanvas}
            className="flex-shrink-0 rounded p-0.5 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            title="Remove link"
          >
            <Icon d={icons.unlink} className="h-3 w-3" />
          </button>
        </div>
      )}
      {showCanvasLinker && (
        <div className="mx-2 mb-1 rounded-lg border border-gray-100 bg-gray-50/80 p-2 dark:border-gray-700 dark:bg-gray-750/80">
          <input
            type="text"
            value={canvasSearch}
            onChange={e => setCanvasSearch(e.target.value)}
            placeholder="Search canvases..."
            className="mb-1.5 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 placeholder-gray-400 outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
            autoFocus
          />
          <div className="max-h-[120px] overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {filteredCanvases.length === 0 ? (
              <p className="py-2 text-center text-[10px] text-gray-400">No other canvases found</p>
            ) : (
              filteredCanvases.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleLinkCanvas(c)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] text-gray-700 hover:bg-blue-50 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  <Icon d={icons.arrowRight} className="h-3 w-3 flex-shrink-0 text-gray-400" />
                  <span className="truncate">{c.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {separator}

      {/* ─── Common items ─── */}
      {sharedItems}

      {separator}

      {/* ─── Delete ─── */}
      {deleteItem}
    </div>,
    document.body,
  );
}
