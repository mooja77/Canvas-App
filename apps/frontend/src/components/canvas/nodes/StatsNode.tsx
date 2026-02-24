import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode, StatsConfig, StatsResult } from '@canvas-app/shared';

export interface StatsNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1', '#14B8A6'];

export default function StatsNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as StatsNodeData;
  const { activeCanvas, updateComputedNode } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [editing, setEditing] = useState(false);
  const [groupBy, setGroupBy] = useState<'question' | 'transcript'>('question');

  if (!node) return null;
  const config = node.config as unknown as StatsConfig;
  const result = node.result as unknown as StatsResult;

  const handleSaveConfig = () => {
    updateComputedNode(node.id, { config: { ...config, groupBy } });
    setEditing(false);
  };

  const icon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={node.id}
      label={node.label}
      icon={icon}
      color="#3B82F6"
      onConfigure={() => { setGroupBy((config?.groupBy as 'question' | 'transcript') || 'question'); setEditing(true); }}
      selected={selected}
      collapsed={(data as any).collapsed}
      zoomLevel={(data as any).zoomLevel}
    >
      {editing && (
        <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500">Group by:</label>
            <select className="input h-7 text-xs flex-1" value={groupBy} onChange={e => setGroupBy(e.target.value as any)}>
              <option value="question">Question</option>
              <option value="transcript">Transcript</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveConfig} className="btn-primary h-7 px-2 text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="px-3 py-2">
        {!result?.items?.length ? (
          <p className="text-xs text-gray-400 text-center py-4">Click Run to compute statistics.</p>
        ) : (
          <>
            {/* Chart type toggle */}
            <div className="flex items-center gap-1 mb-2">
              <button
                onClick={() => setChartType('bar')}
                className={`rounded px-2 py-0.5 text-[10px] ${chartType === 'bar' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-400'}`}
              >
                Bar
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`rounded px-2 py-0.5 text-[10px] ${chartType === 'pie' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-400'}`}
              >
                Pie
              </button>
              <span className="ml-auto text-[10px] text-gray-400">{result.total} total</span>
            </div>

            <div className="h-[180px]">
              {chartType === 'bar' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.items.map(item => ({ name: item.label.slice(0, 15), count: item.count }))}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="count" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={result.items.map(item => ({ name: item.label.slice(0, 20), value: item.count }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      style={{ fontSize: 9 }}
                    >
                      {result.items.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}
      </div>
    </ComputedNodeShell>
  );
}
