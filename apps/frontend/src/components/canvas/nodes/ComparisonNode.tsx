import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode, CanvasQuestion, ComparisonConfig, ComparisonResult } from '@canvas-app/shared';

export interface ComparisonNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

export default function ComparisonNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as ComparisonNodeData;
  const { activeCanvas, updateComputedNode } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);
  const [editing, setEditing] = useState(false);
  const [selectedTIds, setSelectedTIds] = useState<string[]>([]);

  if (!node) return null;
  const config = node.config as unknown as ComparisonConfig;
  const result = node.result as unknown as ComparisonResult;
  const questions = activeCanvas?.questions ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];

  const handleSaveConfig = () => {
    updateComputedNode(node.id, { config: { ...config, transcriptIds: selectedTIds } });
    setEditing(false);
  };

  const icon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );

  // Transform result into chart data
  const chartData = result?.transcripts?.length
    ? questions.map((q: CanvasQuestion, qi: number) => {
        const entry: any = { name: q.text.slice(0, 12) };
        result.transcripts.forEach(t => {
          const profile = t.profile.find(p => p.questionId === q.id);
          entry[t.title.slice(0, 15)] = profile?.count || 0;
        });
        return entry;
      })
    : [];

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={node.id}
      label={node.label}
      icon={icon}
      color="#EC4899"
      onConfigure={() => { setSelectedTIds(config?.transcriptIds || []); setEditing(true); }}
      selected={selected}
      collapsed={(data as any).collapsed}
      zoomLevel={(data as any).zoomLevel}
    >
      {editing && (
        <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2 space-y-2">
          <p className="text-[10px] font-medium text-gray-500">Select transcripts to compare:</p>
          <div className="max-h-[120px] overflow-y-auto space-y-1">
            {transcripts.map(t => (
              <label key={t.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={selectedTIds.includes(t.id)}
                  onChange={() => setSelectedTIds(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                  className="rounded border-gray-300"
                />
                <span className="truncate">{t.title}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveConfig} className="btn-primary h-7 px-2 text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="px-3 py-2">
        {!result?.transcripts?.length ? (
          <p className="text-xs text-gray-400 text-center py-4">Select transcripts, then click Run.</p>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                {result.transcripts.map((t, i) => (
                  <Bar key={t.id} dataKey={t.title.slice(0, 15)} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ComputedNodeShell>
  );
}
