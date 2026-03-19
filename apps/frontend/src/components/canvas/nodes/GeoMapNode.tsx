import type { NodeProps } from '@xyflow/react';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode } from '@canvas-app/shared';

export interface GeoMapNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

interface GeoPoint {
  transcriptId: string;
  title: string;
  latitude: number;
  longitude: number;
  locationName: string;
  codingCount: number;
}

interface GeoMapResult {
  points: GeoPoint[];
  totalMapped: number;
  totalUnmapped: number;
}

export default function GeoMapNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as GeoMapNodeData;
  const { activeCanvas } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);

  if (!node) return null;
  const result = node.result as unknown as GeoMapResult;
  const points = result?.points || [];

  // Simple placeholder map visualization using a div with positioned markers
  // Normalize lat/lng to relative positions within the container
  const latMin = points.length ? Math.min(...points.map(p => p.latitude)) : 0;
  const latMax = points.length ? Math.max(...points.map(p => p.latitude)) : 0;
  const lngMin = points.length ? Math.min(...points.map(p => p.longitude)) : 0;
  const lngMax = points.length ? Math.max(...points.map(p => p.longitude)) : 0;
  const latRange = latMax - latMin || 1;
  const lngRange = lngMax - lngMin || 1;

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={nodeData.computedNodeId}
      label={node.label}
      icon={<span className="text-sm">&#127758;</span>}
      color="#10B981"
      selected={selected}
    >
      <div className="p-3 min-w-[350px]">
        {points.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            No transcripts with location data found. Set latitude/longitude on transcripts and run again.
          </p>
        ) : (
          <>
            <div className="text-xs text-gray-500 mb-2">
              {result.totalMapped} mapped / {result.totalUnmapped} unmapped transcripts
            </div>
            {/* Simple map placeholder */}
            <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Grid lines for reference */}
              <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="border border-gray-200/30 dark:border-gray-700/30" />
                ))}
              </div>
              {/* Data points */}
              {points.map((point) => {
                const x = ((point.longitude - lngMin) / lngRange) * 85 + 5; // 5-90% range
                const y = 90 - ((point.latitude - latMin) / latRange) * 85; // invert Y for lat
                const size = Math.min(20, 8 + point.codingCount * 2);
                return (
                  <div
                    key={point.transcriptId}
                    className="absolute flex items-center justify-center rounded-full bg-emerald-500/80 text-white text-[8px] font-bold shadow-sm cursor-default"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      width: size,
                      height: size,
                      transform: 'translate(-50%, -50%)',
                    }}
                    title={`${point.locationName || point.title}\n${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}\n${point.codingCount} codings`}
                  >
                    {point.codingCount > 0 ? point.codingCount : ''}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="mt-2 space-y-0.5">
              {points.slice(0, 8).map((point) => (
                <div key={point.transcriptId} className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="truncate">{point.locationName || point.title}</span>
                  <span className="text-gray-400 ml-auto flex-shrink-0">
                    ({point.latitude.toFixed(2)}, {point.longitude.toFixed(2)})
                  </span>
                </div>
              ))}
              {points.length > 8 && (
                <span className="text-[9px] text-gray-400">+{points.length - 8} more locations</span>
              )}
            </div>
          </>
        )}
      </div>
    </ComputedNodeShell>
  );
}
