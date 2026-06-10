import { useState, useEffect } from 'react';
import { canvasApi } from '../../../services/api';
import { useActiveCanvasId } from '../../../stores/canvasStore';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import ConfirmDialog from '../ConfirmDialog';
import type { CanvasShare } from '@qualcanvas/shared';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

interface CollaboratorInfo {
  id: string;
  userId: string;
  role: string;
  userName: string;
  userEmail: string;
}

export default function ShareCanvasModal({ onClose }: Props) {
  const activeCanvasId = useActiveCanvasId();
  const [shares, setShares] = useState<CanvasShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);

  useEscapeToClose(onClose);

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

  const loadCollaborators = async () => {
    if (!activeCanvasId) return;
    try {
      const res = await canvasApi.getCollaborators(activeCanvasId);
      setCollaborators(res.data.data || []);
    } catch {
      // Legacy access-code accounts can't manage collaborators — keep the
      // section in its empty state rather than toasting on open.
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- loaders are not memoized, activeCanvasId is the true trigger
  useEffect(() => {
    loadShares();
    loadCollaborators();
  }, [activeCanvasId]);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!activeCanvasId || !email) return;
    setInviting(true);
    try {
      await canvasApi.addCollaborator(activeCanvasId, { email, role: 'editor' });
      setInviteEmail('');
      toast.success('Coder invited — this canvas now appears in their canvas list');
      loadCollaborators();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to invite coder');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCollaborator = async () => {
    if (!activeCanvasId || !confirmRemoveUserId) return;
    try {
      await canvasApi.removeCollaborator(activeCanvasId, confirmRemoveUserId);
      toast.success('Coder removed');
      loadCollaborators();
    } catch {
      toast.error('Failed to remove coder');
    } finally {
      setConfirmRemoveUserId(null);
    }
  };

  const handleGenerate = async () => {
    if (!activeCanvasId) return;
    setGenerating(true);
    try {
      const res = await canvasApi.shareCanvas(activeCanvasId);
      const newShare = res.data.data;
      setShares((prev) => [newShare, ...prev]);
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
      setShares((prev) => prev.filter((s) => s.id !== shareId));
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
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share Canvas"
    >
      <div
        className="modal-content w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Share Canvas</h3>

          {/* Invite coders — live collaboration on THIS canvas */}
          <div className="mt-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Invite a coder</h4>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Coders work on this same canvas with you. Their coding is saved under their own name, so you can compare
              coders with Intercoder Agreement.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInvite();
                }}
                placeholder="colleague@university.edu"
                aria-label="Coder's email address"
                className="input h-9 flex-1 text-sm"
              />
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="btn-primary h-9 px-4 text-sm disabled:opacity-50"
              >
                {inviting ? 'Inviting...' : 'Invite'}
              </button>
            </div>
            {collaborators.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {collaborators.map((c) => (
                  <div
                    key={c.userId}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-800 dark:text-gray-200">{c.userName}</p>
                      <p className="truncate text-[11px] text-gray-400">{c.userEmail}</p>
                    </div>
                    <button
                      onClick={() => setConfirmRemoveUserId(c.userId)}
                      className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      title="Remove coder"
                      aria-label={`Remove coder ${c.userName}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Share a copy</h4>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Generate a share code that others can use to clone your canvas as a starting point. Clones are independent
              — changes don&apos;t sync back.
            </p>

            <button onClick={handleGenerate} disabled={generating} className="btn-primary mt-3 w-full text-sm">
              {generating ? 'Generating...' : 'Generate Share Code'}
            </button>
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Share Codes</h4>
            {loading ? (
              <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
            ) : shares.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-400">No share codes yet</div>
            ) : (
              <div className="mt-2 space-y-2">
                {shares.map((share) => (
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
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-1 flex gap-3 text-[10px] text-gray-400">
                        <span>
                          {share.cloneCount} clone{share.cloneCount !== 1 ? 's' : ''}
                        </span>
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary text-sm">
            Close
          </button>
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

        {confirmRemoveUserId && (
          <ConfirmDialog
            title="Remove Coder"
            message="Remove this coder from the canvas? Their existing coding stays, but they will no longer be able to open it."
            confirmLabel="Remove"
            onConfirm={handleRemoveCollaborator}
            onCancel={() => setConfirmRemoveUserId(null)}
          />
        )}
      </div>
    </div>
  );
}
