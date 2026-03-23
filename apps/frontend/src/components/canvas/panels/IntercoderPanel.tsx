import { useState, useMemo } from 'react';
import { useActiveCanvas } from '../../../stores/canvasStore';
import { canvasApi } from '../../../services/api';
import toast from 'react-hot-toast';

interface IntercoderPanelProps {
  onClose: () => void;
}

interface SegmentResult {
  transcriptId: string;
  startOffset: number;
  endOffset: number;
  coderA: string[];
  coderB: string[];
  agree: boolean;
}

interface IntercoderResult {
  kappa: number;
  agreement: number;
  segments: SegmentResult[];
}

function interpretKappa(k: number): { label: string; color: string } {
  if (k < 0) return { label: 'Poor', color: '#EF4444' };
  if (k <= 0.20) return { label: 'Slight', color: '#F97316' };
  if (k <= 0.40) return { label: 'Fair', color: '#F59E0B' };
  if (k <= 0.60) return { label: 'Moderate', color: '#EAB308' };
  if (k <= 0.80) return { label: 'Substantial', color: '#22C55E' };
  return { label: 'Almost Perfect', color: '#10B981' };
}

export default function IntercoderPanel({ onClose }: IntercoderPanelProps) {
  const activeCanvas = useActiveCanvas();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTranscriptId, setSelectedTranscriptId] = useState('');
  const [result, setResult] = useState<IntercoderResult | null>(null);
  const [computing, setComputing] = useState(false);

  const canvasId = activeCanvas?.id;
  const transcripts = activeCanvas?.transcripts ?? [];
  const questions = activeCanvas?.questions ?? [];

  // Collaborators would come from the canvas shares / collaborators
  // For now we'll load them from the collaborators endpoint
  const [collaborators, setCollaborators] = useState<{ id: string; name: string; email: string }[]>([]);
  const [collabLoaded, setCollabLoaded] = useState(false);

  useMemo(() => {
    if (canvasId && !collabLoaded) {
      canvasApi.getCollaborators(canvasId)
        .then(res => {
          const data = res.data.data || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const users = data.map((c: any) => ({
            id: c.userId || c.user?.id || c.id,
            name: c.user?.name || c.name || 'Unknown',
            email: c.user?.email || c.email || '',
          }));
          setCollaborators(users);
          setCollabLoaded(true);
        })
        .catch(() => {
          setCollabLoaded(true);
        });
    }
  }, [canvasId, collabLoaded]);

  const handleCompute = async () => {
    if (!canvasId || !selectedUserId || !selectedTranscriptId) return;
    setComputing(true);
    try {
      const res = await canvasApi.computeIntercoder(canvasId, {
        userId: selectedUserId,
        transcriptId: selectedTranscriptId,
      });
      setResult(res.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to compute intercoder reliability');
    } finally {
      setComputing(false);
    }
  };

  const interp = result ? interpretKappa(result.kappa) : null;

  // Build a question lookup for displaying code names
  const questionMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of questions) map[q.id] = q.text;
    return map;
  }, [questions]);

  const selectedTranscript = transcripts.find(t => t.id === selectedTranscriptId);

  return (
    <div className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Intercoder Reliability (User Comparison)</h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Compare your codings with a collaborator using Cohen's Kappa</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Config */}
        <div className="border-b border-gray-100 dark:border-gray-700/50 px-5 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Collaborator</label>
              <select
                value={selectedUserId}
                onChange={e => { setSelectedUserId(e.target.value); setResult(null); }}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="">Select collaborator...</option>
                {collaborators.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Transcript</label>
              <select
                value={selectedTranscriptId}
                onChange={e => { setSelectedTranscriptId(e.target.value); setResult(null); }}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="">Select transcript...</option>
                {transcripts.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleCompute}
              disabled={!selectedUserId || !selectedTranscriptId || computing}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {computing ? 'Computing...' : 'Compute Kappa'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!result ? (
            <div className="py-12 text-center">
              <svg className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {collaborators.length === 0
                  ? 'No collaborators found. Add collaborators to this canvas first.'
                  : 'Select a collaborator and transcript, then click "Compute Kappa"'}
              </p>
            </div>
          ) : (
            <>
              {/* Kappa score */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Cohen's Kappa</div>
                <div className="text-3xl font-bold" style={{ color: interp!.color }}>
                  {result.kappa.toFixed(3)}
                </div>
                <div
                  className="mt-1 inline-block rounded-full px-3 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: interp!.color + '20', color: interp!.color }}
                >
                  {interp!.label} Agreement
                </div>
                <div className="mt-3 flex justify-center gap-6 text-[10px] text-gray-500 dark:text-gray-400">
                  <span>Agreement: <strong>{(result.agreement * 100).toFixed(1)}%</strong></span>
                  <span>Segments: <strong>{result.segments.length}</strong></span>
                </div>
              </div>

              {/* Per-segment comparison table */}
              {result.segments.length > 0 && selectedTranscript && (
                <div>
                  <h4 className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">
                    Segment Comparison
                  </h4>
                  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Segment</th>
                            <th className="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">You</th>
                            <th className="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">Collaborator</th>
                            <th className="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">Match</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.segments.slice(0, 100).map((seg, idx) => {
                            const text = selectedTranscript.content.slice(seg.startOffset, Math.min(seg.endOffset, seg.startOffset + 60));
                            return (
                              <tr
                                key={idx}
                                className={`border-t border-gray-100 dark:border-gray-700/50 ${
                                  seg.agree
                                    ? 'bg-green-50/30 dark:bg-green-900/10'
                                    : 'bg-red-50/30 dark:bg-red-900/10'
                                }`}
                              >
                                <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={text}>
                                  {text}{seg.endOffset - seg.startOffset > 60 ? '...' : ''}
                                </td>
                                <td className="px-3 py-1.5 text-center text-[10px]">
                                  {seg.coderA.map(qId => questionMap[qId] || qId.slice(0, 6)).join(', ') || '-'}
                                </td>
                                <td className="px-3 py-1.5 text-center text-[10px]">
                                  {seg.coderB.map(qId => questionMap[qId] || qId.slice(0, 6)).join(', ') || '-'}
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  {seg.agree ? (
                                    <svg className="w-4 h-4 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {result.segments.length > 100 && (
                    <p className="text-[10px] text-gray-400 mt-1">Showing first 100 of {result.segments.length} segments</p>
                  )}
                </div>
              )}

              {/* Interpretation guide */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 p-3">
                <h4 className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 mb-2">Kappa Interpretation Guide</h4>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  {[
                    { range: '< 0', label: 'Poor', color: '#EF4444' },
                    { range: '0.00-0.20', label: 'Slight', color: '#F97316' },
                    { range: '0.21-0.40', label: 'Fair', color: '#F59E0B' },
                    { range: '0.41-0.60', label: 'Moderate', color: '#EAB308' },
                    { range: '0.61-0.80', label: 'Substantial', color: '#22C55E' },
                    { range: '0.81-1.00', label: 'Almost Perfect', color: '#10B981' },
                  ].map(g => (
                    <div key={g.label} className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="text-gray-600 dark:text-gray-400">{g.range}: <strong style={{ color: g.color }}>{g.label}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
