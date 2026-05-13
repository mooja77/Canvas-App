import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { canvasClient } from '../../../services/api';
import { useActiveCanvasId } from '../../../stores/canvasStore';
import { trackEvent } from '../../../utils/analytics';

interface Props {
  onClose: () => void;
}

interface MethodsStatementResponse {
  success: true;
  data: {
    paragraph: string;
    metadata: {
      canvasName: string;
      transcriptCount: number;
      totalCodings: number;
      totalCodes: number;
      intercoder: { method: string; score: number; nCoders: number } | null;
      aiUsage: { feature: string; count: number; provider: string; model: string }[];
      acceptanceLog: { accepted: number; rejected: number; modified: number } | null;
    };
  };
}

/**
 * Spec 11 — Methods Statement export modal.
 *
 * Generates a publishable methods-section paragraph from the canvas's
 * coding metadata + AI usage history + intercoder reliability. Researchers
 * copy/paste directly into their manuscripts; complies with the Jones
 * (2025) heuristic for granular AI disclosure.
 */
export default function MethodsStatementModal({ onClose }: Props) {
  const canvasId = useActiveCanvasId();
  const [paragraph, setParagraph] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MethodsStatementResponse['data']['metadata'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate on mount
  useEffect(() => {
    if (!canvasId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    canvasClient
      .post<MethodsStatementResponse>(`/canvas/${canvasId}/ai/methods-statement`, {})
      .then((res) => {
        if (cancelled) return;
        setParagraph(res.data.data.paragraph);
        setMetadata(res.data.data.metadata);
        setLoading(false);
        trackEvent('methods_statement_generated', { canvas_id: canvasId });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.data?.error || 'Could not generate methods statement';
        setError(msg);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    if (!paragraph) return;
    try {
      await navigator.clipboard.writeText(paragraph);
      setCopied(true);
      toast.success('Methods paragraph copied to clipboard');
      trackEvent('methods_statement_copied', { canvas_id: canvasId ?? null });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the text and Ctrl+C instead');
    }
  }, [canvasId, paragraph]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Methods statement export"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Methods Statement</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Paste this paragraph into your manuscript's methods section.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500" />
              Generating publishable methods paragraph…
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Typically takes 8–15 seconds.</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 p-4 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {!loading && !error && paragraph && (
          <>
            <textarea
              readOnly
              value={paragraph}
              rows={10}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 font-serif leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500"
              onClick={(e) => e.currentTarget.select()}
            />

            {metadata && (
              <details className="mt-4 text-xs text-gray-600 dark:text-gray-400">
                <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                  Source metadata
                </summary>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 pl-2">
                  <dt className="text-gray-500">Project:</dt>
                  <dd>{metadata.canvasName}</dd>
                  <dt className="text-gray-500">Transcripts:</dt>
                  <dd className="tabular-nums">{metadata.transcriptCount}</dd>
                  <dt className="text-gray-500">Codings:</dt>
                  <dd className="tabular-nums">{metadata.totalCodings}</dd>
                  <dt className="text-gray-500">Code categories:</dt>
                  <dd className="tabular-nums">{metadata.totalCodes}</dd>
                  {metadata.intercoder && (
                    <>
                      <dt className="text-gray-500">Intercoder:</dt>
                      <dd>
                        {metadata.intercoder.method} = {metadata.intercoder.score.toFixed(3)} (
                        {metadata.intercoder.nCoders} coders)
                      </dd>
                    </>
                  )}
                  {metadata.acceptanceLog && (
                    <>
                      <dt className="text-gray-500">AI accept/reject/modify:</dt>
                      <dd className="tabular-nums">
                        {metadata.acceptanceLog.accepted}/{metadata.acceptanceLog.rejected}/
                        {metadata.acceptanceLog.modified}
                      </dd>
                    </>
                  )}
                </dl>
                {metadata.aiUsage.length > 0 && (
                  <ul className="mt-2 pl-4 list-disc">
                    {metadata.aiUsage.map((u, i) => (
                      <li key={i}>
                        {u.feature} (×{u.count}) via {u.provider}/{u.model}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg bg-brand-600 hover:bg-brand-700 px-4 py-1.5 text-xs font-medium text-white"
              >
                {copied ? 'Copied ✓' : 'Copy paragraph'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
