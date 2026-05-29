import { memo, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasComputedNodes } from '../../../stores/canvasStore';
import type { CanvasComputedNode } from '@qualcanvas/shared';

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

// Format a latitude/longitude with hemisphere suffix (e.g. "51.51°N", "0.13°W").
function fmtLat(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
}
function fmtLng(lng: number): string {
  return `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
}

function GeoMapNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as GeoMapNodeData;
  const computedNodes = useCanvasComputedNodes();
  const node = computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);

  const result = (node?.result as unknown as GeoMapResult) ?? undefined;
  const points = useMemo(() => result?.points ?? [], [result]);

  // Project points into the plot box. We fit to the data's bounding box (with
  // padding) and LABEL the corner coordinates, so the spatial spread is
  // readable AND the true scale is explicit — the previous version normalized
  // to the bounds with no labels, which made distant and nearby points look
  // identical. Single / colocated points (zero-range axis) are centered.
  const projected = useMemo(() => {
    if (points.length === 0) {
      return {
        markers: [] as (GeoPoint & { x: number; y: number })[],
        bounds: null as null | { latMin: number; latMax: number; lngMin: number; lngMax: number },
      };
    }
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const latPad = (Math.max(...lats) - Math.min(...lats)) * 0.1 || 0.1;
    const lngPad = (Math.max(...lngs) - Math.min(...lngs)) * 0.1 || 0.1;
    const latMin = Math.min(...lats) - latPad;
    const latMax = Math.max(...lats) + latPad;
    const lngMin = Math.min(...lngs) - lngPad;
    const lngMax = Math.max(...lngs) + lngPad;
    const latRange = latMax - latMin || 1;
    const lngRange = lngMax - lngMin || 1;
    const markers = points.map((p) => ({
      ...p,
      x: ((p.longitude - lngMin) / lngRange) * 100,
      y: (1 - (p.latitude - latMin) / latRange) * 100, // invert Y: north = up
    }));
    return { markers, bounds: { latMin, latMax, lngMin, lngMax } };
  }, [points]);

  if (!node) return null;

  const maxCodings = points.reduce((m, p) => Math.max(m, p.codingCount), 0);

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
            {/* Coordinate plot: points at their true relative position, with a
                labeled lat/lng extent so the scale is unambiguous. */}
            <div className="relative w-full h-48 overflow-hidden rounded border border-gray-200 bg-gradient-to-b from-sky-50 to-emerald-50 dark:border-gray-700 dark:from-slate-900 dark:to-slate-800">
              {/* Graticule (centre lines) */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute bottom-0 left-1/2 top-0 border-l border-gray-300/40 dark:border-gray-600/40" />
                <div className="absolute left-0 right-0 top-1/2 border-t border-gray-300/40 dark:border-gray-600/40" />
              </div>
              {/* Corner coordinate labels */}
              {projected.bounds && (
                <>
                  <span className="absolute left-1 top-1 text-[8px] text-gray-500 dark:text-gray-400">
                    {fmtLat(projected.bounds.latMax)}, {fmtLng(projected.bounds.lngMin)}
                  </span>
                  <span className="absolute right-1 top-1 text-[8px] text-gray-500 dark:text-gray-400">
                    {fmtLng(projected.bounds.lngMax)}
                  </span>
                  <span className="absolute bottom-1 left-1 text-[8px] text-gray-500 dark:text-gray-400">
                    {fmtLat(projected.bounds.latMin)}
                  </span>
                </>
              )}
              {/* Data points */}
              {projected.markers.map((point) => {
                const size = Math.min(22, 9 + point.codingCount * 2);
                const isMax = maxCodings > 0 && point.codingCount === maxCodings;
                return (
                  <div
                    key={point.transcriptId}
                    className={`absolute flex items-center justify-center rounded-full text-[8px] font-bold text-white shadow-sm ring-1 ring-white/60 ${
                      isMax ? 'bg-emerald-600' : 'bg-emerald-500/85'
                    }`}
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      width: size,
                      height: size,
                      transform: 'translate(-50%, -50%)',
                    }}
                    title={`${point.locationName || point.title}\n${fmtLat(point.latitude)}, ${fmtLng(point.longitude)}\n${point.codingCount} coding${point.codingCount !== 1 ? 's' : ''}`}
                  >
                    {point.codingCount > 0 ? point.codingCount : ''}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="mt-2 space-y-0.5">
              {points.slice(0, 8).map((point) => (
                <div
                  key={point.transcriptId}
                  className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400"
                >
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
                  <span className="truncate">{point.locationName || point.title}</span>
                  <span className="ml-auto flex-shrink-0 text-gray-400">
                    {fmtLat(point.latitude)}, {fmtLng(point.longitude)}
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

export default memo(GeoMapNode);
