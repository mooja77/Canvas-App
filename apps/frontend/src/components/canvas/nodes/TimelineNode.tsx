import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode } from '@canvas-app/shared';

export interface TimelineNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

interface TimelineEntry {
  transcriptId: string;
  title: string;
  date: string;
  codings: {
    codingId: string;
    codedText: string;
    questionId: string;
    questionText: string;
    questionColor: string;
  }[];
  codingCount: number;
}

interface TimelineResult {
  entries: TimelineEntry[];
  totalDated: number;
  totalUndated: number;
}

export default function TimelineNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as TimelineNodeData;
  const { activeCanvas } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!node) return null;
  const result = node.result as unknown as TimelineResult;
  const entries = result?.entries || [];

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={nodeData.computedNodeId}
      label={node.label}
      icon={<span className="text-sm">&#128197;</span>}
      color="#8B5CF6"
      selected={selected}
    >
      <div className="p-3 min-w-[400px] max-w-[700px]">
        {entries.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            No transcripts with event dates found. Set eventDate on transcripts and run again.
          </p>
        ) : (
          <>
            <div className="text-xs text-gray-500 mb-2">
              {result.totalDated} dated / {result.totalUndated} undated transcripts
            </div>
            {/* Horizontal timeline */}
            <div className="relative overflow-x-auto pb-2">
              <div className="flex items-start gap-1 min-w-max">
                {entries.map((entry, idx) => {
                  const dateStr = new Date(entry.date).toLocaleDateString();
                  return (
                    <div
                      key={entry.transcriptId}
                      className="flex flex-col items-center min-w-[80px] relative"
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    >
                      {/* Date point */}
                      <div
                        className="w-3 h-3 rounded-full border-2 border-purple-500 bg-white dark:bg-gray-800 z-10"
                        style={{
                          backgroundColor: entry.codingCount > 0 ? '#8B5CF6' : undefined,
                        }}
                      />
                      {/* Connector line */}
                      {idx < entries.length - 1 && (
                        <div className="absolute top-1.5 left-1/2 w-full h-0.5 bg-purple-200 dark:bg-purple-800" />
                      )}
                      {/* Date label */}
                      <span className="text-[9px] text-gray-500 mt-1 whitespace-nowrap">{dateStr}</span>
                      {/* Title */}
                      <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 mt-0.5 text-center leading-tight max-w-[76px] truncate">
                        {entry.title}
                      </span>
                      {/* Coding count badge */}
                      {entry.codingCount > 0 && (
                        <span className="text-[9px] bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full px-1.5 mt-0.5">
                          {entry.codingCount}
                        </span>
                      )}
                      {/* Hover tooltip */}
                      {hoveredIdx === idx && entry.codings.length > 0 && (
                        <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-2 min-w-[160px] max-w-[220px]">
                          {entry.codings.slice(0, 5).map((c) => (
                            <div key={c.codingId} className="flex items-start gap-1 mb-1 text-[10px]">
                              <span
                                className="inline-block w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
                                style={{ backgroundColor: c.questionColor }}
                              />
                              <span className="text-gray-600 dark:text-gray-400 line-clamp-2">
                                {c.codedText}
                              </span>
                            </div>
                          ))}
                          {entry.codings.length > 5 && (
                            <span className="text-[9px] text-gray-400">+{entry.codings.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </ComputedNodeShell>
  );
}
