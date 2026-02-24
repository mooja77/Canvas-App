import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode, CanvasQuestion, CodingQueryConfig, CodingQueryResult } from '@canvas-app/shared';

export interface CodingQueryNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

export default function CodingQueryNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as CodingQueryNodeData;
  const { activeCanvas, updateComputedNode } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);
  const [editing, setEditing] = useState(false);
  const [conditions, setConditions] = useState<{ questionId: string; operator: 'AND' | 'OR' | 'NOT' }[]>([]);

  if (!node) return null;
  const config = node.config as unknown as CodingQueryConfig;
  const result = node.result as unknown as CodingQueryResult;
  const questions = activeCanvas?.questions ?? [];

  const handleSaveConfig = () => {
    updateComputedNode(node.id, { config: { conditions } as any });
    setEditing(false);
  };

  const addCondition = () => {
    if (questions.length === 0) return;
    setConditions([...conditions, { questionId: questions[0].id, operator: 'AND' }]);
  };

  const removeCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const icon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
    </svg>
  );

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={node.id}
      label={node.label}
      icon={icon}
      color="#DC2626"
      onConfigure={() => {
        setConditions(config?.conditions || []);
        setEditing(true);
      }}
      selected={selected}
      collapsed={(data as any).collapsed}
      zoomLevel={(data as any).zoomLevel}
    >
      {editing && (
        <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2 space-y-2">
          <p className="text-[10px] text-gray-500 font-medium">Conditions:</p>
          {conditions.map((cond, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && (
                <select
                  className="input h-6 text-[10px] w-14"
                  value={cond.operator}
                  onChange={e => {
                    const updated = [...conditions];
                    updated[i] = { ...cond, operator: e.target.value as 'AND' | 'OR' | 'NOT' };
                    setConditions(updated);
                  }}
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                  <option value="NOT">NOT</option>
                </select>
              )}
              {i === 0 && <span className="text-[10px] text-gray-400 w-14">Where</span>}
              <select
                className="input h-6 text-[10px] flex-1"
                value={cond.questionId}
                onChange={e => {
                  const updated = [...conditions];
                  updated[i] = { ...cond, questionId: e.target.value };
                  setConditions(updated);
                }}
              >
                {questions.map((q: CanvasQuestion) => (
                  <option key={q.id} value={q.id}>{q.text.slice(0, 30)}</option>
                ))}
              </select>
              <button onClick={() => removeCondition(i)} className="text-gray-400 hover:text-red-500 p-0.5">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={addCondition} className="text-[10px] text-red-600 hover:text-red-700">+ Add condition</button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveConfig} className="btn-primary h-7 px-2 text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="max-h-[250px] overflow-y-auto px-3 py-2">
        {!result?.matches?.length ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            {config?.conditions?.length ? 'No matches. Click Run to query.' : 'Add conditions and click Run.'}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {result.totalMatches} match{result.totalMatches !== 1 ? 'es' : ''}
            </p>
            {result.matches.slice(0, 20).map((m, i) => (
              <div key={i} className="rounded border border-gray-100 dark:border-gray-700 p-2">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate">{m.transcriptTitle}</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed">
                  <mark className="bg-red-100 dark:bg-red-900/30 rounded-sm px-0.5">{m.text}</mark>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ComputedNodeShell>
  );
}
