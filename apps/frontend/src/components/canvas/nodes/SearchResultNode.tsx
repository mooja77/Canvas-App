import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode, SearchConfig, SearchResult } from '@canvas-app/shared';

export interface SearchResultNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

export default function SearchResultNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as SearchResultNodeData;
  const { activeCanvas, updateComputedNode } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);
  const [editing, setEditing] = useState(false);
  const [pattern, setPattern] = useState((node?.config as unknown as SearchConfig)?.pattern || '');
  const [mode, setMode] = useState<'keyword' | 'regex'>((node?.config as unknown as SearchConfig)?.mode || 'keyword');

  if (!node) return null;
  const config = node.config as unknown as SearchConfig;
  const result = node.result as unknown as SearchResult;

  const handleSaveConfig = () => {
    updateComputedNode(node.id, { config: { ...config, pattern, mode } });
    setEditing(false);
  };

  const icon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );

  return (
    <ComputedNodeShell
      nodeId={id}
      computedNodeId={node.id}
      label={node.label}
      icon={icon}
      color="#059669"
      onConfigure={() => { setPattern(config?.pattern || ''); setMode(config?.mode || 'keyword'); setEditing(true); }}
      selected={selected}
      collapsed={(data as any).collapsed}
      zoomLevel={(data as any).zoomLevel}
    >
      {editing && (
        <div className="border-b border-gray-100 dark:border-gray-700 px-3 py-2 space-y-2">
          <input
            type="text"
            className="input h-7 w-full text-xs"
            placeholder="Search pattern..."
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveConfig()}
          />
          <div className="flex items-center gap-2">
            <select
              className="input h-7 text-xs flex-1"
              value={mode}
              onChange={e => setMode(e.target.value as 'keyword' | 'regex')}
            >
              <option value="keyword">Keyword</option>
              <option value="regex">Regex</option>
            </select>
            <button onClick={handleSaveConfig} className="btn-primary h-7 px-2 text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="max-h-[250px] overflow-y-auto px-3 py-2">
        {!result?.matches?.length ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            {config?.pattern ? 'No matches found. Click Run to search.' : 'Configure a search pattern and click Run.'}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
            </p>
            {result.matches.slice(0, 20).map((m, i) => (
              <div key={i} className="rounded border border-gray-100 dark:border-gray-700 p-2">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate">{m.transcriptTitle}</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed">
                  {m.context.split(m.matchText).map((part, j, arr) => (
                    <span key={j}>
                      {part}
                      {j < arr.length - 1 && (
                        <mark className="bg-emerald-200 dark:bg-emerald-800 rounded-sm px-0.5">{m.matchText}</mark>
                      )}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ComputedNodeShell>
  );
}
