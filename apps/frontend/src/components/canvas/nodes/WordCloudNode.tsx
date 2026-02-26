import { useState, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Text } from '@visx/text';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode, CanvasQuestion, WordCloudConfig, WordCloudResult } from '@canvas-app/shared';

export interface WordCloudNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

const CLOUD_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1', '#14B8A6'];

export default function WordCloudNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as WordCloudNodeData;
  const { activeCanvas, updateComputedNode } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);
  const [editing, setEditing] = useState(false);
  const [selectedQId, setSelectedQId] = useState<string>('');
  const questions = activeCanvas?.questions ?? [];

  const config = node?.config as unknown as WordCloudConfig | undefined;
  const result = node?.result as unknown as WordCloudResult | undefined;

  const handleSaveConfig = () => {
    if (!node) return;
    updateComputedNode(node.id, { config: { ...config, questionId: selectedQId || undefined } });
    setEditing(false);
  };

  // Simple spiral placement
  const wordLayout = useMemo(() => {
    if (!result?.words?.length) return [];
    const words = result.words.slice(0, 50);
    const maxCount = Math.max(...words.map(w => w.count));
    const minCount = Math.min(...words.map(w => w.count));

    const fontScale = (count: number) => {
      if (maxCount === minCount) return 20;
      const t = (Math.log(count) - Math.log(Math.max(1, minCount))) / (Math.log(Math.max(2, maxCount)) - Math.log(Math.max(1, minCount)));
      return 10 + Math.min(1, Math.max(0, t)) * 22;
    };

    const width = 320;
    const height = 200;
    const cx = width / 2;
    const cy = height / 2;

    return words.map((word, i) => {
      const angle = i * 0.5;
      const radius = 5 + i * 3;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return {
        text: word.text,
        count: word.count,
        fontSize: fontScale(word.count),
        x: Math.max(30, Math.min(width - 30, x)),
        y: Math.max(15, Math.min(height - 15, y)),
        color: CLOUD_COLORS[i % CLOUD_COLORS.length],
      };
    });
  }, [result]);

  if (!node) return null;

  const icon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
    </svg>
  );

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={node.id}
      label={node.label}
      icon={icon}
      color="#6366F1"
      onConfigure={() => { setSelectedQId(config?.questionId || ''); setEditing(true); }}
      selected={selected}
      collapsed={(data as any).collapsed}
      zoomLevel={(data as any).zoomLevel}
    >
      {editing && (
        <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2 space-y-2">
          <select className="input h-7 text-xs w-full" value={selectedQId} onChange={e => setSelectedQId(e.target.value)}>
            <option value="">All questions</option>
            {questions.map((q: CanvasQuestion) => (
              <option key={q.id} value={q.id}>{q.text}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={handleSaveConfig} className="btn-primary h-7 px-2 text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="px-2 py-2">
        {!wordLayout.length ? (
          <p className="text-xs text-gray-400 text-center py-4">Click Run to generate word cloud.</p>
        ) : (
          <svg width={320} height={200} className="mx-auto">
            {wordLayout.map((w, i) => (
              <Text
                key={i}
                x={w.x}
                y={w.y}
                fontSize={w.fontSize}
                fill={w.color}
                textAnchor="middle"
                verticalAnchor="middle"
                fontWeight={w.fontSize > 20 ? 'bold' : 'normal'}
              >
                {w.text}
              </Text>
            ))}
          </svg>
        )}
      </div>
    </ComputedNodeShell>
  );
}
