import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useCanvasStore } from '../../../stores/canvasStore';
import ConfirmDialog from '../ConfirmDialog';

interface ComputedNodeShellProps {
  nodeId: string;
  computedNodeId: string;
  label: string;
  icon: ReactNode;
  color: string;
  children: ReactNode;
  selected?: boolean;
  collapsed?: boolean;
  zoomLevel?: number;
  onConfigure?: () => void;
}

export default function ComputedNodeShell({
  nodeId,
  computedNodeId,
  label,
  icon,
  color,
  children,
  selected,
  collapsed: collapsedProp,
  zoomLevel: zoomLevelProp,
  onConfigure,
}: ComputedNodeShellProps) {
  const { runComputedNode, deleteComputedNode } = useCanvasStore();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState(collapsedProp ?? false);

  const isZoomedOut = (zoomLevelProp ?? 100) < 30;

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      await runComputedNode(computedNodeId);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Computation failed';
      setError(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={`min-w-[280px] w-full h-full rounded-xl border-2 shadow-node transition-all duration-200 hover:shadow-node-hover ${selected ? 'ring-2 ring-blue-400' : ''}`} style={{ borderColor: color }}>
      <NodeResizer
        minWidth={280}
        minHeight={collapsed ? 44 : 100}
        lineClassName="!border-indigo-400/50"
        handleClassName="!w-2 !h-2 !bg-indigo-400 !border-indigo-500"
        isVisible={selected}
      />

      <Handle
        type="target"
        position={Position.Left}
        id={`computed-target-${nodeId}`}
        className="!h-3 !w-3 !border-2 transition-all duration-200"
        style={{ borderColor: color, backgroundColor: color, top: '50%' }}
      />

      {/* Header */}
      <div
        className="drag-handle flex items-center justify-between rounded-t-lg px-3 py-2.5 cursor-grab active:cursor-grabbing"
        style={{ background: `linear-gradient(135deg, ${color}12, ${color}08)` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color }}>{icon}</span>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{label}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`h-3.5 w-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          {onConfigure && (
            <button
              onClick={onConfigure}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Configure"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={running}
            className="rounded p-0.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400 disabled:opacity-50"
            title="Run computation"
          >
            {running ? (
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete node"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body - collapsible */}
      {!collapsed && !isZoomedOut && (
        <div className="bg-white dark:bg-gray-800 rounded-b-xl nodrag nowheel">
          {error && (
            <div className="px-3 py-1.5 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          {children}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && createPortal(
        <ConfirmDialog
          title={`Delete ${label}`}
          message={`Delete the "${label}" analysis node? This cannot be undone.`}
          onConfirm={() => { setShowDeleteConfirm(false); deleteComputedNode(computedNodeId); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />,
        document.body,
      )}
    </div>
  );
}
