import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvasStore';
import ConfirmDialog from '../ConfirmDialog';
import ColorPicker from '../panels/ColorPicker';
import type { CanvasTextCoding, CanvasQuestion } from '@canvas-app/shared';

export interface QuestionNodeData {
  questionId: string;
  text: string;
  color: string;
  collapsed?: boolean;
  zoomLevel?: number;
  [key: string]: unknown;
}

export default function QuestionNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as QuestionNodeData;
  const { activeCanvas, deleteQuestion, updateQuestion, setSelectedQuestionId, selectedQuestionId } = useCanvasStore();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(nodeData.text);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [collapsed, setCollapsed] = useState(nodeData.collapsed ?? false);

  const zoomLevel = (nodeData.zoomLevel ?? 100);
  const isZoomedOut = zoomLevel < 30;

  const codingCount = useMemo(
    () => (activeCanvas?.codings ?? []).filter((c: CanvasTextCoding) => c.questionId === nodeData.questionId).length,
    [activeCanvas?.codings, nodeData.questionId],
  );

  const question = useMemo(
    () => activeCanvas?.questions.find((q: CanvasQuestion) => q.id === nodeData.questionId),
    [activeCanvas?.questions, nodeData.questionId],
  );

  const parentQuestion = useMemo(() => {
    if (!question?.parentQuestionId) return null;
    return activeCanvas?.questions.find((q: CanvasQuestion) => q.id === question.parentQuestionId);
  }, [question?.parentQuestionId, activeCanvas?.questions]);

  const childCount = useMemo(
    () => (activeCanvas?.questions ?? []).filter((q: CanvasQuestion) => q.parentQuestionId === nodeData.questionId).length,
    [activeCanvas?.questions, nodeData.questionId],
  );

  const isSelected = selectedQuestionId === nodeData.questionId;

  const handleSaveEdit = () => {
    if (editText.trim() && editText.trim() !== nodeData.text) {
      updateQuestion(nodeData.questionId, { text: editText.trim() });
    }
    setEditing(false);
  };

  return (
    <div
      className={`min-w-[200px] w-full h-full rounded-xl border-2 shadow-node transition-all duration-200 hover:shadow-node-hover ${isSelected ? 'ring-2 ring-offset-2' : ''} ${selected ? 'ring-2 ring-blue-400' : ''}`}
      style={{
        borderColor: nodeData.color,
        ...(isSelected ? { '--tw-ring-color': nodeData.color } as React.CSSProperties : {}),
      }}
    >
      <NodeResizer
        minWidth={200}
        minHeight={collapsed ? 44 : 80}
        lineClassName="!border-purple-400/50"
        handleClassName="!w-2 !h-2 !bg-purple-400 !border-purple-500"
        isVisible={selected}
      />

      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Left}
        id={`question-target-${id}`}
        className="!h-4 !w-4 !border-2 transition-all duration-200"
        style={{ borderColor: nodeData.color, backgroundColor: nodeData.color, top: '50%' }}
      />
      {/* Source handle for relations */}
      <Handle
        type="source"
        position={Position.Right}
        id={`question-source-${id}`}
        className="!h-3 !w-3 !border-2 transition-all duration-200"
        style={{ borderColor: nodeData.color, backgroundColor: nodeData.color, top: '50%' }}
      />

      {/* Drag handle header */}
      <div
        className="drag-handle flex items-center justify-between rounded-t-lg px-3 py-2.5 cursor-grab active:cursor-grabbing"
        style={{ background: `linear-gradient(135deg, ${nodeData.color}12, ${nodeData.color}08)` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative nodrag">
            <button
              onClick={() => setShowColorPicker(c => !c)}
              className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10 hover:scale-125 transition-transform"
              style={{ backgroundColor: nodeData.color }}
              title="Change color"
            />
            {showColorPicker && (
              <div className="absolute top-5 left-0 z-50">
                <ColorPicker
                  color={nodeData.color}
                  onChange={(c) => updateQuestion(nodeData.questionId, { color: c })}
                  onClose={() => setShowColorPicker(false)}
                />
              </div>
            )}
          </div>
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            Code
          </span>
          {childCount > 0 && (
            <span className="rounded-full bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 text-[9px] font-medium text-gray-600 dark:text-gray-300">
              {childCount} sub
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            onClick={() => setSelectedQuestionId(isSelected ? null : nodeData.questionId)}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="View coded segments"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete question"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Question body - collapsible */}
      {!collapsed && !isZoomedOut && (
        <div className="bg-white px-3 py-2 dark:bg-gray-800 rounded-b-xl">
          {/* Parent breadcrumb */}
          {parentQuestion && (
            <div className="flex items-center gap-1 mb-1.5 text-[10px] text-gray-400">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: parentQuestion.color }} />
              <span className="truncate">{parentQuestion.text}</span>
              <span>{'>'}</span>
            </div>
          )}

          {editing ? (
            <div className="nodrag">
              <textarea
                className="input text-sm w-full resize-none"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                  if (e.key === 'Escape') { setEditing(false); }
                }}
                rows={3}
                maxLength={1000}
                autoFocus
              />
              <span className={`block text-right text-[10px] mt-0.5 ${editText.length > 900 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                {editText.length}/1000
              </span>
            </div>
          ) : (
            <p
              className="text-sm text-gray-800 dark:text-gray-200 cursor-text nodrag"
              onDoubleClick={() => { setEditText(nodeData.text); setEditing(true); }}
              title="Double-click to edit"
            >
              {nodeData.text}
            </p>
          )}

          {/* Coding count */}
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: nodeData.color }}
            >
              {codingCount} coding{codingCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Zoomed out simplified */}
      {!collapsed && isZoomedOut && (
        <div className="bg-white px-3 py-1 dark:bg-gray-800 rounded-b-xl">
          <span className="text-[10px]" style={{ color: nodeData.color }}>{codingCount}c</span>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && createPortal(
        <ConfirmDialog
          title="Delete Question"
          message="Delete this question and all its codings?"
          onConfirm={() => { setShowDeleteConfirm(false); deleteQuestion(nodeData.questionId); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />,
        document.body,
      )}
    </div>
  );
}
