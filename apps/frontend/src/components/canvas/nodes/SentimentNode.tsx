import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode, CanvasQuestion, CanvasTranscript, SentimentConfig, SentimentResult } from '@canvas-app/shared';

export interface SentimentNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

export default function SentimentNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as SentimentNodeData;
  const { activeCanvas, updateComputedNode } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);
  const [editing, setEditing] = useState(false);
  const [scope, setScope] = useState<'all' | 'question' | 'transcript'>('all');
  const [scopeId, setScopeId] = useState('');

  if (!node) return null;
  const config = node.config as unknown as SentimentConfig;
  const result = node.result as unknown as SentimentResult;
  const questions = activeCanvas?.questions ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];

  const handleSaveConfig = () => {
    updateComputedNode(node.id, { config: { scope, scopeId: scopeId || undefined } as any });
    setEditing(false);
  };

  const icon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
    </svg>
  );

  const overallData = result?.overall
    ? [
        { name: 'Positive', value: result.overall.positive, fill: '#10B981' },
        { name: 'Negative', value: result.overall.negative, fill: '#EF4444' },
        { name: 'Neutral', value: result.overall.neutral, fill: '#9CA3AF' },
      ]
    : [];

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={node.id}
      label={node.label}
      icon={icon}
      color="#F59E0B"
      onConfigure={() => {
        setScope(config?.scope || 'all');
        setScopeId(config?.scopeId || '');
        setEditing(true);
      }}
      selected={selected}
      collapsed={(data as any).collapsed}
      zoomLevel={(data as any).zoomLevel}
    >
      {editing && (
        <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500">Scope:</label>
            <select className="input h-7 text-xs flex-1" value={scope} onChange={e => { setScope(e.target.value as any); setScopeId(''); }}>
              <option value="all">All Codings</option>
              <option value="question">By Question</option>
              <option value="transcript">By Transcript</option>
            </select>
          </div>
          {scope === 'question' && (
            <select className="input h-7 text-xs w-full" value={scopeId} onChange={e => setScopeId(e.target.value)}>
              <option value="">All questions</option>
              {questions.map((q: CanvasQuestion) => (
                <option key={q.id} value={q.id}>{q.text.slice(0, 40)}</option>
              ))}
            </select>
          )}
          {scope === 'transcript' && (
            <select className="input h-7 text-xs w-full" value={scopeId} onChange={e => setScopeId(e.target.value)}>
              <option value="">All transcripts</option>
              {transcripts.map((t: CanvasTranscript) => (
                <option key={t.id} value={t.id}>{t.title.slice(0, 40)}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button onClick={handleSaveConfig} className="btn-primary h-7 px-2 text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="px-3 py-2">
        {!result?.overall ? (
          <p className="text-xs text-gray-400 text-center py-4">Click Run to analyze sentiment.</p>
        ) : (
          <>
            {/* Overall bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                <span>Avg score: <strong className={result.overall.averageScore >= 0 ? 'text-green-600' : 'text-red-600'}>{result.overall.averageScore.toFixed(2)}</strong></span>
                <span>{result.overall.positive + result.overall.negative + result.overall.neutral} segments</span>
              </div>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overallData}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                      {overallData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Per-item breakdown */}
            {result.items?.length > 0 && (
              <div className="max-h-[120px] overflow-y-auto space-y-1">
                {result.items.slice(0, 15).map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-[10px]">
                    <span className={`font-mono w-8 text-right ${item.score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.score >= 0 ? '+' : ''}{item.score.toFixed(1)}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ComputedNodeShell>
  );
}
