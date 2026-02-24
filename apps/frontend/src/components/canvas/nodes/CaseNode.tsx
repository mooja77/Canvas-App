import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvasStore';
import ConfirmDialog from '../ConfirmDialog';
import type { CanvasCase, CanvasTranscript } from '@canvas-app/shared';

export interface CaseNodeData {
  caseId: string;
  collapsed?: boolean;
  zoomLevel?: number;
  [key: string]: unknown;
}

export default function CaseNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as CaseNodeData;
  const { activeCanvas, deleteCase } = useCanvasStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState(nodeData.collapsed ?? false);

  const isZoomedOut = (nodeData.zoomLevel ?? 100) < 30;

  const caseRecord = useMemo(
    () => activeCanvas?.cases.find((c: CanvasCase) => c.id === nodeData.caseId),
    [activeCanvas?.cases, nodeData.caseId],
  );

  const linkedTranscripts = useMemo(
    () => (activeCanvas?.transcripts ?? []).filter((t: CanvasTranscript) => t.caseId === nodeData.caseId).length,
    [activeCanvas?.transcripts, nodeData.caseId],
  );

  if (!caseRecord) return null;

  const attrs = typeof caseRecord.attributes === 'object' ? caseRecord.attributes : {};

  return (
    <div className={`min-w-[200px] w-full h-full rounded-xl border-2 border-teal-300/60 shadow-node transition-all duration-200 hover:shadow-node-hover dark:border-teal-700/60 ${selected ? 'ring-2 ring-blue-400' : ''}`}>
      <NodeResizer
        minWidth={200}
        minHeight={collapsed ? 44 : 80}
        lineClassName="!border-teal-400/50"
        handleClassName="!w-2 !h-2 !bg-teal-400 !border-teal-500"
        isVisible={selected}
      />

      <Handle
        type="source"
        position={Position.Right}
        id={`case-source-${id}`}
        className="!h-3 !w-3 !border-2 !border-teal-500 !bg-teal-500 transition-all duration-200"
        style={{ top: '50%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id={`case-target-${id}`}
        className="!h-3 !w-3 !border-2 !border-teal-500 !bg-teal-500 transition-all duration-200"
        style={{ top: '50%' }}
      />

      {/* Header */}
      <div className="drag-handle flex items-center justify-between rounded-t-lg bg-gradient-to-r from-teal-50 to-teal-50/60 px-3 py-2.5 cursor-grab active:cursor-grabbing dark:from-teal-900/30 dark:to-teal-900/15">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <span className="text-sm font-medium text-teal-800 dark:text-teal-200 truncate">{caseRecord.name}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="rounded p-0.5 text-teal-400 hover:text-teal-600 dark:hover:text-teal-300"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded p-0.5 text-teal-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete case"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body - collapsible */}
      {!collapsed && !isZoomedOut && (
        <div className="bg-white px-3 py-2 dark:bg-gray-800 rounded-b-xl">
          {/* Attributes as badges */}
          {Object.keys(attrs).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {Object.entries(attrs).map(([key, val]) => (
                <span key={key} className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                  <span className="font-medium">{key}:</span>&nbsp;{val}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
              {linkedTranscripts} transcript{linkedTranscripts !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && createPortal(
        <ConfirmDialog
          title="Delete Case"
          message="Delete this case? Transcripts will be unlinked and relations removed."
          onConfirm={() => { setShowDeleteConfirm(false); deleteCase(nodeData.caseId); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />,
        document.body,
      )}
    </div>
  );
}
