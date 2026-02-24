import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvasStore';
import ConfirmDialog from '../ConfirmDialog';

export interface MemoNodeData {
  memoId: string;
  title?: string;
  content: string;
  color: string;
  collapsed?: boolean;
  zoomLevel?: number;
  [key: string]: unknown;
}

export default function MemoNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as MemoNodeData;
  const { updateMemo, deleteMemo } = useCanvasStore();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(nodeData.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState(nodeData.collapsed ?? false);

  const zoomLevel = (nodeData.zoomLevel ?? 100);
  const isZoomedOut = zoomLevel < 30;

  const handleSave = () => {
    if (editContent.trim() !== nodeData.content) {
      updateMemo(nodeData.memoId, { content: editContent.trim() });
    }
    setEditing(false);
  };

  return (
    <div
      className={`min-w-[180px] w-full h-full rounded-xl shadow-node transition-all duration-200 hover:shadow-node-hover ${selected ? 'ring-2 ring-blue-400' : ''}`}
      style={{ backgroundColor: nodeData.color }}
    >
      <NodeResizer
        minWidth={180}
        minHeight={collapsed ? 36 : 60}
        lineClassName="!border-yellow-500/50"
        handleClassName="!w-2 !h-2 !bg-yellow-500 !border-yellow-600"
        isVisible={selected}
      />

      {/* Drag handle */}
      <div className="drag-handle flex items-center justify-between px-3 py-1.5 cursor-grab active:cursor-grabbing">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600/70">
          {nodeData.title || 'Memo'}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="rounded p-0.5 text-gray-500/50 hover:text-gray-700"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`h-3 w-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded p-0.5 text-gray-500/50 hover:text-red-600"
            title="Delete memo"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Memo body - collapsible */}
      {!collapsed && !isZoomedOut && (
        <div className="px-3 pb-3">
          {editing ? (
            <div className="nodrag">
              <textarea
                className="w-full resize-none rounded border border-gray-300/50 bg-white/50 p-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onBlur={handleSave}
                onKeyDown={e => { if (e.key === 'Escape') setEditing(false); }}
                rows={4}
                autoFocus
              />
            </div>
          ) : (
            <p
              className="whitespace-pre-wrap text-xs text-gray-700 cursor-text nodrag"
              onDoubleClick={() => { setEditContent(nodeData.content); setEditing(true); }}
              title="Double-click to edit"
            >
              {nodeData.content}
            </p>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && createPortal(
        <ConfirmDialog
          title="Delete Memo"
          message="Delete this memo?"
          onConfirm={() => { setShowDeleteConfirm(false); deleteMemo(nodeData.memoId); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />,
        document.body,
      )}
    </div>
  );
}
