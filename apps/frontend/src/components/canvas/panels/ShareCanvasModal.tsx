import { useState, useEffect } from 'react';
import { canvasApi } from '../../../services/api';
import { useCanvasStore } from '../../../stores/canvasStore';
import ConfirmDialog from '../ConfirmDialog';
import type { CanvasShare } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export default function ShareCanvasModal({ onClose }: Props) {
  const { activeCanvasId } = useCanvasStore();
  const [shares, setShares] = useState<CanvasShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const loadShares = async () => {
    if (!activeCanvasId) return;
    try {
      const res = await canvasApi.getShares(activeCanvasId);
      setShares(res.data.data || []);
    } catch {
      toast.error('Failed to load share codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadShares(); }, [activeCanvasId]);

  const handleGenerate = async () => {
    if (!activeCanvasId) return;
    setGenerating(true);
    try {
      const res = await canvasApi.shareCanvas(activeCanvasId);
      const newShare = res.data.data;
      setShares(prev => [newShare, ...prev]);
      toast.success('Share code created');
    } catch {
      toast.error('Failed to generate share code');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!activeCanvasId) return;
    try {
      await canvasApi.revokeShare(activeCanvasId, shareId);
      setShares(prev => prev.filter(s => s.id !== shareId));
      toast.success('Share code revoked');
    } catch {
      toast.error('Failed to revoke share code');
    } finally {
      setConfirmRevokeId(null);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy — try selecting the code manually');
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-content w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Share Canvas</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Generate a share code that others can use to clone your canvas as a starting point.
          </p>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary mt-4 w-full text-sm"
          >
            {generating ? 'Generating...' : 'Generate Share Code'}
          </button>

          <div className="mt-5">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Share Codes</h4>
            {loading ? (
              <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
            ) : shares.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-400">No share codes yet</div>
            ) : (
              <div className="mt-2 space-y-2">
                {shares.map(share => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-gray-100 px-2 py-0.5 text-sm font-mono font-bold text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {share.shareCode}
                        </code>
                        <button
                          onClick={() => copyToClipboard(share.shareCode)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                          title="Copy to clipboard"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-1 flex gap-3 text-[10px] text-gray-400">
                        <span>{share.cloneCount} clone{share.cloneCount !== 1 ? 's' : ''}</span>
                        <span>Created {new Date(share.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmRevokeId(share.id)}
                      className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      title="Revoke share code"
                      aria-label="Revoke share code"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary text-sm">Close</button>
        </div>

        {confirmRevokeId && (
          <ConfirmDialog
            title="Revoke Share Code"
            message="Revoke this share code? Anyone with the code will no longer be able to clone this canvas."
            confirmLabel="Revoke"
            onConfirm={() => handleRevoke(confirmRevokeId)}
            onCancel={() => setConfirmRevokeId(null)}
          />
        )}
      </div>
    </div>
  );
}
