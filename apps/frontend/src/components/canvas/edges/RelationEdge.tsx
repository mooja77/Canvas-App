import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvasStore';
import ConfirmDialog from '../ConfirmDialog';
import toast from 'react-hot-toast';

interface RelationEdgeData {
  relationId: string;
  label: string;
  [key: string]: unknown;
}

export default function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as unknown as RelationEdgeData;
  const { deleteRelation, updateRelation } = useCanvasStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleStartEdit = () => {
    setEditValue(edgeData?.label || 'relates to');
    setEditing(true);
  };

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || !edgeData?.relationId) {
      setEditing(false);
      return;
    }
    if (trimmed !== edgeData.label) {
      try {
        await updateRelation(edgeData.relationId, trimmed);
        toast.success('Label updated');
      } catch {
        toast.error('Failed to update label');
      }
    }
    setEditing(false);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: '#94A3B8', strokeWidth: 1.5, strokeDasharray: '6 3' }}
      />
      <foreignObject
        width={160}
        height={28}
        x={labelX - 80}
        y={labelY - 14}
        className="pointer-events-auto"
      >
        <div className="flex items-center justify-center gap-1">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              onBlur={handleSave}
              className="w-[120px] rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600 shadow-sm border border-blue-400 outline-none dark:bg-gray-800 dark:text-gray-300"
            />
          ) : (
            <span
              onDoubleClick={handleStartEdit}
              className="cursor-pointer rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-gray-600 shadow-sm border border-gray-200/60 backdrop-blur-sm dark:bg-gray-800/90 dark:text-gray-300 dark:border-gray-700/60"
              title="Double-click to edit"
            >
              {edgeData?.label || 'relates to'}
            </span>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-full bg-white/90 p-0.5 text-gray-300 hover:text-red-500 shadow-sm border border-gray-200/60 backdrop-blur-sm dark:bg-gray-800/90 dark:border-gray-700/60"
            title="Delete relation"
            aria-label="Delete relation"
          >
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </foreignObject>

      {showDeleteConfirm && edgeData?.relationId && createPortal(
        <ConfirmDialog
          title="Delete Relation"
          message="Remove this relation between nodes?"
          confirmLabel="Remove"
          onConfirm={() => { deleteRelation(edgeData.relationId); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />,
        document.body,
      )}
    </>
  );
}
