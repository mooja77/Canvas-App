import { useState, useRef, useEffect, useMemo } from 'react';
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

// Simple markdown renderer for memo content
function renderMemoContent(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<span key={i} className="block text-[11px] font-bold text-gray-800 mt-1">{formatInline(line.slice(4))}</span>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<span key={i} className="block text-xs font-bold text-gray-800 mt-1">{formatInline(line.slice(3))}</span>);
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<span key={i} className="block text-[13px] font-bold text-gray-800 mt-1">{formatInline(line.slice(2))}</span>);
      continue;
    }

    // Bullet lists
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <span key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
          <span className="mt-1 h-1 w-1 rounded-full bg-gray-500 shrink-0" />
          <span>{formatInline(line.slice(2))}</span>
        </span>
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
        </span>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<span key={i} className="block h-1.5" />);
      continue;
    }

    // Regular paragraph
    elements.push(<span key={i} className="block text-xs text-gray-700">{formatInline(line)}</span>);
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
      parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} className="italic">{match[3]}</em>);
    } else if (match[4]) {
      parts.push(<code key={match.index} className="rounded bg-gray-200/60 px-0.5 text-[10px] font-mono">{match[4]}</code>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
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
              {/* Formatting toolbar */}
              <div className="flex items-center gap-0.5 border-b border-gray-300/30 pb-1">
                <button
                  onMouseDown={e => { e.preventDefault(); insertFormat('**', '**'); }}
                  className="rounded p-0.5 text-gray-500/70 hover:bg-white/40 hover:text-gray-700 transition-colors"
                  title="Bold"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
                </button>
                <button
                  onMouseDown={e => { e.preventDefault(); insertFormat('*', '*'); }}
                  className="rounded p-0.5 text-gray-500/70 hover:bg-white/40 hover:text-gray-700 transition-colors"
                  title="Italic"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
                </button>
                <button
                  onMouseDown={e => { e.preventDefault(); insertFormat('# ', ''); }}
                  className="rounded p-0.5 text-gray-500/70 hover:bg-white/40 hover:text-gray-700 transition-colors"
                  title="Heading"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4v3h5.5v12h3V7H19V4z"/></svg>
                </button>
                <div className="w-px h-3 bg-gray-400/30 mx-0.5" />
                <button
                  onMouseDown={e => { e.preventDefault(); insertFormat('- ', ''); }}
                  className="rounded p-0.5 text-gray-500/70 hover:bg-white/40 hover:text-gray-700 transition-colors"
                  title="Bullet list"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>
                </button>
                <button
                  onMouseDown={e => { e.preventDefault(); insertFormat('`', '`'); }}
                  className="rounded p-0.5 text-gray-500/70 hover:bg-white/40 hover:text-gray-700 transition-colors"
                  title="Code"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
                </button>
              </div>
              <textarea
                ref={textareaRef}
                className="w-full resize-none rounded border border-gray-300/50 bg-white/60 p-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 leading-relaxed font-mono"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onBlur={handleSave}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setEditing(false); }
                  if (e.key === 'Enter' && e.ctrlKey) { handleSave(); }
                }}
                rows={3}
                autoFocus
                placeholder="Write your memo... (supports **bold**, *italic*, # headings, - lists)"
              />
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-gray-500/60">Ctrl+Enter to save &middot; Markdown supported</span>
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
              <div
                className="cursor-text nodrag leading-relaxed space-y-0.5"
                onDoubleClick={() => { setEditContent(nodeData.content); setEditTitle(nodeData.title || ''); setEditing(true); }}
                title="Double-click to edit"
              >
                {renderedContent}
              </div>
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
