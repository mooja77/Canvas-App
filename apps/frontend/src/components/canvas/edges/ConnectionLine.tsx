import { ConnectionLineComponentProps, getStraightPath } from '@xyflow/react';

export default function ConnectionLine({ fromX, fromY, toX, toY, fromNode }: ConnectionLineComponentProps) {
  const [path] = getStraightPath({ sourceX: fromX, sourceY: fromY, targetX: toX, targetY: toY });

  // Color based on source node type
  const nodeType = fromNode?.type || '';
  const color = nodeType === 'transcript' ? '#3B82F6' : nodeType === 'question' ? '#8B5CF6' : '#F59E0B';

  return (
    <g>
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeDasharray="6 3" opacity={0.6} />
      <circle cx={toX} cy={toY} r={4} fill={color} opacity={0.8}>
        <animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}
