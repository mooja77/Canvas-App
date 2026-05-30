import { useEffect, useState } from 'react';
import { useActiveCanvas } from '../../../stores/canvasStore';
import { canvasApi } from '../../../services/api';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';

interface AgreementModalProps {
  onClose: () => void;
}

type AgreementData = Awaited<ReturnType<typeof canvasApi.getAiAgreement>>['data']['data'];

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** F1 → qualitative label + colour, mirroring the kappa interpretation bands. */
function interpretF1(f1: number): { label: string; color: string } {
  if (f1 >= 0.9) return { label: 'Almost perfect', color: '#10B981' };
  if (f1 >= 0.75) return { label: 'Strong', color: '#22C55E' };
  if (f1 >= 0.6) return { label: 'Moderate', color: '#EAB308' };
  if (f1 >= 0.4) return { label: 'Fair', color: '#F59E0B' };
  return { label: 'Weak', color: '#EF4444' };
}

/**
 * "AI vs me" agreement — shows how well the AI's suggestions match this canvas's
 * coded set (precision / recall / F1 + per-code + confidence calibration),
 * fetched from GET /canvas/:id/ai/agreement. The in-product counterpart to the
 * offline eval harness: it lets a researcher judge, on their OWN data, whether
 * the AI's confidence is earned.
 */
export default function AgreementModal({ onClose }: AgreementModalProps) {
  useEscapeToClose(onClose);
  const canvas = useActiveCanvas();
  const [data, setData] = useState<AgreementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvas?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    canvasApi
      .getAiAgreement(canvas.id)
      .then((res) => {
        if (!cancelled) setData(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || 'Could not compute AI agreement.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canvas?.id]);

  const f1Band = data ? interpretF1(data.f1) : null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-agreement-title"
        className="modal-content w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
          <div>
            <h3 id="ai-agreement-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              AI agreement with your coding
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              How well the AI’s suggestions match what you actually coded
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

        <div className="overflow-y-auto px-5 py-4">
          {loading && <p className="text-xs text-gray-500 dark:text-gray-400">Computing agreement…</p>}

          {!loading && error && <p className="text-xs text-red-500">{error}</p>}

          {!loading && !error && data && !data.ready && (
            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-2">
              <p className="font-medium text-gray-900 dark:text-gray-100">Not enough to compare yet.</p>
              <p>
                This compares the AI’s suggestions against your coded segments. You currently have{' '}
                <strong>{data.codedSegments}</strong> coded segment{data.codedSegments !== 1 ? 's' : ''} and{' '}
                <strong>{data.suggestions}</strong> AI suggestion{data.suggestions !== 1 ? 's' : ''}. Code some segments
                and run AI auto-coding, then check back.
              </p>
            </div>
          )}

          {!loading && !error && data && data.ready && (
            <div className="space-y-5">
              {/* Headline metrics */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Precision', value: data.precision, hint: 'of AI suggestions that match your coding' },
                  { label: 'Recall', value: data.recall, hint: 'of your codings the AI also caught' },
                  { label: 'F1', value: data.f1, hint: 'balance of the two' },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-gray-100 dark:border-gray-700/50 px-3 py-2.5 text-center"
                  >
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{pct(m.value)}</div>
                    <div className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{m.label}</div>
                    <div className="mt-0.5 text-[9px] leading-tight text-gray-400">{m.hint}</div>
                  </div>
                ))}
              </div>

              {f1Band && (
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: f1Band.color }}
                    aria-hidden
                  />
                  <span className="font-medium text-gray-700 dark:text-gray-200">{f1Band.label} agreement</span>
                  <span className="text-gray-400">
                    · {data.tp} matched, {data.fp} AI-only, {data.fn} missed · {data.codedSegments} coded segment
                    {data.codedSegments !== 1 ? 's' : ''} vs {data.suggestions} suggestion
                    {data.suggestions !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Per-code breakdown */}
              {data.perCode.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    By code
                  </h4>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-400">
                        <th className="py-1 text-left font-medium">Code</th>
                        <th className="py-1 text-right font-medium">Precision</th>
                        <th className="py-1 text-right font-medium">Recall</th>
                        <th className="py-1 text-right font-medium">F1</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.perCode.map((c) => (
                        <tr key={c.questionId} className="border-b border-gray-50 dark:border-gray-700/40">
                          <td className="py-1 pr-2 text-gray-700 dark:text-gray-200">{c.code}</td>
                          <td className="py-1 text-right tabular-nums text-gray-600 dark:text-gray-300">
                            {pct(c.precision)}
                          </td>
                          <td className="py-1 text-right tabular-nums text-gray-600 dark:text-gray-300">
                            {pct(c.recall)}
                          </td>
                          <td className="py-1 text-right tabular-nums text-gray-700 dark:text-gray-200">{pct(c.f1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Confidence calibration */}
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Is the AI’s confidence earned?
                </h4>
                <p className="mb-2 text-[10px] text-gray-400">
                  Of the AI’s suggestions in each confidence band, how many matched your coding. Higher bands should
                  agree more — if they don’t, the model is over-confident.
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-400">
                      <th className="py-1 text-left font-medium">Confidence</th>
                      <th className="py-1 text-right font-medium">Suggestions</th>
                      <th className="py-1 text-right font-medium">Agreed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.calibration.map((b) => (
                      <tr key={b.band} className="border-b border-gray-50 dark:border-gray-700/40">
                        <td className="py-1 text-gray-700 dark:text-gray-200">{b.band}</td>
                        <td className="py-1 text-right tabular-nums text-gray-600 dark:text-gray-300">{b.count}</td>
                        <td className="py-1 text-right tabular-nums text-gray-700 dark:text-gray-200">
                          {b.matchedRate === null ? '—' : `${b.matchedRate}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] leading-relaxed text-gray-400">{data.basis}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
