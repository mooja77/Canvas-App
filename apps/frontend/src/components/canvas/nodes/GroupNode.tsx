import { useState, useRef, useEffect, useCallback } from 'react';
import { NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export interface GroupNodeData {
  title: string;
  color: string;
  collapsed?: boolean;
  onTitleChange?: (newTitle: string) => void;
  [key: string]: unknown;
}

const DEFAULT_COLOR = '#3B82F6';

export default function GroupNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as GroupNodeData;
  const color = nodeData.color || DEFAULT_COLOR;
  const title = nodeData.title || 'Group';

  const [collapsed, setCollapsed] = useState(nodeData.collapsed ?? false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync collapsed state from external data changes
  useEffect(() => {
    setCollapsed(nodeData.collapsed ?? false);
  }, [nodeData.collapsed]);

  // Sync title from external data changes
  useEffect(() => {
    if (!editing) {
      setEditTitle(nodeData.title || 'Group');
    }
  }, [nodeData.title, editing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleTitleDoubleClick = useCallback(() => {
    setEditTitle(nodeData.title || 'Group');
    setEditing(true);
  }, [nodeData.title]);

  const handleTitleSave = useCallback(() => {
    setEditing(false);
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== nodeData.title && nodeData.onTitleChange) {
      nodeData.onTitleChange(trimmed);
    }
  }, [editTitle, nodeData]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    }
    if (e.key === 'Escape') {
      setEditTitle(nodeData.title || 'Group');
      setEditing(false);
    }
  }, [nodeData.title, handleTitleSave]);

  return (
    <div
      className={`w-full rounded-2xl transition-shadow duration-200 ${
        collapsed ? 'h-auto' : 'h-full'
      }`}
      style={{
        backgroundColor: `${color}14`,
        border: `2px dashed ${color}4D`,
        pointerEvents: 'none',
      }}
    >
      <NodeResizer
        minWidth={200}
        minHeight={collapsed ? 40 : 100}
        lineClassName="!border-transparent hover:!border-blue-400/40"
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !rounded-full"
        handleStyle={{ borderColor: `${color}99` }}
        isVisible={selected && !collapsed}
      />

      {/* Title bar - serves as drag handle */}
      <div
        className="drag-handle flex items-center justify-between rounded-t-2xl px-3 py-2 cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: `${color}26`, pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Group icon */}
          <svg
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: `${color}B3` }}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 0 1-1.125-1.125v-3.75ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-2.25Z"
            />
          </svg>

          {/* Title - editable on double-click */}
          {editing ? (
            <input
              ref={inputRef}
              className="nodrag nowheel flex-1 min-w-0 rounded px-1 py-0.5 text-xs font-semibold uppercase tracking-wide bg-white/60 dark:bg-gray-800/60 border border-gray-300/50 dark:border-gray-600/50 focus:outline-none focus:ring-1 focus:ring-blue-400"
              style={{ color: `${color}CC` }}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
            />
          ) : (
            <span
              className="text-xs font-semibold uppercase tracking-wide truncate cursor-text"
              style={{ color: `${color}CC` }}
              onDoubleClick={handleTitleDoubleClick}
              title="Double-click to rename"
            >
              {editTitle}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 ml-2 shrink-0">
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-0.5 transition-colors hover:bg-white/30 dark:hover:bg-gray-700/30"
            style={{ color: `${color}99` }}
            title={collapsed ? 'Expand group' : 'Collapse group'}
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                collapsed ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 15.75 7.5-7.5 7.5 7.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Body area - visible when expanded */}
      {!collapsed && (
        <div className="w-full flex-1 min-h-[60px]">
          {/* Empty body; child nodes are placed on top by React Flow */}
        </div>
      )}
    </div>
  );
}
