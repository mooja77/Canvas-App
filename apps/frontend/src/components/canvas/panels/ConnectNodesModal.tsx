import { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { useActiveCanvas, useCanvasStore } from '../../../stores/canvasStore';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { apiErrorMessage } from '../../../services/api';

export interface ConnectNodesModalProps {
  onClose: () => void;
  /** Optional React Flow node id such as "question-abc" or "case-xyz" to pre-select as source. */
  initialFromNodeId?: string | null;
}

interface ConnectableNode {
  key: string;
  type: 'question' | 'case';
  id: string;
  label: string;
  kindLabel: string;
}

const PRESET_GROUPS: { category: string; relations: string[] }[] = [
  { category: 'Causal', relations: ['causes', 'leads to', 'results in', 'triggers'] },
  { category: 'Logical', relations: ['supports', 'contradicts', 'explains', 'justifies'] },
  { category: 'Structural', relations: ['is part of', 'contains', 'is type of'] },
  { category: 'Associative', relations: ['is associated with', 'co-occurs with', 'contrasts with'] },
  { category: 'Temporal', relations: ['precedes', 'follows', 'evolves into'] },
];

function parseInitialNodeKey(initialFromNodeId?: string | null): string | null {
  if (!initialFromNodeId) return null;
  if (initialFromNodeId.startsWith('question-')) {
    return `question:${initialFromNodeId.slice('question-'.length)}`;
  }
  if (initialFromNodeId.startsWith('case-')) {
    return `case:${initialFromNodeId.slice('case-'.length)}`;
  }
  return null;
}

export default function ConnectNodesModal({ onClose, initialFromNodeId }: ConnectNodesModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  const activeCanvas = useActiveCanvas();
  const addRelation = useCanvasStore((s) => s.addRelation);
  const deleteRelation = useCanvasStore((s) => s.deleteRelation);
  const isViewer = activeCanvas?.myRole === 'viewer';

  const connectableNodes = useMemo<ConnectableNode[]>(() => {
    if (!activeCanvas) return [];
    const items: ConnectableNode[] = [];
    for (const q of activeCanvas.questions) {
      items.push({
        key: `question:${q.id}`,
        type: 'question',
        id: q.id,
        label: q.text,
        kindLabel: 'Code',
      });
    }
    for (const c of activeCanvas.cases) {
      items.push({
        key: `case:${c.id}`,
        type: 'case',
        id: c.id,
        label: c.name,
        kindLabel: 'Case',
      });
    }
    return items;
  }, [activeCanvas]);

  const nodeByKey = useMemo(() => {
    const map = new Map<string, ConnectableNode>();
    for (const n of connectableNodes) map.set(n.key, n);
    return map;
  }, [connectableNodes]);

  const initialFromKey = useMemo(() => {
    const parsed = parseInitialNodeKey(initialFromNodeId);
    if (parsed && connectableNodes.some((n) => n.key === parsed)) return parsed;
    return connectableNodes[0]?.key ?? '';
  }, [initialFromNodeId, connectableNodes]);

  const initialToKey = useMemo(() => {
    const other = connectableNodes.find((n) => n.key !== initialFromKey);
    return other?.key ?? '';
  }, [connectableNodes, initialFromKey]);

  const [fromKey, setFromKey] = useState(initialFromKey);
  const [toKey, setToKey] = useState(initialToKey);
  const [label, setLabel] = useState('related to');
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (fromKey && !nodeByKey.has(fromKey)) {
      setFromKey(connectableNodes[0]?.key ?? '');
    }
    if (toKey && !nodeByKey.has(toKey)) {
      const nextTo = connectableNodes.find((n) => n.key !== fromKey);
      setToKey(nextTo?.key ?? '');
    }
  }, [connectableNodes, nodeByKey, fromKey, toKey]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fromNode = nodeByKey.get(fromKey);
  const toNode = nodeByKey.get(toKey);
  const trimmedLabel = label.trim();
  const isSameNode = Boolean(fromKey && toKey && fromKey === toKey);
  const canSubmit = Boolean(!isViewer && fromNode && toNode && !isSameNode && trimmedLabel && !submitting);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !fromNode || !toNode) return;
    setSubmitting(true);
    setStatusMessage('');
    try {
      await addRelation(fromNode.type, fromNode.id, toNode.type, toNode.id, trimmedLabel);
      const message = `Connected "${fromNode.label}" to "${toNode.label}" (${trimmedLabel})`;
      setStatusMessage(message);
      toast.success(message);
    } catch (err) {
      const msg = apiErrorMessage(err, 'Could not connect nodes');
      setStatusMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveRelation = async (relId: string) => {
    if (isViewer || removingId) return;
    setRemovingId(relId);
    try {
      await deleteRelation(relId);
      setStatusMessage('Connection removed');
      toast.success('Connection removed');
    } catch (err) {
      const msg = apiErrorMessage(err, 'Could not remove connection');
      setStatusMessage(msg);
      toast.error(msg);
    } finally {
      setRemovingId(null);
    }
  };

  const relations = activeCanvas?.relations ?? [];

  return (
    <div
      ref={dialogRef}
      className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-nodes-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="connect-nodes-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Connect nodes
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Create or remove a relationship between codes and cases without dragging handles.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close connect nodes dialog"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {connectableNodes.length < 2 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
            Add at least two codes or cases to connect them.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="connect-from-node"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  From node
                </label>
                <select
                  id="connect-from-node"
                  value={fromKey}
                  onChange={(e) => setFromKey(e.target.value)}
                  className="input h-9 w-full text-xs"
                  disabled={isViewer}
                >
                  {connectableNodes.map((n) => (
                    <option key={n.key} value={n.key}>
                      {n.kindLabel}: {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="connect-to-node"
                  className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  To node
                </label>
                <select
                  id="connect-to-node"
                  value={toKey}
                  onChange={(e) => setToKey(e.target.value)}
                  className="input h-9 w-full text-xs"
                  disabled={isViewer}
                >
                  {connectableNodes.map((n) => (
                    <option key={n.key} value={n.key}>
                      {n.kindLabel}: {n.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isSameNode && (
              <p className="text-xs text-amber-700 dark:text-amber-400" role="alert">
                Choose two different nodes to create a connection.
              </p>
            )}

            <div>
              <label
                htmlFor="connect-relation-label"
                className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                Relationship label
              </label>
              <input
                id="connect-relation-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. causes, supports, is part of"
                className="input h-9 w-full text-xs"
                disabled={isViewer}
              />
              <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto pr-1">
                {PRESET_GROUPS.map((group) => (
                  <div key={group.category} className="flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {group.category}:
                    </span>
                    {group.relations.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setLabel(preset)}
                        disabled={isViewer}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          label === preset
                            ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-300'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50"
              >
                {submitting ? 'Connecting...' : 'Connect nodes'}
              </button>
            </div>
          </form>
        )}

        <div role="status" aria-live="polite" className="sr-only">
          {statusMessage}
        </div>

        {relations.length > 0 && (
          <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
              Existing connections ({relations.length})
            </h3>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {relations.map((rel) => {
                const src = nodeByKey.get(`${rel.fromType}:${rel.fromId}`);
                const tgt = nodeByKey.get(`${rel.toType}:${rel.toId}`);
                const srcName = src?.label ?? rel.fromId;
                const tgtName = tgt?.label ?? rel.toId;
                return (
                  <li
                    key={rel.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900/40"
                  >
                    <span className="min-w-0 truncate text-gray-700 dark:text-gray-200">
                      <span className="font-medium">{srcName}</span>{' '}
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {rel.label}
                      </span>{' '}
                      <span className="font-medium">{tgtName}</span>
                    </span>
                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRelation(rel.id)}
                        disabled={removingId === rel.id}
                        aria-label={`Remove connection from ${srcName} to ${tgtName}`}
                        className="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
