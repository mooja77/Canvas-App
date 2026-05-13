import { useEffect, useMemo, useState } from 'react';
import { templateApi, type CanvasTemplate } from '../../services/api';
import { trackEvent } from '../../utils/analytics';

interface Props {
  preferredMethod: string;
  onSelect: (template: CanvasTemplate | null, includeSampleData: boolean) => void;
  onSkip: () => void;
}

const BLANK_TEMPLATE: CanvasTemplate = {
  id: '__blank__',
  name: 'Blank canvas',
  description: 'Start with an empty canvas. Bring your own transcripts and codes.',
  category: 'blank',
  method: null,
  sampleQuestions: [],
  sampleTranscript: '',
  sampleMemos: null,
  isPublic: true,
};

export default function Screen2_TemplateGallery({ preferredMethod, onSelect, onSkip }: Props) {
  const [templates, setTemplates] = useState<CanvasTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeSample, setIncludeSample] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    templateApi
      .list()
      .then((res) => {
        if (cancelled) return;
        setTemplates(res.data.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error || 'Could not load templates');
        setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ordered = useMemo(() => {
    if (!templates) return null;
    // Prefer templates whose `method` matches the user's Q2 answer; cap to 4
    // so the grid stays single-screen on a 1366px laptop.
    const matching = templates.filter((t) => t.method === preferredMethod);
    const rest = templates.filter((t) => t.method !== preferredMethod);
    return [...matching, ...rest].slice(0, 4);
  }, [templates, preferredMethod]);

  const handlePick = (tmpl: CanvasTemplate) => {
    setSelectedId(tmpl.id);
    trackEvent('template_selected', {
      template_name: tmpl.name,
      method: tmpl.method ?? 'blank',
      include_sample_data: includeSample,
    });
    if (tmpl.id === '__blank__') {
      onSelect(null, false);
    } else {
      onSelect(tmpl, includeSample);
    }
  };

  return (
    <div className="w-full max-w-3xl">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Pick a starting point</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Templates come with starter codes and a sample transcript so you can try coding immediately.
        </p>
      </div>

      <div className="flex items-center justify-center mb-4">
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={includeSample}
            onChange={(e) => setIncludeSample(e.target.checked)}
            className="rounded text-brand-600 focus:ring-brand-500"
          />
          Include sample data
        </label>
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 dark:bg-rose-900/20 p-3 text-xs text-rose-700 dark:text-rose-300 mb-3">
          {error}. You can still skip and start with a blank canvas.
        </div>
      )}

      {!ordered ? (
        <div className="text-center text-sm text-gray-400">Loading templates…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...ordered, BLANK_TEMPLATE].map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => handlePick(tmpl)}
              disabled={selectedId !== null}
              className={`text-left rounded-xl border p-4 transition-all hover:shadow-md disabled:opacity-50 ${
                selectedId === tmpl.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-brand-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tmpl.name}</h3>
                {tmpl.method && (
                  <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                    {tmpl.method.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{tmpl.description}</p>
              {tmpl.sampleQuestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {tmpl.sampleQuestions.slice(0, 5).map((q) => (
                    <span
                      key={q.text}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 text-[10px] text-gray-600 dark:text-gray-300"
                    >
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: q.color }} />
                      {q.text}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={() => {
            trackEvent('onboarding_skipped', { at_step: 2 });
            onSkip();
          }}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Skip — start blank
        </button>
        <div className="text-xs text-gray-400">2 of 5</div>
      </div>
    </div>
  );
}
