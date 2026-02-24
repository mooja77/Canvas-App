import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvasStore';
import ConfirmDialog from '../ConfirmDialog';

export default function CodingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { deleteCoding } = useCanvasStore();
  const edgeData = data as { codingId: string; codedText: string; questionColor: string } | undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = edgeData?.questionColor || '#3B82F6';

  return (
    <>
      {/* Invisible wider path for easier hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: hovered ? 2.5 : 1.5,
          strokeDasharray: undefined,
          transition: 'stroke-width 200ms ease',
        }}
      />
      {hovered && edgeData && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="edge-tooltip-enter max-w-[200px] rounded-xl bg-gray-900 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-sm ring-1 ring-white/10">
              <p className="line-clamp-3 leading-relaxed">
                "{edgeData.codedText}"
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-red-300 hover:text-red-200"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                Remove coding
              </button>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && edgeData && createPortal(
        <ConfirmDialog
          title="Remove Coding"
          message="Remove this coded segment? The transcript text will not be affected."
          confirmLabel="Remove"
          onConfirm={() => { deleteCoding(edgeData.codingId); setShowDeleteConfirm(false); setHovered(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />,
        document.body,
      )}
    </>
  );
}
