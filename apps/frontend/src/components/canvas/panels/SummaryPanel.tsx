import { useState, useEffect, useRef } from 'react';
import { useActiveCanvas } from '../../../stores/canvasStore';
import { canvasApi } from '../../../services/api';
import type { Summary } from '@qualcanvas/shared';
import toast from 'react-hot-toast';

interface SummaryPanelProps {
  onClose: () => void;
  requireAiConfig?: (feature: string, callback: () => void) => void;
}

export default function SummaryPanel({ onClose, requireAiConfig }: SummaryPanelProps) {
  const activeCanvas = useActiveCanvas();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sourceType, setSourceType] = useState<'transcript' | 'question' | 'canvas'>('transcript');
  const [sourceId, setSourceId] = useState<string>('');
  const [summaryType, setSummaryType] = useState<'paraphrase' | 'abstract' | 'thematic'>('paraphrase');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const sourceRef = useRef<HTMLSelectElement>(null);
  const sourceTypeRef = useRef<HTMLSelectElement>(null);

  const canvasId = activeCanvas?.id;
  const transcripts = activeCanvas?.transcripts || [];
  const questions = activeCanvas?.questions || [];

  useEffect(() => {
    if (canvasId) loadSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadSummaries is not memoized, canvasId is the true trigger
  }, [canvasId]);

  const loadSummaries = async () => {
    if (!canvasId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await canvasApi.getSummaries(canvasId);
      setSummaries(res.data.data);
    } catch {
      setLoadError("We couldn't load your summaries. Try again, or close and reopen this panel.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (!canvasId || generating) return;
    if (sourceType !== 'canvas' && !sourceId) {
      toast.error('Choose a transcript or code above, or import one first.');
      return;
    }
    const generate = async () => {
      setGenerating(true);
      try {
        const res = await canvasApi.generateSummary(canvasId, {
          sourceType,
          sourceId: sourceType === 'canvas' ? undefined : sourceId,
          summaryType,
        });
        setSummaries((prev) => [res.data.data, ...prev]);
        toast.success('Summary generated');
      } catch {
        toast.error('Could not generate a summary. Check your AI connection, then try again.');
      } finally {
        setGenerating(false);
      }
    };
    // Reading saved summaries never needs an AI key. Actual generation keeps
    // the existing wizard guard and the server's plan/auth/provider checks.
    if (requireAiConfig) requireAiConfig('AI Summarization', () => void generate());
    else void generate();
  };

  const handleSaveEdit = async (sid: string) => {
    if (!canvasId || !editText.trim()) return;
    try {
      const res = await canvasApi.updateSummary(canvasId, sid, { summaryText: editText });
      setSummaries((prev) => prev.map((s) => (s.id === sid ? res.data.data : s)));
      setEditingId(null);
      toast.success('Summary updated');
    } catch {
      toast.error('Could not save this summary. Keep your text here and try Save again.');
    }
  };

  const sourceItems = (
    sourceType === 'transcript' ? transcripts : sourceType === 'question' ? questions : []
  ) as Array<{ id: string; title?: string; text?: string }>;

  return (
    <div
      role="complementary"
      aria-labelledby="summary-panel-title"
      className="fixed right-0 top-0 z-40 flex h-full w-full sm:w-[420px] flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 animate-slide-in-right"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-4 w-4 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>
          <h3 id="summary-panel-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Summarize & Paraphrase
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close summaries"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Generate form */}
      <div className="border-b border-gray-100 px-4 py-3 space-y-2.5 dark:border-gray-700/50">
        <div className="flex gap-2">
          <div className="flex-1">
            <label
              htmlFor="summary-source-type"
              className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              Source type
            </label>
            <select
              id="summary-source-type"
              ref={sourceTypeRef}
              value={sourceType}
              onChange={(e) => {
                setSourceType(e.target.value as 'transcript' | 'question' | 'canvas');
                setSourceId('');
              }}
              className="input h-8 w-full text-xs"
            >
              <option value="transcript">Transcript</option>
              <option value="question">Code/Question</option>
              <option value="canvas">Entire Canvas</option>
            </select>
          </div>
          <div className="flex-1">
            <label
              htmlFor="summary-type"
              className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              Summary type
            </label>
            <select
              id="summary-type"
              value={summaryType}
              onChange={(e) => setSummaryType(e.target.value as 'paraphrase' | 'abstract' | 'thematic')}
              className="input h-8 w-full text-xs"
            >
              <option value="paraphrase">Paraphrase</option>
              <option value="abstract">Abstract</option>
              <option value="thematic">Thematic Analysis</option>
            </select>
          </div>
        </div>

        {sourceType !== 'canvas' && (
          <select
            id="summary-source-id"
            ref={sourceRef}
            aria-label="Transcript or code"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="input h-8 w-full text-xs"
          >
            <option value="">Select {sourceType}...</option>
            {sourceItems.map((item) => (
              <option key={item.id} value={item.id}>
                {'title' in item ? item.title : 'text' in item ? item.text : item.id}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating || (sourceType !== 'canvas' && !sourceId)}
          className="btn-primary w-full h-8 text-xs disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </span>
          ) : (
            'Generate Summary'
          )}
        </button>
      </div>

      {/* Summaries list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-8 text-xs text-gray-600 dark:text-gray-300"
          >
            <span>Loading summaries...</span>
            <svg className="h-5 w-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {!loading && loadError && (
          <div role="alert" className="rounded-lg border border-amber-300 p-3 text-xs text-gray-800 dark:text-gray-100">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={loadSummaries}
              className="mt-2 min-h-8 font-medium text-brand-700 underline dark:text-brand-300"
            >
              Try again
            </button>
          </div>
        )}
        {!loading && !loadError && summaries.length === 0 && (
          <div className="py-5 text-xs text-gray-700 dark:text-gray-200">
            <p className="font-medium">No summaries yet</p>
            <p className="mt-2">
              A short summary helps you compare a source's main ideas without replacing the original. Review any AI
              draft against your source.
            </p>
            {transcripts.length === 0 && questions.length === 0 ? (
              <button
                type="button"
                className="mt-3 min-h-8 font-medium text-brand-700 underline dark:text-brand-300"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('qualcanvas:open-transcript-picker'));
                }}
              >
                Paste or import a transcript
              </button>
            ) : (
              <button
                type="button"
                className="mt-3 min-h-8 font-medium text-brand-700 underline dark:text-brand-300"
                onClick={() => (sourceItems.length > 0 ? sourceRef.current : sourceTypeRef.current)?.focus()}
              >
                Choose a source
              </button>
            )}
            <p className="mt-3 rounded bg-gray-50 p-2 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
              Example only: Travel costs made it harder to attend appointments. This illustrative sentence is not saved
              research.
            </p>
          </div>
        )}

        {summaries.map((s) => (
          <div key={s.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s.summaryType === 'paraphrase'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : s.summaryType === 'abstract'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}
                >
                  {s.summaryType}
                </span>
                <span className="text-[10px] text-gray-400 capitalize">{s.sourceType}</span>
              </div>
              <span className="text-[10px] text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</span>
            </div>

            {editingId === s.id ? (
              <div className="space-y-2">
                <textarea
                  className="input w-full text-xs min-h-[120px] resize-y"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => handleSaveEdit(s.id)} className="btn-primary h-7 px-2.5 text-[11px]">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-[11px] text-gray-400 hover:text-gray-600">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="group">
                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {s.summaryText}
                </p>
                <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingId(s.id);
                      setEditText(s.summaryText);
                    }}
                    className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(s.summaryText);
                      toast.success('Copied');
                    }}
                    className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
