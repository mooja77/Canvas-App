import { useState, useMemo } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTranscript } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface AutoCodeModalProps {
  onClose: () => void;
}

interface PreviewMatch {
  transcriptTitle: string;
  context: string;
}

export default function AutoCodeModal({ onClose }: AutoCodeModalProps) {
  const { activeCanvas, autoCode } = useCanvasStore();
  const [pattern, setPattern] = useState('');
  const [mode, setMode] = useState<'keyword' | 'regex'>('keyword');
  const [questionId, setQuestionId] = useState('');
  const [transcriptIds, setTranscriptIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const questions = activeCanvas?.questions ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];

  const handlePatternChange = (value: string) => {
    setPattern(value);
    setShowPreview(false);
    if (mode === 'regex' && value.trim()) {
      try {
        new RegExp(value.trim());
        setRegexError(null);
      } catch (err: any) {
        setRegexError(err?.message || 'Invalid regex');
      }
    } else {
      setRegexError(null);
    }
  };

  // Client-side preview of matches
  const previewMatches = useMemo((): PreviewMatch[] => {
    if (!showPreview || !pattern.trim() || regexError) return [];
    const pat = pattern.trim();
    const targets = transcriptIds.length
      ? transcripts.filter((t: CanvasTranscript) => transcriptIds.includes(t.id))
      : transcripts;

    const matches: PreviewMatch[] = [];
    let regex: RegExp;
    try {
      regex = mode === 'regex' ? new RegExp(pat, 'gi') : new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    } catch {
      return [];
    }

    for (const t of targets) {
      let m: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((m = regex.exec(t.content)) !== null) {
        const start = Math.max(0, m.index - 20);
        const end = Math.min(t.content.length, m.index + m[0].length + 20);
        const context = (start > 0 ? '...' : '') + t.content.slice(start, end) + (end < t.content.length ? '...' : '');
        matches.push({ transcriptTitle: t.title, context });
        if (matches.length >= 50) break; // cap total matches for performance
      }
      if (matches.length >= 50) break;
    }
    return matches;
  }, [showPreview, pattern, mode, regexError, transcripts, transcriptIds]);

  const handleSubmit = async () => {
    if (!pattern.trim() || !questionId) return;
    if (mode === 'regex') {
      try { new RegExp(pattern.trim()); }
      catch { toast.error('Invalid regex pattern'); return; }
    }
    setLoading(true);
    try {
      const result = await autoCode(questionId, pattern.trim(), mode, transcriptIds.length ? transcriptIds : undefined);
      toast.success(`Auto-coded ${result.created} match${result.created !== 1 ? 'es' : ''}`);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Auto-coding failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleTranscript = (tid: string) => {
    setTranscriptIds(prev => prev.includes(tid) ? prev.filter(id => id !== tid) : [...prev, tid]);
    setShowPreview(false);
  };

  const canPreview = !!pattern.trim() && !regexError;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="modal-content w-full max-w-md rounded-2xl bg-white shadow-xl backdrop-blur-xl ring-1 ring-black/5 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Auto-Code by Pattern</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Pattern input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search Pattern</label>
            <input
              type="text"
              className={`input w-full text-sm ${regexError ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder={mode === 'regex' ? 'e.g. sustainab(le|ility)' : 'e.g. sustainability'}
              value={pattern}
              onChange={e => handlePatternChange(e.target.value)}
            />
            {regexError && (
              <p className="mt-1 text-[11px] text-red-500">{regexError}</p>
            )}
          </div>

          {/* Mode toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Match Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setMode('keyword'); setRegexError(null); setShowPreview(false); }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'keyword' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}
              >
                Keyword
              </button>
              <button
                onClick={() => { setMode('regex'); handlePatternChange(pattern); }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'regex' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}
              >
                Regex
              </button>
            </div>
          </div>

          {/* Question selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Question</label>
            <select className="input w-full text-sm" value={questionId} onChange={e => setQuestionId(e.target.value)}>
              <option value="">Select a question...</option>
              {questions.map((q: CanvasQuestion) => (
                <option key={q.id} value={q.id}>{q.text}</option>
              ))}
            </select>
          </div>

          {/* Transcript selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Transcripts <span className="text-gray-400 font-normal">(all if none selected)</span>
            </label>
            <div className="max-h-[120px] overflow-y-auto rounded border border-gray-200 p-2 dark:border-gray-700 space-y-1">
              {transcripts.map((t: CanvasTranscript) => (
                <label key={t.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={transcriptIds.includes(t.id)}
                    onChange={() => toggleTranscript(t.id)}
                    className="rounded border-gray-300"
                  />
                  {t.title}
                </label>
              ))}
            </div>
          </div>

          {/* Preview section */}
          {showPreview && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Preview: {previewMatches.length}{previewMatches.length >= 50 ? '+' : ''} match{previewMatches.length !== 1 ? 'es' : ''}
                </span>
                <button onClick={() => setShowPreview(false)} className="text-[10px] text-gray-400 hover:text-gray-600">Hide</button>
              </div>
              <div className="max-h-[140px] overflow-y-auto rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 p-2 space-y-1.5">
                {previewMatches.length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-2">No matches found</p>
                ) : (
                  previewMatches.slice(0, 5).map((m, i) => (
                    <div key={i} className="text-[11px]">
                      <span className="font-medium text-gray-500 dark:text-gray-400">{m.transcriptTitle}:</span>{' '}
                      <span className="text-gray-600 dark:text-gray-300">{m.context}</span>
                    </div>
                  ))
                )}
                {previewMatches.length > 5 && (
                  <p className="text-[10px] text-gray-400 text-center">...and {previewMatches.length - 5} more</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary h-8 px-3 text-xs">Cancel</button>
          <button
            onClick={() => setShowPreview(true)}
            disabled={!canPreview}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-750 disabled:opacity-50"
          >
            Preview
          </button>
          <button
            onClick={handleSubmit}
            disabled={!pattern.trim() || !questionId || loading || !!regexError}
            className="btn-primary h-8 px-3 text-xs disabled:opacity-50"
          >
            {loading ? 'Coding...' : 'Auto-Code'}
          </button>
        </div>
      </div>
    </div>
  );
}
