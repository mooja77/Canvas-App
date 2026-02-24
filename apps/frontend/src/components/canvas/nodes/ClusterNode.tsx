import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode, ClusterConfig, ClusterResult } from '@canvas-app/shared';

export interface ClusterNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

const CLUSTER_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

export default function ClusterNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as ClusterNodeData;
  const { activeCanvas, updateComputedNode } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);
  const [editing, setEditing] = useState(false);
  const [k, setK] = useState(3);

  if (!node) return null;
  const config = node.config as unknown as ClusterConfig;
  const result = node.result as unknown as ClusterResult;

  const handleSaveConfig = () => {
    updateComputedNode(node.id, { config: { ...config, k } });
    setEditing(false);
  };

  const icon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  );

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={node.id}
      label={node.label}
      icon={icon}
      color="#14B8A6"
      onConfigure={() => { setK(config?.k || 3); setEditing(true); }}
      selected={selected}
      collapsed={(data as any).collapsed}
      zoomLevel={(data as any).zoomLevel}
    >
      {editing && (
        <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500">Number of clusters (k):</label>
            <input
              type="number"
              min={2}
              max={10}
              value={k}
              onChange={e => setK(parseInt(e.target.value) || 3)}
              className="input h-7 w-16 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveConfig} className="btn-primary h-7 px-2 text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="max-h-[280px] overflow-y-auto px-3 py-2">
        {!result?.clusters?.length ? (
          <p className="text-xs text-gray-400 text-center py-4">Click Run to cluster coded segments.</p>
        ) : (
          <div className="space-y-3">
            {result.clusters.map((cluster, i) => (
              <div key={cluster.id} className="rounded-lg border p-2" style={{ borderColor: `${CLUSTER_COLORS[i % CLUSTER_COLORS.length]}40` }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }} />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{cluster.label}</span>
                  <span className="text-[10px] text-gray-400">({cluster.segments.length})</span>
                </div>

                {/* Keywords */}
                {cluster.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {cluster.keywords.map(kw => (
                      <span key={kw} className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: `${CLUSTER_COLORS[i % CLUSTER_COLORS.length]}20`, color: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {/* Segment previews */}
                {cluster.segments.slice(0, 3).map((seg, j) => (
                  <p key={j} className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    "{seg.text.slice(0, 60)}{seg.text.length > 60 ? '...' : ''}"
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </ComputedNodeShell>
  );
}
