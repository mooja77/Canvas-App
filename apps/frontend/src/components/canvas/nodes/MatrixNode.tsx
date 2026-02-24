import type { NodeProps } from '@xyflow/react';
import ComputedNodeShell from './ComputedNodeShell';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasComputedNode, CanvasQuestion, MatrixResult } from '@canvas-app/shared';

export interface MatrixNodeData {
  computedNodeId: string;
  [key: string]: unknown;
}

export default function MatrixNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as MatrixNodeData;
  const { activeCanvas } = useCanvasStore();
  const node = activeCanvas?.computedNodes.find((n: CanvasComputedNode) => n.id === nodeData.computedNodeId);

  if (!node) return null;
  const result = node.result as unknown as MatrixResult;
  const questions = activeCanvas?.questions ?? [];
  const questionMap = new Map(questions.map((q: CanvasQuestion) => [q.id, q]));

  const icon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
    </svg>
  );

  return (
    <ComputedNodeShell nodeId={id} computedNodeId={node.id} label={node.label} icon={icon} color="#D97706" selected={selected} collapsed={(data as any).collapsed} zoomLevel={(data as any).zoomLevel}>
      <div className="max-h-[300px] overflow-auto px-2 py-2">
        {!result?.rows?.length ? (
          <p className="text-xs text-gray-400 text-center py-4">
            Assign transcripts to cases, then click Run.
          </p>
        ) : (
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="text-left p-1 text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-800">Case</th>
                {result.rows[0]?.cells.map(cell => {
                  const q = questionMap.get(cell.questionId);
                  return (
                    <th key={cell.questionId} className="p-1 text-center" title={q?.text}>
                      <div className="h-2 w-2 rounded-full mx-auto" style={{ backgroundColor: q?.color || '#6B7280' }} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {result.rows.map(row => (
                <tr key={row.caseId} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="p-1 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 truncate max-w-[80px]">
                    {row.caseName}
                  </td>
                  {row.cells.map(cell => (
                    <td key={cell.questionId} className="p-1 text-center text-gray-600 dark:text-gray-400" title={cell.excerpts.join('; ')}>
                      {cell.count > 0 ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          {cell.count}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ComputedNodeShell>
  );
}
