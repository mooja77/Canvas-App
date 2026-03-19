import { useState, useCallback } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { CanvasDocument, DocumentRegionCoding, CanvasQuestion } from '@canvas-app/shared';

export interface DocumentNodeData {
  document: CanvasDocument;
  regions?: DocumentRegionCoding[];
  questions?: CanvasQuestion[];
  collapsed?: boolean;
  zoomTier?: 'full' | 'reduced' | 'minimal';
  customColor?: string;
  [key: string]: unknown;
}

export default function DocumentNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as DocumentNodeData;
  const { document: doc, regions = [], questions = [], collapsed, zoomTier, customColor } = nodeData;
  const [currentPage, setCurrentPage] = useState(1);

  const pageRegions = regions.filter(r => r.pageNumber === currentPage);

  const getQuestionColor = useCallback((questionId: string) => {
    const q = questions.find(q => q.id === questionId);
    return q?.color || '#3B82F6';
  }, [questions]);

  if (zoomTier === 'minimal') {
    return (
      <div className={`px-2 py-1 rounded text-xs font-medium truncate max-w-[120px] border ${
        selected ? 'ring-2 ring-blue-500' : ''
      }`} style={{ borderColor: customColor || '#6366F1', backgroundColor: `${customColor || '#6366F1'}20` }}>
        <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5" />
        <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5" />
        {doc.title}
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 transition-shadow ${
        selected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-lg'
      }`}
      style={{
        borderColor: customColor || '#6366F1',
        minWidth: 250,
        maxWidth: 500,
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={250}
        minHeight={100}
        lineClassName="!border-blue-400"
        handleClassName="!w-2 !h-2 !bg-blue-500 !border-blue-500"
      />
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-indigo-500" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-indigo-500" />

      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between gap-2 rounded-t-lg"
        style={{ backgroundColor: `${customColor || '#6366F1'}15` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">
            {doc.docType === 'pdf' ? '\uD83D\uDCC4' : '\uD83D\uDDBC\uFE0F'}
          </span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
            {doc.title}
          </h3>
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {doc.docType.toUpperCase()}
          {doc.pageCount > 1 && ` (${doc.pageCount} pages)`}
        </span>
      </div>

      {/* Content area */}
      {!collapsed && (
        <div className="p-3">
          {/* Document viewer placeholder with region overlays */}
          <div className="relative bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 min-h-[200px] flex items-center justify-center">
            <span className="text-gray-400 dark:text-gray-500 text-sm">
              Document Preview
            </span>

            {/* Region coding overlays */}
            {pageRegions.map(region => (
              <div
                key={region.id}
                className="absolute border-2 rounded-sm cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.width}%`,
                  height: `${region.height}%`,
                  borderColor: getQuestionColor(region.questionId),
                  backgroundColor: `${getQuestionColor(region.questionId)}20`,
                }}
                title={region.note || 'Region coding'}
              />
            ))}
          </div>

          {/* Page navigation for multi-page documents */}
          {doc.pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded disabled:opacity-50"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Page {currentPage} / {doc.pageCount}
              </span>
              <button
                className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded disabled:opacity-50"
                disabled={currentPage >= doc.pageCount}
                onClick={() => setCurrentPage(p => Math.min(doc.pageCount, p + 1))}
              >
                Next
              </button>
            </div>
          )}

          {/* Region coding count */}
          {regions.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {regions.length} region{regions.length !== 1 ? 's' : ''} coded
              {pageRegions.length !== regions.length && ` (${pageRegions.length} on this page)`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
