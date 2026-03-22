import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { CanvasTextCoding, CanvasQuestion, CanvasTranscript } from '@canvas-app/shared';
import { useUIStore } from '../../../stores/uiStore';

export interface DocumentPortraitNodeData {
  label: string;
  config: {
    transcriptId?: string;
    questionIds?: string[];
  };
  result: {
    strips?: {
      transcriptId: string;
      transcriptTitle: string;
      segments: {
        startPercent: number;
        endPercent: number;
        questionId: string;
        color: string;
      }[];
    }[];
  };
  collapsed?: boolean;
  zoomTier?: 'full' | 'reduced' | 'minimal';
  [key: string]: unknown;
}

function DocumentPortraitNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as DocumentPortraitNodeData;
  const { label, result, collapsed } = nodeData;
  const zoomTier = useUIStore(s => s.zoomTier);
  const strips = result?.strips || [];

  if (zoomTier === 'minimal') {
    return (
      <div className={`px-2 py-1 rounded text-xs font-medium truncate max-w-[120px] bg-purple-50 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 ${
        selected ? 'ring-2 ring-blue-500' : ''
      }`}>
        <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5" />
        <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5" />
        {label}
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-purple-200 dark:border-purple-700 transition-shadow ${
        selected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-lg'
      }`}
      style={{ minWidth: 200, maxWidth: 400 }}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-purple-500" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-purple-500" />

      {/* Header */}
      <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/30 rounded-t-lg border-b border-purple-100 dark:border-purple-800">
        <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-200 truncate">
          {label}
        </h3>
        <p className="text-xs text-purple-600 dark:text-purple-400">
          Document Portrait
        </p>
      </div>

      {/* Portrait strips */}
      {!collapsed && (
        <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
          {strips.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
              No coding data. Run this node to generate the portrait.
            </p>
          ) : (
            strips.map((strip) => (
              <div key={strip.transcriptId} className="space-y-1">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {strip.transcriptTitle}
                </p>
                {/* The portrait strip */}
                <div className="relative h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden border border-gray-200 dark:border-gray-600">
                  {strip.segments.map((seg, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 opacity-80 hover:opacity-100 transition-opacity"
                      style={{
                        left: `${seg.startPercent}%`,
                        width: `${seg.endPercent - seg.startPercent}%`,
                        backgroundColor: seg.color,
                      }}
                      title={`${seg.questionId}: ${seg.startPercent.toFixed(1)}% - ${seg.endPercent.toFixed(1)}%`}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default memo(DocumentPortraitNode);
