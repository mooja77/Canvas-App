import { useState, useMemo, useEffect } from 'react';
import { useActiveCanvas } from '../../../stores/canvasStore';
import { useAuthStore } from '../../../stores/authStore';
import { canvasApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { getParadigm, getIcrStance } from '../../../data/methodologyParadigms';
import { chooseAgreementMethod } from './agreementMethod';

interface IntercoderPanelProps {
  onClose: () => void;
}

interface AgreementResult {
  method: string;
  alpha: number;
  nCoders: number;
  nUnits: number;
  nObservations: number;
  nSegments: number;
}

interface Coder {
  id: string;
  name: string;
  email: string;
}

// α and κ share the same conventional agreement bands.
function interpretScore(k: number): { label: string; color: string } {
  if (k < 0) return { label: 'Poor', color: '#EF4444' };
  if (k <= 0.2) return { label: 'Slight', color: '#F97316' };
  if (k <= 0.4) return { label: 'Fair', color: '#F59E0B' };
  if (k <= 0.6) return { label: 'Moderate', color: '#EAB308' };
  if (k <= 0.8) return { label: 'Substantial', color: '#22C55E' };
  return { label: 'Almost Perfect', color: '#10B981' };
}

export default function IntercoderPanel({ onClose }: IntercoderPanelProps) {
  useEscapeToClose(onClose);
  const activeCanvas = useActiveCanvas();
  const currentUserId = useAuthStore((s) => s.userId);
  const currentUserEmail = useAuthStore((s) => s.email);

  // Surface methodological guidance: ICR is inappropriate for interpretivist
  // paradigms (reflexive TA, IPA, …) where coder divergence is interpretation,
  // not error. Read from the canvas's chosen paradigm (Methodology wizard).
  const paradigmKey = activeCanvas?.researchParadigm ?? null;
  const paradigm = paradigmKey ? getParadigm(paradigmKey) : undefined;
  const icrStance = getIcrStance(paradigmKey);

  const [selectedCoderIds, setSelectedCoderIds] = useState<string[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState('');
  const [result, setResult] = useState<AgreementResult | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasId = activeCanvas?.id;
  const transcripts = activeCanvas?.transcripts ?? [];

  // Coders = the current user ("You") plus any collaborators on the canvas.
  // Codings are attributed by coderUserId (migration 0031), so a genuine ≥2-coder
  // agreement statistic can be computed across the selected people.
  const [collaborators, setCollaborators] = useState<Coder[]>([]);

  useEffect(() => {
    if (!canvasId) return;
    let cancelled = false;
    canvasApi
      .getCollaborators(canvasId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data.data || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users: Coder[] = data.map((c: any) => ({
          id: c.userId || c.user?.id || c.id,
          name: c.user?.name || c.name || 'Unknown',
          email: c.user?.email || c.email || '',
        }));
        setCollaborators(users);
      })
      .catch(() => {
        /* no collaborators / not permitted — leave list empty */
      });
    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  const coders: Coder[] = useMemo(() => {
    const list: Coder[] = [];
    if (currentUserId) {
      list.push({ id: currentUserId, name: 'You', email: currentUserEmail ?? '' });
    }
    for (const c of collaborators) {
      if (c.id && c.id !== currentUserId) list.push(c);
    }
    return list;
  }, [currentUserId, currentUserEmail, collaborators]);

  const toggleCoder = (id: string) => {
    setResult(null);
    setSelectedCoderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const choice = chooseAgreementMethod(selectedCoderIds.length);

  const handleCompute = async () => {
    if (!canvasId || !selectedTranscriptId || !choice.canCompute) return;
    setComputing(true);
    try {
      const res = await canvasApi.computeMultiCoderAgreement(canvasId, {
        transcriptId: selectedTranscriptId,
        userIds: selectedCoderIds,
      });
      setResult(res.data.data);
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((err as any)?.response?.data?.error || 'Failed to compute intercoder agreement');
    } finally {
      setComputing(false);
    }
  };

  const interp = result ? interpretScore(result.alpha) : null;

  const handleExport = () => {
    if (!result) return;
    const names = selectedCoderIds.map((id) => coders.find((c) => c.id === id)?.name ?? id).join(', ');
    const transcriptTitle = transcripts.find((t) => t.id === selectedTranscriptId)?.title ?? selectedTranscriptId;
    const lines = [
      'Intercoder Agreement Report',
      `Method: ${result.method}`,
      `Coders (${result.nCoders}): ${names}`,
      `Transcript: ${transcriptTitle}`,
      '',
      `Score: ${result.alpha.toFixed(3)} (${interpretScore(result.alpha).label})`,
      `Coding units: ${result.nUnits}`,
      `Observations: ${result.nObservations}`,
      `Segments: ${result.nSegments}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intercoder-agreement-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="intercoder-panel-title"
        className="modal-content w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
          <div>
            <h3 id="intercoder-panel-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Intercoder Agreement
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Cohen&rsquo;s κ for two coders, Krippendorff&rsquo;s α for three or more
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Methodology guidance — ICR appropriateness depends on the paradigm. */}
        {paradigm && icrStance === 'inappropriate' && (
          <div className="mx-5 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
            <span className="font-semibold">Heads up — {paradigm.name}:</span> {paradigm.icrNote} You can still run a
            comparison below if you have a specific reason, but it isn&rsquo;t expected for this approach.
          </div>
        )}
        {paradigm && icrStance === 'expected' && (
          <div className="mx-5 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300">
            <span className="font-semibold">{paradigm.name}:</span> {paradigm.icrNote}
          </div>
        )}

        {/* Config */}
        <div className="border-b border-gray-100 dark:border-gray-700/50 px-5 py-3 space-y-3">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
              Coders to compare
            </label>
            <div className="flex flex-wrap gap-2">
              {coders.map((c) => {
                const checked = selectedCoderIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleCoder(c.id)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      checked
                        ? 'border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
              {choice.canCompute ? `${selectedCoderIds.length} selected — ${choice.label}` : choice.label}
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Transcript</label>
              <select
                value={selectedTranscriptId}
                onChange={(e) => {
                  setSelectedTranscriptId(e.target.value);
                  setResult(null);
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="">Select transcript...</option>
                {transcripts.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCompute}
              disabled={!choice.canCompute || !selectedTranscriptId || computing}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {computing ? 'Computing...' : 'Compute agreement'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!result ? (
            <div className="py-12 text-center">
              <svg
                className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                />
              </svg>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {coders.length < 2
                  ? 'Add collaborators to this canvas to compare coders.'
                  : 'Select two or more coders and a transcript, then click "Compute agreement".'}
              </p>
            </div>
          ) : (
            <>
              {/* Score */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">{result.method}</div>
                <div className="text-3xl font-bold" style={{ color: interp!.color }}>
                  {result.alpha.toFixed(3)}
                </div>
                <div
                  className="mt-1 inline-block rounded-full px-3 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: interp!.color + '20', color: interp!.color }}
                >
                  {interp!.label} Agreement
                </div>
                <div className="mt-3 flex justify-center gap-6 text-[10px] text-gray-500 dark:text-gray-400">
                  <span>
                    Coders: <strong>{result.nCoders}</strong>
                  </span>
                  <span>
                    Units: <strong>{result.nUnits}</strong>
                  </span>
                  <span>
                    Segments: <strong>{result.nSegments}</strong>
                  </span>
                </div>
              </div>

              {/* Interpretation guide */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 p-3">
                <h4 className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 mb-2">
                  Interpretation Guide
                </h4>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  {[
                    { range: '< 0', label: 'Poor', color: '#EF4444' },
                    { range: '0.00–0.20', label: 'Slight', color: '#F97316' },
                    { range: '0.21–0.40', label: 'Fair', color: '#F59E0B' },
                    { range: '0.41–0.60', label: 'Moderate', color: '#EAB308' },
                    { range: '0.61–0.80', label: 'Substantial', color: '#22C55E' },
                    { range: '0.81–1.00', label: 'Almost Perfect', color: '#10B981' },
                  ].map((g) => (
                    <div key={g.label} className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="text-gray-600 dark:text-gray-400">
                        {g.range}: <strong style={{ color: g.color }}>{g.label}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="border-t border-gray-100 dark:border-gray-700/50 px-5 py-2 flex justify-end">
            <button
              onClick={handleExport}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            >
              Export Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
