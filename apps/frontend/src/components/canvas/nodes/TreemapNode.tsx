import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode, TreemapConfig, TreemapResult } from '@canvas-app/shared';

export interface TreemapNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

// Custom content renderer for treemap cells
function TreemapCell(props: any) {
  const { x, y, width, height, name, color } = props;
  if (width < 4 || height < 4) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color || '#8B5CF6'}
        stroke="#fff"
        strokeWidth={2}
        rx={3}
        style={{ opacity: 0.85 }}
      />
      {width > 30 && height > 16 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={Math.min(11, width / 6)}
          fontWeight={600}
        >
          {name && name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + '...' : name}
        </text>
      )}
    </g>
  );
}

export default function TreemapNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as TreemapNodeData;
  const { activeCanvas, updateComputedNode } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);
  const [editing, setEditing] = useState(false);
  const [metric, setMetric] = useState<'count' | 'characters'>('count');

  if (!node) return null;
  const config = node.config as unknown as TreemapConfig;
  const result = node.result as unknown as TreemapResult;

  const handleSaveConfig = () => {
    updateComputedNode(node.id, { config: { metric } as any });
    setEditing(false);
  };

  const icon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
  );

  // Build treemap data structure for recharts
  const treemapData = result?.nodes?.length
    ? [{
        name: 'root',
        children: result.nodes
          .filter(n => !n.parentId)
          .map(n => {
            const children = result.nodes.filter(c => c.parentId === n.id);
            if (children.length > 0) {
              return {
                name: n.name,
                color: n.color,
                children: children.map(c => ({
                  name: c.name,
                  size: c.size,
                  color: c.color,
                })),
              };
            }
            return { name: n.name, size: n.size, color: n.color };
          }),
      }]
    : [];

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={node.id}
      label={node.label}
      icon={icon}
      color="#8B5CF6"
      onConfigure={() => {
        setMetric(config?.metric || 'count');
        setEditing(true);
      }}
      selected={selected}
      collapsed={(data as any).collapsed}
      zoomLevel={(data as any).zoomLevel}
    >
      {editing && (
        <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500">Metric:</label>
            <select className="input h-7 text-xs flex-1" value={metric} onChange={e => setMetric(e.target.value as any)}>
              <option value="count">Coding Count</option>
              <option value="characters">Characters Coded</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveConfig} className="btn-primary h-7 px-2 text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="px-3 py-2">
        {!result?.nodes?.length ? (
          <p className="text-xs text-gray-400 text-center py-4">Click Run to generate theme map.</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
              <span>{result.nodes.length} theme{result.nodes.length !== 1 ? 's' : ''}</span>
              <span>Total: {result.total}</span>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData[0]?.children || []}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  content={<TreemapCell />}
                >
                  <Tooltip
                    contentStyle={{ fontSize: 11 }}
                    formatter={(value: number, name: string) => [`${value} ${config?.metric === 'characters' ? 'chars' : 'codings'}`, name]}
                  />
                </Treemap>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </ComputedNodeShell>
  );
}
