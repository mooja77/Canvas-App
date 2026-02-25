import { useState, useRef, useEffect, useCallback } from 'react';
import { NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

const STICKY_COLORS = ['#FEF3C7', '#FCE7F3', '#DBEAFE', '#D1FAE5', '#EDE9FE', '#FEE2E2'];

export interface StickyNoteNodeData {
  noteId: string;
  text: string;
  color: string;
  onTextChange?: (text: string) => void;
  onColorChange?: (color: string) => void;
  onDelete?: () => void;
  [key: string]: unknown;
}

export default function StickyNoteNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StickyNoteNodeData;
  const color = nodeData.color || '#FEF3C7';
  const [editing, setEditing] = useState(!nodeData.text);
  const [text, setText] = useState(nodeData.text || '');
  const [showColors, setShowColors] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) {
      setText(nodeData.text || '');
    }
  }, [nodeData.text, editing]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(text.length, text.length);
    }
  }, [editing]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (text !== nodeData.text && nodeData.onTextChange) {
      nodeData.onTextChange(text);
    }
  }, [text, nodeData]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setText(nodeData.text || '');
      setEditing(false);
    }
  }, [nodeData.text]);

  // Subtle rotation for post-it feel
  const rotation = ((nodeData.noteId || '').charCodeAt(0) % 5) - 2;

  return (
    <div
      className="w-full h-full rounded-lg shadow-md transition-shadow duration-200 hover:shadow-lg relative"
      style={{
        backgroundColor: color,
        transform: `rotate(${rotation}deg)`,
        minWidth: 140,
        minHeight: 100,
      }}
    >
      <NodeResizer
        minWidth={140}
        minHeight={100}
        lineClassName="!border-transparent hover:!border-gray-400/40"
        handleClassName="!w-2 !h-2 !bg-white !border-2 !border-gray-400/60 !rounded-full"
        isVisible={selected}
      />

      {/* Drag handle strip at top */}
      <div
        className="drag-handle h-5 w-full cursor-grab active:cursor-grabbing rounded-t-lg flex items-center justify-end px-1.5"
        style={{ backgroundColor: `${color}` }}
      >
        {/* Delete button - visible on select */}
        {selected && nodeData.onDelete && (
          <button
            onClick={nodeData.onDelete}
            className="rounded p-0.5 text-gray-400/70 hover:text-red-500 transition-colors"
            title="Remove note"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Text content */}
      <div className="px-3 pb-2 flex-1">
        {editing ? (
          <textarea
            ref={textareaRef}
            className="nodrag nowheel w-full h-full min-h-[60px] bg-transparent text-xs leading-relaxed text-gray-700 resize-none outline-none placeholder-gray-400/60"
            placeholder="Type a quick note..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div
            className="w-full min-h-[60px] text-xs leading-relaxed text-gray-700 cursor-text whitespace-pre-wrap break-words"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to edit"
          >
            {text || <span className="text-gray-400/60 italic">Double-click to add note...</span>}
          </div>
        )}
      </div>

      {/* Color picker dots - visible when selected */}
      {selected && (
        <div className="absolute bottom-1.5 left-2.5 flex items-center gap-1">
          {showColors ? (
            <div className="flex items-center gap-1 animate-fade-in">
              {STICKY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    nodeData.onColorChange?.(c);
                    setShowColors(false);
                  }}
                  className={`h-3.5 w-3.5 rounded-full border transition-transform hover:scale-125 ${
                    c === color ? 'border-gray-500 ring-1 ring-gray-400' : 'border-gray-300/60'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          ) : (
            <button
              onClick={() => setShowColors(true)}
              className="h-3.5 w-3.5 rounded-full border border-gray-300/60 transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
              title="Change color"
            />
          )}
        </div>
      )}
    </div>
  );
}
