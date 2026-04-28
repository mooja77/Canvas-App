import { useViewport } from '@xyflow/react';
import type { GuideLine } from '../../hooks/useAlignmentGuides';

export default function AlignmentGuideOverlay({ guideLines }: { guideLines: GuideLine[] }) {
  const { x, y, zoom } = useViewport();

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        {guideLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#3B82F6"
            strokeWidth={1 / zoom}
            strokeDasharray={`${4 / zoom} ${3 / zoom}`}
            opacity={0.7}
          />
        ))}
      </g>
    </svg>
  );
}
