import { memo, useMemo, useState } from 'react';
import { useNodeCollapsed } from './useNodeCollapsed';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  useCanvasStore,
  useCanvasCodings,
  useCanvasQuestions,
  useSelectedQuestionId,
} from '../../../stores/canvasStore';
import { useUIStore } from '../../../stores/uiStore';
import ConfirmDialog from '../ConfirmDialog';
import ColorPicker from '../panels/ColorPicker';
import CrossCanvasRefBadge from '../CrossCanvasRefBadge';
import type { CanvasTextCoding, CanvasQuestion } from '@qualcanvas/shared';

export interface QuestionNodeData {
  questionId: string;
  text: string;
  color: string;
  collapsed?: boolean;
  zoomLevel?: number;
  zoomTier?: 'full' | 'reduced' | 'minimal';
  [key: string]: unknown;
}

function QuestionNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as QuestionNodeData;
  const codings = useCanvasCodings();
  const questions = useCanvasQuestions();
  const selectedQuestionId = useSelectedQuestionId();
  const deleteQuestion = useCanvasStore((s) => s.deleteQuestion);
  const updateQuestion = useCanvasStore((s) => s.updateQuestion);
  const setSelectedQuestionId = useCanvasStore((s) => s.setSelectedQuestionId);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(nodeData.text);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { collapsed, toggleCollapsed } = useNodeCollapsed(id, nodeData.collapsed);

  const zoomTier = useUIStore((s) => s.zoomTier);
  const isReduced = zoomTier === 'reduced';
  const isMinimal = zoomTier === 'minimal';

  const codingCount = useMemo(
    () => codings.filter((c: CanvasTextCoding) => c.questionId === nodeData.questionId).length,
    [codings, nodeData.questionId],
  );

  const question = useMemo(
    () => questions.find((q: CanvasQuestion) => q.id === nodeData.questionId),
    [questions, nodeData.questionId],
  );

  const parentQuestion = useMemo(() => {
    if (!question?.parentQuestionId) return null;
    return questions.find((q: CanvasQuestion) => q.id === question.parentQuestionId);
  }, [question?.parentQuestionId, questions]);

  const childCount = useMemo(
    () => questions.filter((q: CanvasQuestion) => q.parentQuestionId === nodeData.questionId).length,
    [questions, nodeData.questionId],
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
      className={`group relative min-w-[200px] w-full h-full overflow-hidden rounded-xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-node transition-all duration-200 hover:shadow-node-hover hover:-translate-y-px ${selected || isSelected ? 'ring-2' : 'ring-1 ring-gray-200/70 dark:ring-gray-700/60'}`}
      style={selected || isSelected ? ({ '--tw-ring-color': nodeData.color } as React.CSSProperties) : undefined}
    >
      {/* Color identity spine — calm color-coding without a heavy full border. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-30 w-1"
        style={{ backgroundColor: nodeData.color }}
        aria-hidden="true"
      />

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

      {/* Drag handle header — calm by default; controls reveal on hover/focus
          so the code text stays the hero. */}
      <div className="drag-handle relative z-20 flex items-center justify-between gap-2 pl-4 pr-1.5 py-2 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative nodrag">
            <button
              onClick={() => setShowColorPicker((c) => !c)}
              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15 transition-transform hover:scale-125"
              style={{ backgroundColor: nodeData.color }}
              title="Change color"
              aria-label="Change code color"
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
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(nodeData as any).muted && (
            <span className="shrink-0 rounded bg-gray-400/80 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
              MUTED
            </span>
          )}
          {childCount > 0 && (
            <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 dark:text-gray-400">
              {childCount} sub
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <CrossCanvasRefBadge nodeId={id} />
          {collapsed && codingCount > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
              style={{ backgroundColor: nodeData.color }}
            >
              {codingCount}
            </span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              onClick={toggleCollapsed}
              className="rounded p-1 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedQuestionId(isSelected ? null : nodeData.questionId)}
              className="rounded p-1 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
              title="View coded segments"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded p-1 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
              title="Delete question"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Question body - collapsible */}
      {!collapsed && zoomTier === 'full' && (
        <div className="relative z-10 px-4 pb-3 pt-1">
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
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                  if (e.key === 'Escape') {
                    setEditing(false);
                  }
                }}
                rows={3}
                maxLength={1000}
                autoFocus
              />
              <span
                className={`block text-right text-[10px] mt-0.5 ${editText.length > 900 ? 'text-red-500 font-medium' : 'text-gray-400'}`}
              >
                {editText.length}/1000
              </span>
            </div>
          ) : (
            <p
              className="text-sm font-medium leading-snug text-gray-900 dark:text-gray-100 cursor-text nodrag"
              onDoubleClick={() => {
                setEditText(nodeData.text);
                setEditing(true);
              }}
              title="Double-click to edit"
            >
              {nodeData.text}
            </p>
          )}

          {/* Coding count — quiet metadata; color is a small cue, not a loud pill. */}
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: nodeData.color }} aria-hidden="true" />
            {codingCount} coding{codingCount !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Reduced zoom: question text only */}
      {!collapsed && isReduced && (
        <div className="relative z-10 px-4 pb-2 pt-0.5">
          <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{nodeData.text}</p>
        </div>
      )}

      {/* Minimal zoom: count only */}
      {!collapsed && isMinimal && (
        <div className="relative z-10 px-4 pb-1.5 pt-0.5">
          <span className="text-[10px] font-medium" style={{ color: nodeData.color }}>
            {codingCount}c
          </span>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm &&
        createPortal(
          <ConfirmDialog
            title="Delete Question"
            message="Delete this question and all its codings?"
            onConfirm={async () => {
              await deleteQuestion(nodeData.questionId);
              setShowDeleteConfirm(false);
            }}
            onCancel={() => setShowDeleteConfirm(false)}
          />,
          document.body,
        )}
    </div>
  );
}

export default memo(QuestionNode);
