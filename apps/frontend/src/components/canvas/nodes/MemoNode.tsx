import { memo, useState, useRef, useEffect, useMemo, useId } from 'react';
import { useNodeCollapsed } from './useNodeCollapsed';
import { createPortal } from 'react-dom';
import { NodeResizer, NodeToolbar, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { useUIStore } from '../../../stores/uiStore';
import CrossCanvasRefBadge from '../CrossCanvasRefBadge';
import ConfirmDialog from '../ConfirmDialog';
import { reportNodeSaveError } from './nodeSave';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

export interface MemoNodeData {
  memoId: string;
  title?: string;
  content: string;
  color: string;
  collapsed?: boolean;
  zoomLevel?: number;
  zoomTier?: 'full' | 'reduced' | 'minimal';
  [key: string]: unknown;
}

// Simple markdown renderer for memo content
function renderMemoContent(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <span key={i} className="block text-[11px] font-bold text-gray-800 mt-1">
          {formatInline(line.slice(4))}
        </span>,
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <span key={i} className="block text-xs font-bold text-gray-800 mt-1">
          {formatInline(line.slice(3))}
        </span>,
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <span key={i} className="block text-[13px] font-bold text-gray-800 mt-1">
          {formatInline(line.slice(2))}
        </span>,
      );
      continue;
    }

    // Bullet lists
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <span key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
          <span className="mt-1 h-1 w-1 rounded-full bg-gray-500 shrink-0" />
          <span>{formatInline(line.slice(2))}</span>
        </span>,
      );
      continue;
    }

    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s/);
    if (numMatch) {
      elements.push(
        <span key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
          <span className="text-[9px] font-medium text-gray-400 shrink-0 mt-[1px]">{numMatch[1]}.</span>
          <span>{formatInline(line.slice(numMatch[0].length))}</span>
        </span>,
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<span key={i} className="block h-1.5" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <span key={i} className="block text-xs text-gray-700">
        {formatInline(line)}
      </span>,
    );
  }

  return elements;
}

// Inline formatting: **bold**, *italic*, `code`
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      parts.push(
        <em key={match.index} className="italic">
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      parts.push(
        <code key={match.index} className="rounded bg-gray-200/60 px-0.5 text-[10px] font-mono">
          {match[4]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

function MemoNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as MemoNodeData;
  const isOverview = useUIStore((s) => s.zoomTier === 'minimal');
  const { updateMemo, deleteMemo } = useCanvasStore();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(nodeData.content);
  const [editTitle, setEditTitle] = useState(nodeData.title || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const { collapsed, toggleCollapsed } = useNodeCollapsed(id, nodeData.collapsed);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const editorId = useId();
  useFocusTrap(dialogRef, editing);

  // Disabled controls can lose focus in a browser. Keep pending keyboard input
  // inside the dialog, where the trap also blocks Tab when nothing is enabled.
  useEffect(() => {
    if (saving) dialogRef.current?.focus();
  }, [saving]);

  const startEditing = () => {
    setEditContent(nodeData.content);
    setEditTitle(nodeData.title || '');
    setEditing(true);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editing, editContent]);

  const handleSave = async () => {
    const updates: { content?: string; title?: string } = {};
    if (editContent.trim() !== nodeData.content) updates.content = editContent.trim();
    if (editTitle.trim() !== (nodeData.title || '')) updates.title = editTitle.trim();
    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await updateMemo(nodeData.memoId, updates);
      setEditing(false);
    } catch (err) {
      // Keep the editor open so the typed text is not thrown away.
      reportNodeSaveError(err, 'Failed to save memo');
    } finally {
      setSaving(false);
    }
  };

  // Insert formatting at cursor
  const insertFormat = (prefix: string, suffix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = editContent.slice(start, end);
    const newText = editContent.slice(0, start) + prefix + selected + suffix + editContent.slice(end);
    setEditContent(newText);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      ta.focus();
      const cursorPos = selected ? start + prefix.length + selected.length + suffix.length : start + prefix.length;
      ta.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const wordCount = nodeData.content.split(/\s+/).filter(Boolean).length;
  const renderedContent = useMemo(() => renderMemoContent(nodeData.content), [nodeData.content]);

  return (
    <div
      className={`min-w-[180px] w-full h-full flex flex-col rounded-xl shadow-node transition-all duration-200 hover:shadow-node-hover ${selected ? 'ring-2 ring-blue-400' : ''}`}
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
      <div className="drag-handle relative z-20 flex items-center justify-between px-3 py-1.5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-1.5 min-w-0">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-gray-600/50"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
            />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-700 truncate">
            {nodeData.title || 'Memo'}
          </span>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(nodeData as any).muted && (
            <span className="shrink-0 rounded bg-gray-400/80 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
              MUTED
            </span>
          )}
        </div>
        <CrossCanvasRefBadge nodeId={id} />
      </div>

      {/* React Flow's portal toolbar keeps actual targets full-sized at every
          zoom. Its default single-selection rule avoids overlapping toolbars. */}
      {!isOverview && (
        <NodeToolbar nodeId={id} position={Position.Bottom} align="center" offset={12}>
          {createPortal(
            <div
              className="nodrag nopan fixed bottom-20 left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap justify-center gap-1 rounded-xl border border-gray-300 bg-white p-1 text-sm text-gray-800 shadow-lg"
              role="group"
              aria-label="Memo actions"
            >
              <button
                type="button"
                onClick={startEditing}
                className="min-h-11 min-w-11 rounded-lg px-3 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="min-h-11 min-w-11 rounded-lg px-3 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {collapsed ? 'Expand' : 'Collapse'}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.focus();
                  setShowDeleteConfirm(true);
                }}
                className="min-h-11 min-w-11 rounded-lg px-3 text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Delete memo
              </button>
            </div>,
            document.body,
          )}
        </NodeToolbar>
      )}

      {!collapsed && (
        <div className="px-3 pb-2 flex-1 min-h-0 overflow-y-auto">
          <div
            className="cursor-text nodrag leading-relaxed space-y-0.5"
            onDoubleClick={() => {
              if (!isOverview) startEditing();
            }}
            title={isOverview ? 'Zoom in to edit this memo' : 'Select this memo for controls, or double-click to edit'}
          >
            {renderedContent}
          </div>
          <div className="mt-1.5 text-[9px] text-gray-700">
            {wordCount} word{wordCount !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Editing lives outside the scaled canvas. Nothing is saved merely by
          moving focus: Done or Ctrl/Cmd+Enter confirms; Cancel/Escape discards. */}
      {editing &&
        createPortal(
          <div
            className="nodrag nopan nowheel fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape' && !saving) {
                event.preventDefault();
                setEditing(false);
              }
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void handleSave();
              }
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              tabIndex={-1}
              aria-modal="true"
              aria-labelledby={editorId + '-heading'}
              aria-describedby={editorId + '-help'}
              aria-busy={saving}
              className="max-h-[calc(100dvh-2rem)] w-full max-w-xl space-y-3 overflow-y-auto rounded-xl bg-white p-4 text-base text-gray-800 shadow-xl"
            >
              <h2 id={editorId + '-heading'} className="text-lg font-semibold">
                Edit memo
              </h2>
              <p id={editorId + '-help'} className="text-sm text-gray-600">
                Write your note, then choose Done to save. Cancel leaves your original note unchanged.
              </p>
              <div className="space-y-1">
                <label htmlFor={editorId + '-title'} className="block text-sm font-medium">
                  Memo title (optional)
                </label>
                <input
                  id={editorId + '-title'}
                  type="text"
                  disabled={saving}
                  className="min-h-11 w-full rounded border border-gray-400 bg-white px-3 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  placeholder="Memo title (optional)"
                />
              </div>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Memo formatting">
                {[
                  { label: 'Bold', prefix: '**', suffix: '**' },
                  { label: 'Italic', prefix: '*', suffix: '*' },
                  { label: 'Heading', prefix: '# ', suffix: '' },
                  { label: 'Bullet list', prefix: '- ', suffix: '' },
                  { label: 'Code', prefix: '`', suffix: '`' },
                ].map(({ label, prefix, suffix }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={saving}
                    className="min-h-11 min-w-11 rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertFormat(prefix, suffix)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <label htmlFor={editorId + '-text'} className="block text-sm font-medium">
                  Memo text
                </label>
                <textarea
                  id={editorId + '-text'}
                  ref={textareaRef}
                  disabled={saving}
                  className="max-h-[40dvh] min-h-32 w-full resize-y rounded border border-gray-400 bg-white p-3 text-base text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                  rows={5}
                  placeholder="Write your memo... (supports **bold**, *italic*, # headings, - lists)"
                />
              </div>
              <p className="text-sm text-gray-600">Ctrl+Enter (or Cmd+Enter) to save · Markdown supported</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                  className="min-h-11 min-w-11 rounded-lg border border-gray-400 px-4 text-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="min-h-11 min-w-11 rounded-lg bg-blue-700 px-4 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Done'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Delete confirmation */}
      {showDeleteConfirm &&
        createPortal(
          <ConfirmDialog
            title="Delete Memo"
            message="Delete this memo?"
            onConfirm={async () => {
              await deleteMemo(nodeData.memoId);
              setShowDeleteConfirm(false);
            }}
            onCancel={() => setShowDeleteConfirm(false)}
          />,
          document.body,
        )}
    </div>
  );
}

export default memo(MemoNode);
