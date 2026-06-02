import { memo, useCallback, useRef, useMemo, useState, useEffect } from 'react';
import { useNodeCollapsed } from './useNodeCollapsed';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  useCanvasStore,
  useCanvasCodings,
  useCanvasQuestions,
  useCanvasTranscripts,
  useCanvasCases,
  usePendingSelection,
  useShowCodingStripes,
} from '../../../stores/canvasStore';
import { useUIStore } from '../../../stores/uiStore';
import QuickCodePopover from '../panels/QuickCodePopover';
import CodingSegmentPopover from '../panels/CodingSegmentPopover';
import CodingStripesOverlay from '../panels/CodingStripesOverlay';
import CodingDensityBar from '../CodingDensityBar';
import TranscriptContextMenu from '../TranscriptContextMenu';
import CrossCanvasRefBadge from '../CrossCanvasRefBadge';
import ConfirmDialog from '../ConfirmDialog';
import type { CanvasTextCoding, CanvasQuestion, CanvasCase } from '@qualcanvas/shared';
import toast from 'react-hot-toast';

export interface TranscriptNodeData {
  transcriptId: string;
  title: string;
  caseId?: string | null;
  collapsed?: boolean;
  zoomLevel?: number;
  zoomTier?: 'full' | 'reduced' | 'minimal';
  customColor?: string;
  onAiSuggest?: (
    transcriptId: string,
    codedText: string,
    startOffset: number,
    endOffset: number,
    anchor: { x: number; y: number },
  ) => void;
  [key: string]: unknown;
}

interface TranscriptSegment {
  start: number;
  end: number;
  questionColors: string[];
  codingIds: string[];
  /** True when this segment falls inside an active "verify in context" range. */
  inVerify: boolean;
}

// Compute overlapping highlight segments from codings, plus an optional
// transient "verify in context" range (from an AI suggestion's Locate action).
function computeOverlappingSegments(
  text: string,
  codings: CanvasTextCoding[],
  colorMap: Map<string, string>,
  verifyRange?: { start: number; end: number } | null,
): TranscriptSegment[] {
  const vStart = verifyRange ? Math.max(0, Math.min(verifyRange.start, text.length)) : -1;
  const vEnd = verifyRange ? Math.max(0, Math.min(verifyRange.end, text.length)) : -1;
  const hasVerify = vEnd > vStart;

  if (codings.length === 0 && !hasVerify)
    return [{ start: 0, end: text.length, questionColors: [], codingIds: [], inVerify: false }];

  // Collect all boundary points (coding edges + verify-range edges)
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);
  for (const c of codings) {
    boundaries.add(Math.max(0, Math.min(c.startOffset, text.length)));
    boundaries.add(Math.max(0, Math.min(c.endOffset, text.length)));
  }
  if (hasVerify) {
    boundaries.add(vStart);
    boundaries.add(vEnd);
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const segments: TranscriptSegment[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start >= end) continue;

    // Find which codings cover this segment
    const colors: string[] = [];
    const ids: string[] = [];
    for (const c of codings) {
      const cStart = Math.max(0, Math.min(c.startOffset, text.length));
      const cEnd = Math.max(0, Math.min(c.endOffset, text.length));
      if (cStart <= start && cEnd >= end) {
        const color = colorMap.get(c.questionId) || '#3B82F6';
        if (!colors.includes(color)) colors.push(color);
        ids.push(c.id);
      }
    }

    const inVerify = hasVerify && start >= vStart && end <= vEnd;
    segments.push({ start, end, questionColors: colors, codingIds: ids, inVerify });
  }

  return segments;
}

function HighlightedTranscript({
  text,
  codings,
  questions,
  onSegmentClick,
  verifyRange,
}: {
  text: string;
  codings: CanvasTextCoding[];
  questions: { id: string; color: string }[];
  onSegmentClick: (codingIds: string[], event: React.MouseEvent) => void;
  verifyRange?: { start: number; end: number } | null;
}) {
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    questions.forEach((q) => map.set(q.id, q.color));
    return map;
  }, [questions]);

  const segments = useMemo(
    () => computeOverlappingSegments(text, codings, colorMap, verifyRange),
    [text, codings, colorMap, verifyRange],
  );

  // Scroll the verified span into view when it appears/changes.
  const firstVerifyRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (verifyRange && firstVerifyRef.current) {
      firstVerifyRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [verifyRange]);

  let verifyAssigned = false;
  return (
    <>
      {segments.map((seg, i) => {
        const slice = text.slice(seg.start, seg.end);
        const isFirstVerify = seg.inVerify && !verifyAssigned;
        if (isFirstVerify) verifyAssigned = true;
        const verifyRef = isFirstVerify ? firstVerifyRef : undefined;
        if (seg.questionColors.length === 0) {
          return (
            <span key={i} ref={verifyRef} className={seg.inVerify ? 'qc-verify-highlight' : undefined}>
              {slice}
            </span>
          );
        }

        // Layer multiple background colors with reduced opacity
        const layerCount = seg.questionColors.length;
        const opacity = Math.max(0.12, 0.3 / layerCount);

        return (
          <span
            key={i}
            ref={verifyRef}
            className={`rounded-sm relative cursor-pointer coded-segment-hover${seg.inVerify ? ' qc-verify-highlight' : ''}`}
            title={`${layerCount} code${layerCount > 1 ? 's' : ''} - click to view`}
            onClick={(e) => {
              e.stopPropagation();
              onSegmentClick(seg.codingIds, e);
            }}
          >
            {/* Background layers */}
            {seg.questionColors.map((color, ci) => (
              <span
                key={ci}
                className="absolute inset-0 rounded-sm transition-opacity duration-150"
                style={{
                  backgroundColor: color,
                  opacity: opacity,
                  zIndex: ci,
                }}
              />
            ))}
            {/* Underline indicator */}
            <span
              className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full opacity-60"
              style={{
                backgroundColor: seg.questionColors[0],
                zIndex: layerCount,
              }}
            />
            <span className="relative" style={{ zIndex: layerCount + 1 }}>
              {slice}
            </span>
          </span>
        );
      })}
    </>
  );
}

function TranscriptNode({ data, id, selected }: NodeProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const allCodings = useCanvasCodings();
  const allQuestions = useCanvasQuestions();
  const allTranscripts = useCanvasTranscripts();
  const allCases = useCanvasCases();
  const pendingSelection = usePendingSelection();
  const showCodingStripes = useShowCodingStripes();
  const setPendingSelection = useCanvasStore((s) => s.setPendingSelection);
  const deleteTranscript = useCanvasStore((s) => s.deleteTranscript);
  const codeInVivo = useCanvasStore((s) => s.codeInVivo);
  const spreadToParagraph = useCanvasStore((s) => s.spreadToParagraph);
  const nodeData = data as unknown as TranscriptNodeData;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [quickCodePopover, setQuickCodePopover] = useState<{ x: number; y: number } | null>(null);
  const [codingPopover, setCodingPopover] = useState<{ codingIds: string[]; x: number; y: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { collapsed, toggleCollapsed } = useNodeCollapsed(id, nodeData.collapsed);

  const zoomTier = useUIStore((s) => s.zoomTier);
  const isReduced = zoomTier === 'reduced';
  const isMinimal = zoomTier === 'minimal';

  // "Verify in context": when an AI suggestion's Locate action targets this
  // transcript, highlight the exact span and (if collapsed) expand to show it.
  const verifyHighlight = useUIStore((s) => s.verifyHighlight);
  const verifyRange = useMemo(
    () =>
      verifyHighlight && verifyHighlight.transcriptId === nodeData.transcriptId
        ? { start: verifyHighlight.startOffset, end: verifyHighlight.endOffset }
        : null,
    [verifyHighlight, nodeData.transcriptId],
  );
  useEffect(() => {
    if (verifyRange && collapsed) toggleCollapsed();
    // Only react to a new verify target, not to collapse toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyRange]);

  const codings = useMemo(
    () => allCodings.filter((c: CanvasTextCoding) => c.transcriptId === nodeData.transcriptId),
    [allCodings, nodeData.transcriptId],
  );

  const questions = useMemo(
    () => allQuestions.map((q: CanvasQuestion) => ({ id: q.id, color: q.color })),
    [allQuestions],
  );

  const transcript = useMemo(
    () => allTranscripts.find((t) => t.id === nodeData.transcriptId),
    [allTranscripts, nodeData.transcriptId],
  );

  // Transcript text is read from the store (single source of truth) rather than
  // duplicated into node.data — see buildNodes. Offsets are computed against
  // this same content, so using it keeps coding placement correct.
  const content = transcript?.content ?? '';

  const caseName = useMemo(() => {
    const caseId = transcript?.caseId;
    if (!caseId) return null;
    return allCases.find((c: CanvasCase) => c.id === caseId)?.name;
  }, [transcript?.caseId, allCases]);

  // Word count
  const wordCount = useMemo(() => content.split(/\s+/).filter(Boolean).length, [content]);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !textRef.current) {
      return;
    }

    const rawText = sel.toString();
    if (!rawText.trim()) return;

    // Walk the DOM to find the actual character offset within the text container
    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(textRef.current!);
    preRange.setEnd(range.startContainer, range.startOffset);
    const rawStart = preRange.toString().length;

    // Trim leading/trailing whitespace from the selection while keeping offsets
    // aligned with the actual substring we store. Otherwise a user selecting
    // " word " would save a range that spans whitespace — later highlights
    // would drift relative to the codedText.
    const leading = rawText.length - rawText.trimStart().length;
    const trailing = rawText.length - rawText.trimEnd().length;
    const startIdx = rawStart + leading;
    const endIdx = rawStart + rawText.length - trailing;
    const selText = rawText.slice(leading, rawText.length - trailing);

    setPendingSelection({
      transcriptId: nodeData.transcriptId,
      startOffset: startIdx,
      endOffset: endIdx,
      codedText: selText,
    });

    // Close coding popover if open
    setCodingPopover(null);

    // Show Quick Code Popover at the selection position
    const rect = range.getBoundingClientRect();
    setQuickCodePopover({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, [nodeData.transcriptId, setPendingSelection]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!pendingSelection || pendingSelection.transcriptId !== nodeData.transcriptId) return;
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
      setQuickCodePopover(null);
    },
    [pendingSelection, nodeData.transcriptId],
  );

  const handleCodeInVivo = useCallback(async () => {
    if (!pendingSelection || pendingSelection.transcriptId !== nodeData.transcriptId) return;
    try {
      await codeInVivo(
        pendingSelection.transcriptId,
        pendingSelection.startOffset,
        pendingSelection.endOffset,
        pendingSelection.codedText,
      );
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
      await spreadToParagraph(
        pendingSelection.transcriptId,
        pendingSelection.startOffset,
        pendingSelection.endOffset,
        pendingSelection.codedText,
      );
      window.getSelection()?.removeAllRanges();
      toast.success('Spread to paragraph — new code created');
    } catch {
      toast.error('Failed to spread to paragraph');
    }
    setContextMenu(null);
  }, [pendingSelection, nodeData.transcriptId, spreadToParagraph]);

  const handleSegmentClick = useCallback((codingIds: string[], event: React.MouseEvent) => {
    // Don't show coding popover if there's a text selection being made
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;

    // Close quick code popover
    setQuickCodePopover(null);

    setCodingPopover({
      codingIds,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const codingPopoverCodings = useMemo(() => {
    if (!codingPopover) return [];
    return codings.filter((c) => codingPopover.codingIds.includes(c.id));
  }, [codingPopover, codings]);

  const hasSelection = pendingSelection?.transcriptId === nodeData.transcriptId;

  // Unique question count for this transcript
  const uniqueQuestionCount = useMemo(() => new Set(codings.map((c) => c.questionId)).size, [codings]);

  return (
    <div
      className={`min-w-[280px] w-full h-full flex flex-col rounded-xl border bg-white shadow-node transition-all duration-200 hover:shadow-node-hover dark:bg-gray-800 ${nodeData.customColor ? '' : 'border-blue-200/60 dark:border-blue-800/60'} ${selected ? 'ring-2 ring-blue-400' : ''}`}
      style={nodeData.customColor ? { borderColor: nodeData.customColor, borderLeftWidth: 4 } : undefined}
    >
      <NodeResizer
        minWidth={280}
        minHeight={collapsed ? 44 : 100}
        lineClassName="!border-blue-400/50"
        handleClassName="!w-2 !h-2 !bg-blue-400 !border-blue-500"
        isVisible={selected}
      />

      {/* Drag handle header */}
      <div className="drag-handle relative z-20 flex items-center justify-between rounded-t-xl bg-gradient-to-r from-blue-50 to-blue-50/60 px-3 py-2.5 cursor-grab active:cursor-grabbing dark:from-blue-900/30 dark:to-blue-900/15">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate">{nodeData.title}</span>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(nodeData as any).muted && (
            <span className="shrink-0 rounded bg-gray-400/80 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
              MUTED
            </span>
          )}
          {caseName && (
            <span className="shrink-0 rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-medium text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
              {caseName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <CrossCanvasRefBadge nodeId={id} />
          {collapsed && codings.length > 0 && (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {codings.length} coding{codings.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={toggleCollapsed}
            className="rounded p-1 text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded p-1 text-blue-400 hover:bg-blue-100 hover:text-red-600 dark:hover:bg-blue-800 dark:hover:text-red-400"
            title="Delete transcript"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Always-visible coverage bar at bottom of header */}
      {(() => {
        const contentLen = content.length;
        if (contentLen === 0) return null;
        // Calculate coded character coverage using a boolean array approach
        const covered = new Uint8Array(contentLen);
        for (const c of codings) {
          const s = Math.max(0, Math.min(c.startOffset, contentLen));
          const e = Math.max(0, Math.min(c.endOffset, contentLen));
          for (let i = s; i < e; i++) covered[i] = 1;
        }
        let codedChars = 0;
        for (let i = 0; i < contentLen; i++) if (covered[i]) codedChars++;
        const pct = Math.round((codedChars / contentLen) * 100);
        // Color: gray(0%) -> blue(partial) -> green(100%)
        const barColor = pct === 0 ? '#9CA3AF' : pct === 100 ? '#22C55E' : '#3B82F6';
        return (
          <div className="h-[3px] w-full bg-gray-200 dark:bg-gray-700" title={`${pct}% coded`}>
            <div
              className="h-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>
        );
      })()}

      {/* Body - collapsible with transition */}
      {!collapsed && zoomTier === 'full' && (
        <div className="flex-1 min-h-0 overflow-hidden transition-[max-height] duration-200 flex flex-col">
          {/* Scrollable text body with optional coding stripes + density bar */}
          <div className="relative">
            {showCodingStripes && codings.length > 0 && (
              <CodingStripesOverlay
                contentLength={content.length}
                codings={codings}
                questions={questions}
                containerHeight={300}
              />
            )}
            {codings.length > 0 && (
              <CodingDensityBar contentLength={content.length} codings={codings} questions={questions} height={300} />
            )}
            <div
              ref={textRef}
              className="nodrag nowheel flex-1 min-h-0 overflow-y-auto px-3 py-2"
              style={{
                paddingLeft:
                  codings.length > 0
                    ? showCodingStripes
                      ? `${[...new Set(codings.map((c) => c.questionId))].length * 6 + 20}px`
                      : '20px'
                    : undefined,
              }}
              onMouseUp={handleMouseUp}
              onContextMenu={handleContextMenu}
            >
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-gray-300 select-text">
                <HighlightedTranscript
                  text={content}
                  codings={codings}
                  questions={questions}
                  onSegmentClick={handleSegmentClick}
                  verifyRange={verifyRange}
                />
              </div>
            </div>
          </div>

          {/* Enhanced footer with metadata */}
          <div className="border-t border-blue-100 px-3 py-1.5 dark:border-blue-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {codings.length > 0 && (
                <span className="text-[10px] text-blue-500 dark:text-blue-400">
                  {codings.length} segment{codings.length !== 1 ? 's' : ''}
                </span>
              )}
              {uniqueQuestionCount > 0 && (
                <span className="text-[10px] text-purple-400 dark:text-purple-500">
                  {uniqueQuestionCount} code{uniqueQuestionCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-300 dark:text-gray-600 tabular-nums">
              {wordCount.toLocaleString()} word{wordCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Reduced zoom: title + coding count */}
      {!collapsed && isReduced && (
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">
            {codings.length} coding{codings.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] text-gray-300 dark:text-gray-600 tabular-nums">
            {wordCount.toLocaleString()} word{wordCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Minimal zoom: colored rectangle with truncated title */}
      {!collapsed && isMinimal && <div className="px-2 py-1 text-[9px] text-gray-400 truncate">{codings.length}c</div>}

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
          }}
          onAiSuggest={nodeData.onAiSuggest}
        />
      )}

      {/* Coding segment popover — appears when clicking coded text */}
      {codingPopover && codingPopoverCodings.length > 0 && (
        <CodingSegmentPopover
          codings={codingPopoverCodings}
          anchorRect={{ x: codingPopover.x, y: codingPopover.y }}
          onClose={() => setCodingPopover(null)}
        />
      )}

      {/* Right-click context menu — portal to body so CSS transforms don't break fixed positioning */}
      {contextMenu &&
        hasSelection &&
        createPortal(
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
      {showDeleteConfirm &&
        createPortal(
          <ConfirmDialog
            title="Delete Transcript"
            message="Delete this transcript and all its coded segments?"
            onConfirm={async () => {
              await deleteTranscript(nodeData.transcriptId);
              setShowDeleteConfirm(false);
            }}
            onCancel={() => setShowDeleteConfirm(false)}
          />,
          document.body,
        )}
    </div>
  );
}

export default memo(TranscriptNode);
