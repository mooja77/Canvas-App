import { useCallback, useRef, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvasStore';
import QuickCodePopover from '../panels/QuickCodePopover';
import CodingStripesOverlay from '../panels/CodingStripesOverlay';
import CodingDensityBar from '../CodingDensityBar';
import TranscriptContextMenu from '../TranscriptContextMenu';
import ConfirmDialog from '../ConfirmDialog';
import type { CanvasTextCoding, CanvasQuestion, CanvasCase } from '@canvas-app/shared';
import toast from 'react-hot-toast';

export interface TranscriptNodeData {
  transcriptId: string;
  title: string;
  content: string;
  caseId?: string | null;
  collapsed?: boolean;
  zoomLevel?: number;
  [key: string]: unknown;
}

// Compute overlapping highlight segments from codings
function computeOverlappingSegments(
  text: string,
  codings: CanvasTextCoding[],
  colorMap: Map<string, string>,
) {
  if (codings.length === 0) return [{ start: 0, end: text.length, questionColors: [] as string[] }];

  // Collect all boundary points
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);
  for (const c of codings) {
    const start = Math.max(0, Math.min(c.startOffset, text.length));
    const end = Math.max(0, Math.min(c.endOffset, text.length));
    boundaries.add(start);
    boundaries.add(end);
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const segments: { start: number; end: number; questionColors: string[] }[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start >= end) continue;

    // Find which codings cover this segment
    const colors: string[] = [];
    for (const c of codings) {
      const cStart = Math.max(0, Math.min(c.startOffset, text.length));
      const cEnd = Math.max(0, Math.min(c.endOffset, text.length));
      if (cStart <= start && cEnd >= end) {
        const color = colorMap.get(c.questionId) || '#3B82F6';
        if (!colors.includes(color)) colors.push(color);
      }
    }

    segments.push({ start, end, questionColors: colors });
  }

  return segments;
}

function HighlightedTranscript({
  text,
  codings,
  questions,
}: {
  text: string;
  codings: CanvasTextCoding[];
  questions: { id: string; color: string }[];
}) {
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    questions.forEach(q => map.set(q.id, q.color));
    return map;
  }, [questions]);

  const segments = useMemo(
    () => computeOverlappingSegments(text, codings, colorMap),
    [text, codings, colorMap],
  );

  return (
    <>
      {segments.map((seg, i) => {
        const slice = text.slice(seg.start, seg.end);
        if (seg.questionColors.length === 0) {
          return <span key={i}>{slice}</span>;
        }

        // Layer multiple background colors with reduced opacity
        const layerCount = seg.questionColors.length;
        const opacity = Math.max(0.12, 0.3 / layerCount);

        return (
          <span
            key={i}
            className="rounded-sm relative"
            title={`Coded by ${layerCount} question${layerCount > 1 ? 's' : ''}`}
          >
            {/* Background layers */}
            {seg.questionColors.map((color, ci) => (
              <span
                key={ci}
                className="absolute inset-0 rounded-sm"
                style={{
                  backgroundColor: color,
                  opacity: opacity,
                  zIndex: ci,
                }}
              />
            ))}
            <span className="relative" style={{ zIndex: layerCount }}>
              {slice}
            </span>
          </span>
        );
      })}
    </>
  );
}

export default function TranscriptNode({ data, id, selected }: NodeProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const { activeCanvas, pendingSelection, setPendingSelection, deleteTranscript, showCodingStripes, codeInVivo, spreadToParagraph } = useCanvasStore();
  const nodeData = data as unknown as TranscriptNodeData;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [quickCodePopover, setQuickCodePopover] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState(nodeData.collapsed ?? false);

  const zoomLevel = (nodeData.zoomLevel ?? 100);
  const isZoomedOut = zoomLevel < 30;

  const codings = useMemo(
    () => (activeCanvas?.codings ?? []).filter((c: CanvasTextCoding) => c.transcriptId === nodeData.transcriptId),
    [activeCanvas?.codings, nodeData.transcriptId],
  );

  const questions = useMemo(
    () => (activeCanvas?.questions ?? []).map((q: CanvasQuestion) => ({ id: q.id, color: q.color })),
    [activeCanvas?.questions],
  );

  const transcript = useMemo(
    () => activeCanvas?.transcripts.find(t => t.id === nodeData.transcriptId),
    [activeCanvas?.transcripts, nodeData.transcriptId],
  );

  const caseName = useMemo(() => {
    const caseId = transcript?.caseId;
    if (!caseId) return null;
    return activeCanvas?.cases?.find((c: CanvasCase) => c.id === caseId)?.name;
  }, [transcript?.caseId, activeCanvas?.cases]);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !textRef.current) {
      return;
    }

    const selText = sel.toString().trim();
    if (!selText) return;

    // Walk the DOM to find the actual character offset within the text container
    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(textRef.current!);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startIdx = preRange.toString().length;
    const endIdx = startIdx + selText.length;

    setPendingSelection({
      transcriptId: nodeData.transcriptId,
      startOffset: startIdx,
      endOffset: endIdx,
      codedText: selText,
    });

    // Show Quick Code Popover at the selection position
    const rect = range.getBoundingClientRect();
    setQuickCodePopover({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, [nodeData.transcriptId, setPendingSelection]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!pendingSelection || pendingSelection.transcriptId !== nodeData.transcriptId) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setQuickCodePopover(null);
  }, [pendingSelection, nodeData.transcriptId]);

  const handleCodeInVivo = useCallback(async () => {
    if (!pendingSelection || pendingSelection.transcriptId !== nodeData.transcriptId) return;
    try {
      await codeInVivo(pendingSelection.transcriptId, pendingSelection.startOffset, pendingSelection.endOffset, pendingSelection.codedText);
      window.getSelection()?.removeAllRanges();
      toast.success('In-vivo code created');
    } catch {
      toast.error('Failed to create in-vivo code');
    }
    setContextMenu(null);
  }, [pendingSelection, nodeData.transcriptId, codeInVivo]);

  const handleSpreadToParagraph = useCallback(async () => {
    if (!pendingSelection || pendingSelection.transcriptId !== nodeData.transcriptId) return;
    try {
      await spreadToParagraph(pendingSelection.transcriptId, pendingSelection.startOffset, pendingSelection.endOffset, pendingSelection.codedText);
      window.getSelection()?.removeAllRanges();
      toast.success('Spread to paragraph — new code created');
    } catch {
      toast.error('Failed to spread to paragraph');
    }
    setContextMenu(null);
  }, [pendingSelection, nodeData.transcriptId, spreadToParagraph]);

  const hasSelection = pendingSelection?.transcriptId === nodeData.transcriptId;

  return (
    <div className={`min-w-[280px] w-full h-full rounded-xl border border-blue-200/60 bg-white shadow-node transition-all duration-200 hover:shadow-node-hover dark:border-blue-800/60 dark:bg-gray-800 ${selected ? 'ring-2 ring-blue-400' : ''}`}>
      <NodeResizer
        minWidth={280}
        minHeight={collapsed ? 44 : 100}
        lineClassName="!border-blue-400/50"
        handleClassName="!w-2 !h-2 !bg-blue-400 !border-blue-500"
        isVisible={selected}
      />

      {/* Drag handle header */}
      <div className="drag-handle flex items-center justify-between rounded-t-xl bg-gradient-to-r from-blue-50 to-blue-50/60 px-3 py-2.5 cursor-grab active:cursor-grabbing dark:from-blue-900/30 dark:to-blue-900/15">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate">{nodeData.title}</span>
          {caseName && (
            <span className="shrink-0 rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-medium text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
              {caseName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="rounded p-0.5 text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded p-0.5 text-blue-400 hover:bg-blue-100 hover:text-red-600 dark:hover:bg-blue-800 dark:hover:text-red-400"
            title="Delete transcript"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body - collapsible */}
      {!collapsed && !isZoomedOut && (
        <>
          {/* Scrollable text body with optional coding stripes + density bar */}
          <div className="relative">
            {showCodingStripes && codings.length > 0 && (
              <CodingStripesOverlay
                contentLength={nodeData.content.length}
                codings={codings}
                questions={questions}
                containerHeight={300}
              />
            )}
            {codings.length > 0 && (
              <CodingDensityBar
                contentLength={nodeData.content.length}
                codings={codings}
                questions={questions}
                height={300}
              />
            )}
            <div
              ref={textRef}
              className="nodrag nowheel max-h-[300px] overflow-y-auto px-3 py-2"
              style={{ paddingLeft: codings.length > 0 ? (showCodingStripes ? `${([...new Set(codings.map(c => c.questionId))].length * 6) + 20}px` : '20px') : undefined }}
              onMouseUp={handleMouseUp}
              onContextMenu={handleContextMenu}
            >
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-gray-300 select-text">
                <HighlightedTranscript text={nodeData.content} codings={codings} questions={questions} />
              </p>
            </div>
          </div>

          {/* Coding count footer */}
          {codings.length > 0 && (
            <div className="border-t border-blue-100 px-3 py-1.5 dark:border-blue-800">
              <span className="text-[10px] text-blue-500 dark:text-blue-400">
                {codings.length} coded segment{codings.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </>
      )}

      {/* Zoomed out simplified view */}
      {!collapsed && isZoomedOut && (
        <div className="px-3 py-2 text-[10px] text-gray-400">{codings.length} codings</div>
      )}

      {/* Source handle — visible when there's a pending selection */}
      <Handle
        type="source"
        position={Position.Right}
        id={`transcript-source-${id}`}
        className={`!h-4 !w-4 !border-2 !border-blue-500 transition-all duration-200 ${hasSelection ? '!bg-blue-500 opacity-100' : '!bg-blue-200 opacity-50'}`}
        style={{ top: '50%' }}
      />

      {/* Quick Code Popover — appears on text selection */}
      {quickCodePopover && hasSelection && pendingSelection && (
        <QuickCodePopover
          transcriptId={nodeData.transcriptId}
          startOffset={pendingSelection.startOffset}
          endOffset={pendingSelection.endOffset}
          codedText={pendingSelection.codedText}
          anchorRect={quickCodePopover}
          onClose={() => {
            setQuickCodePopover(null);
            // Don't clear pending selection — user might still want to use edge connection
          }}
        />
      )}

      {/* Right-click context menu — portal to body so CSS transforms don't break fixed positioning */}
      {contextMenu && hasSelection && createPortal(
        <TranscriptContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={hasSelection}
          onCodeInVivo={handleCodeInVivo}
          onSpreadToParagraph={handleSpreadToParagraph}
          onClose={() => setContextMenu(null)}
        />,
        document.body,
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && createPortal(
        <ConfirmDialog
          title="Delete Transcript"
          message="Delete this transcript and all its coded segments?"
          onConfirm={() => { setShowDeleteConfirm(false); deleteTranscript(nodeData.transcriptId); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />,
        document.body,
      )}
    </div>
  );
}
