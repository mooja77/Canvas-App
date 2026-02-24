import { useState, useRef, useEffect } from 'react';
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
  const [editTitle, setEditTitle] = useState(nodeData.title || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState(nodeData.collapsed ?? false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const zoomLevel = (nodeData.zoomLevel ?? 100);
  const isZoomedOut = zoomLevel < 30;

  // Auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editing, editContent]);

  const handleSave = () => {
    const updates: { content?: string; title?: string } = {};
    if (editContent.trim() !== nodeData.content) updates.content = editContent.trim();
    if (editTitle.trim() !== (nodeData.title || '')) updates.title = editTitle.trim() || undefined;
    if (Object.keys(updates).length > 0) updateMemo(nodeData.memoId, updates);
    setEditing(false);
  };

  // Character count
  const charCount = nodeData.content.length;
  const wordCount = nodeData.content.split(/\s+/).filter(Boolean).length;

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
        <div className="flex items-center gap-1.5 min-w-0">
          <svg className="h-3.5 w-3.5 shrink-0 text-gray-600/50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600/70 truncate">
            {nodeData.title || 'Memo'}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="rounded p-0.5 text-gray-500/50 hover:text-gray-700 transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`h-3 w-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded p-0.5 text-gray-500/50 hover:text-red-600 transition-colors"
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
        <div className="px-3 pb-2">
          {editing ? (
            <div className="nodrag space-y-1.5">
              <input
                type="text"
                className="w-full rounded border border-gray-300/50 bg-white/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 placeholder:text-gray-400/70 focus:outline-none focus:ring-1 focus:ring-gray-400"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Memo title (optional)"
              />
              <textarea
                ref={textareaRef}
                className="w-full resize-none rounded border border-gray-300/50 bg-white/60 p-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 leading-relaxed"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onBlur={handleSave}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setEditing(false); }
                  if (e.key === 'Enter' && e.ctrlKey) { handleSave(); }
                }}
                rows={3}
                autoFocus
                placeholder="Write your memo..."
              />
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-gray-500/60">Ctrl+Enter to save</span>
                <button
                  onClick={handleSave}
                  className="rounded bg-white/40 px-2 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-white/60 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p
                className="whitespace-pre-wrap text-xs text-gray-700 cursor-text nodrag leading-relaxed"
                onDoubleClick={() => { setEditContent(nodeData.content); setEditTitle(nodeData.title || ''); setEditing(true); }}
                title="Double-click to edit"
              >
                {nodeData.content}
              </p>
              {/* Footer */}
              <div className="mt-1.5 flex items-center justify-between text-[9px] text-gray-500/50">
                <span>{wordCount} words</span>
                <button
                  onClick={() => { setEditContent(nodeData.content); setEditTitle(nodeData.title || ''); setEditing(true); }}
                  className="rounded px-1 py-0.5 hover:bg-white/30 hover:text-gray-700 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
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
