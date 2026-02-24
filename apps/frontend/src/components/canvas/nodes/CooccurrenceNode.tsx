import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode, CanvasQuestion, CooccurrenceConfig, CooccurrenceResult } from '@canvas-app/shared';

export interface CooccurrenceNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

export default function CooccurrenceNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as CooccurrenceNodeData;
  const { activeCanvas, updateComputedNode } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);
  const [editing, setEditing] = useState(false);
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);

  if (!node) return null;
  const config = node.config as unknown as CooccurrenceConfig;
  const result = node.result as unknown as CooccurrenceResult;
  const questions = activeCanvas?.questions ?? [];

  const questionMap = new Map(questions.map((q: CanvasQuestion) => [q.id, q]));

  const handleSaveConfig = () => {
    updateComputedNode(node.id, { config: { ...config, questionIds: selectedQIds } });
    setEditing(false);
  };

  const toggleQ = (qid: string) => {
    setSelectedQIds(prev => prev.includes(qid) ? prev.filter(id => id !== qid) : [...prev, qid]);
  };

  const icon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={node.id}
      label={node.label}
      icon={icon}
      color="#7C3AED"
      onConfigure={() => { setSelectedQIds(config?.questionIds || []); setEditing(true); }}
      selected={selected}
      collapsed={(data as any).collapsed}
      zoomLevel={(data as any).zoomLevel}
    >
      {editing && (
        <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2 space-y-2">
          <p className="text-[10px] font-medium text-gray-500">Select questions to compare:</p>
          <div className="max-h-[120px] overflow-y-auto space-y-1">
            {questions.map((q: CanvasQuestion) => (
              <label key={q.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={selectedQIds.includes(q.id)}
                  onChange={() => toggleQ(q.id)}
                  className="rounded border-gray-300"
                />
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: q.color }} />
                <span className="truncate">{q.text}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveConfig} className="btn-primary h-7 px-2 text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="max-h-[250px] overflow-y-auto px-3 py-2">
        {!result?.pairs?.length ? (
          <p className="text-xs text-gray-400 text-center py-4">
            {config?.questionIds?.length >= 2 ? 'No co-occurrences found. Click Run.' : 'Select 2+ questions and click Run.'}
          </p>
        ) : (
          <div className="space-y-2">
            {result.pairs.map((pair, i) => (
              <div key={i} className="rounded border border-gray-100 dark:border-gray-700 p-2">
                <div className="flex items-center gap-1 mb-1">
                  {pair.questionIds.map(qid => {
                    const q = questionMap.get(qid);
                    return q ? (
                      <span key={qid} className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] text-white" style={{ backgroundColor: q.color }}>
                        {q.text.slice(0, 25)}{q.text.length > 25 ? '...' : ''}
                      </span>
                    ) : null;
                  })}
                </div>
                <p className="text-[10px] text-gray-500">{pair.count} co-occurrence{pair.count !== 1 ? 's' : ''}</p>
                {pair.segments.slice(0, 3).map((seg, j) => (
                  <p key={j} className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">"{seg.text.slice(0, 80)}{seg.text.length > 80 ? '...' : ''}"</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </ComputedNodeShell>
  );
}
