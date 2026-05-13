import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { canvasApi } from '../../services/api';
import { useCanvasStore } from '../../stores/canvasStore';
import { trackEvent } from '../../utils/analytics';

interface InlineSuggestion {
  id: string;
  label: string;
  color: string;
  confidence: number;
  reasoning: string;
  isNew: boolean;
}

interface Props {
  canvasId: string;
  transcriptId: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
  anchorRect: { x: number; y: number };
  onClose: () => void;
}

/**
 * Sprint H — Inline AI suggestions popover.
 *
 * Fired from QuickCodePopover's "AI" button (or directly when the
 * inline_ai_suggester flag overrides the default selection flow). Shows up
 * to 3 suggestions with confidence bars, click-to-apply, "Why these?"
 * reasoning panel, and a fallback "+ New code" inline create.
 *
 * Telemetry is fire-and-forget; failures don't block the user from applying
 * a code.
 */
export default function InlineCodeSuggester({
  canvasId,
  transcriptId,
  startOffset,
  endOffset,
  codedText,
  anchorRect,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const triggeredAtRef = useRef<number>(Date.now());
  const closedByApplyRef = useRef(false);
  const [suggestions, setSuggestions] = useState<InlineSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [newCodeText, setNewCodeText] = useState('');
  const [applying, setApplying] = useState(false);
  const createCoding = useCanvasStore((s) => s.createCoding);
  const addQuestion = useCanvasStore((s) => s.addQuestion);

  // Fetch suggestions on mount
  useEffect(() => {
    let cancelled = false;
    trackEvent('inline_ai_triggered', {
      selection_length: codedText.length,
      transcript_id: transcriptId,
    });

    canvasApi
      .aiSuggestCodesInline(canvasId, { transcriptId, codedText, startOffset, endOffset })
      .then((res) => {
        if (cancelled) return;
        setSuggestions(res.data.data.suggestions);
        setLoading(false);
        trackEvent('inline_ai_cache_hit', { cache_hit: res.data.data.cacheHit });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.data?.error || 'AI suggestion failed';
        setError(msg);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canvasId, transcriptId, codedText, startOffset, endOffset]);

  // Outside-click + Esc to close
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onMouseDown), 50);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Fire `rejected` telemetry on close if the user didn't apply anything.
  useEffect(() => {
    return () => {
      if (!closedByApplyRef.current) {
        trackEvent('inline_ai_rejected', { reason: 'closed' });
      }
    };
  }, []);

  const handleApply = useCallback(
    async (s: InlineSuggestion) => {
      if (applying) return;
      setApplying(true);
      try {
        let questionId = s.id;
        if (s.isNew) {
          const q = await addQuestion(s.label, s.color);
          questionId = q.id;
          trackEvent('inline_ai_new_code', { code_text: s.label, color: s.color });
        }
        await createCoding(transcriptId, questionId, startOffset, endOffset, codedText);
        trackEvent('inline_ai_accepted', {
          confidence: s.confidence,
          was_new: s.isNew,
          time_to_accept_ms: Date.now() - triggeredAtRef.current,
        });
        closedByApplyRef.current = true;
        window.getSelection()?.removeAllRanges();
        toast.success(`Coded to "${s.label.slice(0, 30)}${s.label.length > 30 ? '…' : ''}"`);
        onClose();
      } catch {
        toast.error('Failed to apply suggestion');
        setApplying(false);
      }
    },
    [addQuestion, applying, codedText, createCoding, endOffset, onClose, startOffset, transcriptId],
  );

  const handleCreateNew = useCallback(async () => {
    const label = newCodeText.trim();
    if (!label || applying) return;
    await handleApply({
      id: `new-manual`,
      label,
      color: '#3B82F6',
      confidence: 1,
      reasoning: 'User-created',
      isNew: true,
    });
  }, [applying, handleApply, newCodeText]);

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(anchorRect.x - 200, window.innerWidth - 408)),
    top: Math.max(8, anchorRect.y + 12),
    zIndex: 10000,
  };

  return createPortal(
    <div ref={ref} style={popoverStyle} className="context-menu-enter" data-testid="inline-code-suggester">
      <div className="w-[400px] rounded-xl border border-gray-200/60 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI suggestions</h3>
            {loading && <span className="text-[10px] text-gray-400 animate-pulse">thinking…</span>}
          </div>
          <button
            onClick={onClose}
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close inline AI suggester"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400 italic line-clamp-2">
          “{codedText.slice(0, 120)}
          {codedText.length > 120 ? '…' : ''}”
        </div>

        {error && (
          <div className="px-4 pb-3 text-xs text-rose-600 dark:text-rose-400">
            {error}. Try the existing codes below or create a new one.
          </div>
        )}

        {!error && (
          <div className="px-2 pb-2 space-y-1">
            {loading ? (
              // Skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg p-2 flex items-center gap-3 animate-pulse" aria-hidden="true">
                  <div className="h-3 w-3 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="flex-1" />
                  <div className="h-2 w-16 bg-gray-100 dark:bg-gray-700 rounded" />
                </div>
              ))
            ) : suggestions.length === 0 ? (
              <div className="px-2 py-3 text-[11px] text-gray-400 dark:text-gray-500 text-center">
                No suggestions returned. Create a new code below.
              </div>
            ) : (
              suggestions.map((s, i) => (
                <button
                  key={`${s.id}-${i}`}
                  type="button"
                  onClick={() => handleApply(s)}
                  disabled={applying}
                  className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{s.label}</span>
                      {s.isNew && (
                        <span className="text-[9px] uppercase tracking-wider bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                          new
                        </span>
                      )}
                    </div>
                    <ConfidenceBar value={s.confidence} />
                  </div>
                  <span className="text-[10px] text-gray-400">{applying ? '…' : 'Apply'}</span>
                </button>
              ))
            )}
          </div>
        )}

        {showReasoning && suggestions.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2 space-y-1 max-h-40 overflow-y-auto">
            {suggestions.map((s, i) => (
              <div key={i} className="text-[11px] text-gray-600 dark:text-gray-300">
                <span className="font-medium">{s.label}:</span> {s.reasoning || '(no reasoning provided)'}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2">
          <input
            type="text"
            value={newCodeText}
            onChange={(e) => setNewCodeText(e.target.value)}
            placeholder="Or create a new code…"
            className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateNew();
            }}
          />
        </div>

        {!error && suggestions.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowReasoning((v) => !v)}
              className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {showReasoning ? 'Hide reasoning' : 'Why these suggestions?'}
            </button>
            <span className="text-[9px] text-gray-300 dark:text-gray-600">Press Esc to dismiss</span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  // Hue from rose (low) → amber (mid) → emerald (high). Single bar with width.
  const color = pct < 50 ? '#F43F5E' : pct < 75 ? '#F59E0B' : '#10B981';
  return (
    <div className="mt-1 h-1 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
      <div
        className="h-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
        aria-label={`Confidence ${pct}%`}
      />
    </div>
  );
}
