import { useState, useEffect, useRef, useCallback } from 'react';
import { canvasApi } from '../../../services/api';
import { useActiveCanvasId } from '../../../stores/canvasStore';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import ConfirmDialog from '../ConfirmDialog';
import type { CanvasShare } from '@qualcanvas/shared';
import toast from 'react-hot-toast';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { useSeatCharge } from '../../../hooks/useSeatCharge';
import { formatMoney, seatsApi, type SeatStatus } from '../../../services/seatsApi';

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

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const validDate = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

function readRows<T>(envelope: unknown, valid: (row: unknown) => boolean): T[] {
  if (!record(envelope) || envelope.success !== true || !Array.isArray(envelope.data) || !envelope.data.every(valid)) {
    throw new Error('Unverified sharing response');
  }
  return envelope.data as T[];
}

function validShare(row: unknown, canvasId: string): boolean {
  return (
    record(row) &&
    nonEmpty(row.id) &&
    row.canvasId === canvasId &&
    nonEmpty(row.shareCode) &&
    typeof row.cloneCount === 'number' &&
    Number.isSafeInteger(row.cloneCount) &&
    row.cloneCount >= 0 &&
    validDate(row.createdAt) &&
    (row.expiresAt == null || validDate(row.expiresAt))
  );
}

function validCollaborator(row: unknown, canvasId: string): boolean {
  return (
    record(row) &&
    nonEmpty(row.id) &&
    nonEmpty(row.userId) &&
    row.canvasId === canvasId &&
    (row.role === 'editor' || row.role === 'viewer') &&
    typeof row.userName === 'string' &&
    typeof row.userEmail === 'string'
  );
}

export default function ShareCanvasModal({ onClose }: Props) {
  // Keep Tab inside the dialog and give focus back to the trigger on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const activeCanvasId = useActiveCanvasId();
  const [shares, setShares] = useState<CanvasShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareError, setShareError] = useState(false);
  const [collaboratorLoading, setCollaboratorLoading] = useState(true);
  const [collaboratorError, setCollaboratorError] = useState(false);
  const [readCanvasId, setReadCanvasId] = useState<string | null>(null);
  const shareRead = useRef(0);
  const collaboratorRead = useRef(0);
  const [generating, setGenerating] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);
  const [seatStatus, setSeatStatus] = useState<SeatStatus | null>(null);
  const { withSeat, seatDialog } = useSeatCharge();

  useEscapeToClose(onClose);

  const loadShares = useCallback(async () => {
    if (!activeCanvasId) return;
    const request = ++shareRead.current;
    setLoading(true);
    setShareError(false);
    try {
      const res = await canvasApi.getShares(activeCanvasId);
      const rows = readRows<CanvasShare>(res.data, (row) => validShare(row, activeCanvasId));
      if (request === shareRead.current) setShares(rows);
    } catch {
      if (request === shareRead.current) setShareError(true);
    } finally {
      if (request === shareRead.current) setLoading(false);
    }
  }, [activeCanvasId]);

  const loadCollaborators = useCallback(async () => {
    if (!activeCanvasId) return;
    const request = ++collaboratorRead.current;
    setCollaboratorLoading(true);
    setCollaboratorError(false);
    try {
      const res = await canvasApi.getCollaborators(activeCanvasId);
      const rows = readRows<CollaboratorInfo>(res.data, (row) => validCollaborator(row, activeCanvasId));
      if (request === collaboratorRead.current) setCollaborators(rows);
    } catch {
      if (request === collaboratorRead.current) setCollaboratorError(true);
    } finally {
      if (request === collaboratorRead.current) setCollaboratorLoading(false);
    }
  }, [activeCanvasId]);

  useEffect(() => {
    let current = true;
    // Only owners billed per seat get the seat note; anyone else (a
    // collaborator, a legacy access code) just gets no note.
    Promise.resolve()
      .then(() => seatsApi.get())
      .then((res) => {
        if (current) setSeatStatus(res.data.data);
      })
      .catch(() => {
        if (current) setSeatStatus(null);
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    const shareRequests = shareRead;
    const collaboratorRequests = collaboratorRead;
    setReadCanvasId(activeCanvasId);
    setShares([]);
    setCollaborators([]);
    setInviteEmail('');
    setInviteRole('editor');
    setConfirmRevokeId(null);
    setConfirmRemoveUserId(null);
    loadShares();
    loadCollaborators();
    return () => {
      shareRequests.current++;
      collaboratorRequests.current++;
    };
  }, [activeCanvasId, loadShares, loadCollaborators]);

  const currentScope = Boolean(activeCanvasId && readCanvasId === activeCanvasId);
  const sharesReady = currentScope && !loading && !shareError;
  const collaboratorsReady = currentScope && !collaboratorLoading && !collaboratorError;

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!activeCanvasId || !email || !collaboratorsReady || inviting) return;
    setInviting(true);
    try {
      // A coder may need a paid seat (Team) or, on Pro, the Team plan: the
      // server answers 402 with a quote, the owner confirms it (or chooses to
      // add a viewer instead), and only then is anyone charged.
      const data = { email, role: inviteRole };
      let sentRole: 'editor' | 'viewer' = inviteRole;
      const added = await withSeat(
        (c) => {
          if (c && 'role' in c) sentRole = c.role;
          return canvasApi.addCollaborator(activeCanvasId, c ? { ...data, ...c } : data);
        },
        {
          reason: `Inviting ${email} as a coder`,
          confirmLabel: 'Add seat and invite',
          viewerFallback: true,
        },
      );
      if (added === null) return; // owner cancelled the charge
      setInviteEmail('');
      toast.success(
        sentRole === 'viewer'
          ? 'Viewer invited — they can open this canvas but not change it'
          : 'Coder invited — this canvas now appears in their canvas list',
      );
      loadCollaborators();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to invite coder');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCollaborator = async () => {
    if (!activeCanvasId || !confirmRemoveUserId || !collaboratorsReady) return;
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
    if (!activeCanvasId || !sharesReady || generating) return;
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
    if (!activeCanvasId || !sharesReady) return;
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
      ref={dialogRef}
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share Canvas"
    >
      <div
        className="modal-content flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-6" role="region" aria-label="Sharing options" tabIndex={0}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Share Canvas</h3>

          {/* Invite coders — live collaboration on THIS canvas */}
          <div className="mt-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Invite a coder</h4>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Coders work on this same canvas with you. Their coding is saved under their own name, so you can compare
              coders with Intercoder Agreement.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInvite();
                }}
                placeholder="colleague@university.edu"
                aria-label="Coder's email address"
                className="input h-9 min-w-0 flex-1 basis-40 text-sm"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                aria-label="Access level"
                className="input h-9 w-32 text-sm"
              >
                <option value="editor">Coder</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim() || !collaboratorsReady}
                className="btn-primary h-9 px-4 text-sm disabled:opacity-50"
              >
                {inviting ? 'Inviting...' : 'Invite'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              Coders can code alongside you. Viewers can look but not change anything.
            </p>
            {(seatStatus?.mode === 'solo' || seatStatus?.mode === 'trial') && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300" data-testid="share-seat-note">
                Pro is a one-person plan: viewers are free and unlimited. To add coders, upgrade to Team; you see the
                price and confirm it first.
              </p>
            )}
            {seatStatus?.mode === 'billed' && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300" data-testid="share-seat-note">
                Each coder uses a paid seat
                {seatStatus.price?.unitAmount != null
                  ? ` (${formatMoney(seatStatus.price.unitAmount, seatStatus.price.currency)} / ${seatStatus.price.interval === 'year' ? 'year' : 'month'})`
                  : ''}
                ; you confirm the charge before it happens. Viewers are free.
              </p>
            )}
            {collaboratorLoading && (
              <p role="status" className="mt-2 text-sm">
                Loading collaborators...
              </p>
            )}
            {collaboratorError && (
              <div
                role="alert"
                aria-label="Collaborators could not be verified"
                className="mt-2 text-sm text-red-700 dark:text-red-300"
              >
                <p>
                  Could not load collaborators. Check your connection and retry. Your email entry is kept; retry does
                  not invite anyone.
                </p>
                <button type="button" onClick={loadCollaborators} className="btn-secondary mt-2 text-sm">
                  Retry loading collaborators
                </button>
              </div>
            )}
            {collaboratorsReady && collaborators.length === 0 && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                No collaborators yet. Invite someone with a QualCanvas account, or keep working on your own.
              </p>
            )}
            {currentScope && collaborators.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {collaborators.map((c) => (
                  <div
                    key={c.userId}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-800 dark:text-gray-200">
                        {c.userName}
                        <span
                          className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium align-middle ${
                            c.role === 'viewer'
                              ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                              : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300'
                          }`}
                        >
                          {c.role === 'viewer' ? 'Viewer' : 'Coder'}
                        </span>
                      </p>
                      <p className="truncate text-xs text-gray-600 dark:text-gray-300">{c.userEmail}</p>
                    </div>
                    <button
                      onClick={() => setConfirmRemoveUserId(c.userId)}
                      disabled={!collaboratorsReady}
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

            <button
              onClick={handleGenerate}
              disabled={generating || !sharesReady}
              className="btn-primary mt-3 w-full text-sm"
            >
              {generating ? 'Generating...' : 'Generate Share Code'}
            </button>
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Share Codes</h4>
            {loading && (
              <div role="status" className="py-4 text-center text-sm text-gray-600 dark:text-gray-300">
                Loading...
              </div>
            )}
            {shareError && (
              <div
                role="alert"
                aria-label="Share codes could not be verified"
                className="mt-2 text-sm text-red-700 dark:text-red-300"
              >
                <p>
                  Could not load share codes. Check your connection and retry. Retry only checks existing codes; it does
                  not create or revoke one.
                </p>
                <button type="button" onClick={loadShares} className="btn-secondary mt-2 text-sm">
                  Retry loading share codes
                </button>
              </div>
            )}
            {sharesReady && shares.length === 0 && (
              <div className="py-4 text-center text-sm text-gray-600 dark:text-gray-300">No share codes yet</div>
            )}
            {currentScope && shares.length > 0 && (
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
                          aria-label={`Copy share code ${share.shareCode}`}
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
                      <div className="mt-1 flex gap-3 text-xs text-gray-600 dark:text-gray-300">
                        <span>
                          {share.cloneCount} clone{share.cloneCount !== 1 ? 's' : ''}
                        </span>
                        <span>Created {new Date(share.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmRevokeId(share.id)}
                      disabled={!sharesReady}
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

        <div className="shrink-0 px-6 pb-4 text-sm text-gray-600 dark:text-gray-300">
          <a href="/help/sharing.html" target="_blank" rel="noopener noreferrer" className="underline">
            Read the sharing guide
          </a>
          <p className="mt-2">
            Want help choosing the right way to share? Email{' '}
            <a href="mailto:support@qualcanvas.com?subject=Help%20with%20sharing" className="underline">
              support@qualcanvas.com
            </a>
            . We reply within two business days; no call is needed. Please do not send participant data or transcripts.
          </p>
        </div>

        <div className="flex shrink-0 justify-end border-t border-gray-200 px-6 py-4 dark:border-gray-700">
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
        {seatDialog}
      </div>
    </div>
  );
}
