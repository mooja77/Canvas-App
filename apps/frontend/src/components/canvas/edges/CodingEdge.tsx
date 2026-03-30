import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BaseEdge, getBezierPath, getStraightPath, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvasStore';
import { useUIStore } from '../../../stores/uiStore';
import ConfirmDialog from '../ConfirmDialog';
import type { CanvasTextCoding } from '@qualcanvas/shared';

function useIsDarkMode() {
  const darkMode = useUIStore(s => s.darkMode);
  return darkMode;
}

interface CodingEdgeData {
  codingId: string;
  codedText: string;
  questionColor: string;
  count?: number;
  codings?: CanvasTextCoding[];
}

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
  const [deletingCodingId, setDeletingCodingId] = useState<string | null>(null);
  const { deleteCoding } = useCanvasStore();
  const edgeStyle = useUIStore(s => s.edgeStyle);
  const zoomTier = useUIStore(s => s.zoomTier);
  const isDark = useIsDarkMode();
  const edgeData = data as CodingEdgeData | undefined;

  const count = edgeData?.count ?? 1;
  const codings = edgeData?.codings;

  const pathParams = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  const [edgePath, labelX, labelY] = edgeStyle === 'straight'
    ? getStraightPath(pathParams)
    : edgeStyle === 'step'
      ? getSmoothStepPath({ ...pathParams, borderRadius: 0 })
      : edgeStyle === 'smoothstep'
        ? getSmoothStepPath(pathParams)
        : getBezierPath(pathParams);

  const color = edgeData?.questionColor || '#3B82F6';
  const strokeWidth = 1.5 + Math.log2(count || 1);

  return (
    <>
      {/* Invisible wider path for easier hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: hovered ? strokeWidth + 1 : strokeWidth,
          strokeDasharray: undefined,
          transition: 'stroke-width 200ms ease, opacity 200ms ease',
          opacity: hovered ? 1 : (isDark ? 0.8 : 0.65),
        }}
      />
      {/* Animated direction dot — visible at full zoom when not hovered */}
      {!hovered && zoomTier === 'full' && (
        <circle r={3} fill={color} opacity={0.5}>
          <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
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
            <div className="edge-tooltip-enter max-w-[260px] rounded-xl bg-gray-900/95 px-3 py-2.5 text-xs text-white shadow-lg backdrop-blur-md ring-1 ring-white/10">
              {/* Color indicator + count badge */}
              <div className="flex items-center gap-1.5 mb-1">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                  {count > 1 ? `${count} coded segments` : 'Coded segment'}
                </span>
              </div>

              {count > 1 && codings ? (
                <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-gray-700">
                  {codings.map((c) => (
                    <div key={c.id} className="group flex items-start gap-1.5">
                      <p className="flex-1 line-clamp-2 leading-relaxed text-gray-200">
                        &ldquo;{c.codedText}&rdquo;
                      </p>
                      <button
                        onClick={() => { setDeletingCodingId(c.id); setShowDeleteConfirm(true); }}
                        className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 text-red-400 hover:bg-red-500/20 transition-all"
                        title="Remove this coding"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="line-clamp-3 leading-relaxed text-gray-200">
                  &ldquo;{edgeData.codedText}&rdquo;
                </p>
              )}

              <button
                onClick={() => {
                  if (count === 1 && edgeData.codingId) {
                    setDeletingCodingId(edgeData.codingId);
                  } else if (codings && codings.length > 0) {
                    setDeletingCodingId(codings[0].id);
                  }
                  setShowDeleteConfirm(true);
                }}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-red-500/20 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/30 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                {count > 1 ? 'Remove all codings' : 'Remove coding'}
              </button>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && deletingCodingId && createPortal(
        <ConfirmDialog
          title="Remove Coding"
          message="Remove this coded segment? The transcript text will not be affected."
          confirmLabel="Remove"
          onConfirm={() => { deleteCoding(deletingCodingId); setShowDeleteConfirm(false); setDeletingCodingId(null); setHovered(false); }}
          onCancel={() => { setShowDeleteConfirm(false); setDeletingCodingId(null); }}
        />,
        document.body,
      )}
    </>
  );
}
