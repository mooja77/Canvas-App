import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

export default function RerouteNode({ selected }: NodeProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
      style={{ width: 16, height: 16 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-full !w-full !rounded-full !border-2 !border-gray-400 !bg-gray-200 dark:!border-gray-500 dark:!bg-gray-600 !left-0 !top-0 !transform-none"
        style={{ position: 'absolute' }}
      />
      <div className="absolute inset-0 rounded-full bg-gray-300 dark:bg-gray-500 pointer-events-none" />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-full !w-full !rounded-full !border-2 !border-gray-400 !bg-gray-200 dark:!border-gray-500 dark:!bg-gray-600 !left-0 !top-0 !transform-none"
        style={{ position: 'absolute' }}
      />
    </div>
  );
}
