import { useEffect } from 'react';
import type { AiSuggestion } from '@canvas-app/shared';
import { useCanvasStore } from '../../../stores/canvasStore';

interface AiSuggestPanelProps {
  suggestions: AiSuggestion[];
  loading: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onBulkAccept: (ids: string[]) => void;
  onBulkReject: (ids: string[]) => void;
  onClose: () => void;
}

export default function AiSuggestPanel({
  suggestions,
  loading,
  onAccept,
  onReject,
  onBulkAccept,
  onBulkReject,
  onClose,
}: AiSuggestPanelProps) {
  const questions = useCanvasStore((s) => s.activeCanvas?.questions ?? []);

  // Close panel when no suggestions remain
  useEffect(() => {
    if (!loading && suggestions.length === 0) return;
  }, [suggestions, loading]);

  if (suggestions.length === 0 && !loading) return null;

  const pendingIds = suggestions.map((s) => s.id);

  return (
    <div className="absolute bottom-4 right-4 z-50 w-80 max-h-[400px] rounded-xl border border-purple-200 bg-white shadow-xl dark:border-purple-800 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-purple-100 px-3 py-2 dark:border-purple-800">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            AI Suggestions
          </span>
          <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
            {suggestions.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 px-3 py-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Analyzing text...</span>
        </div>
      )}

      {/* Suggestion list */}
      <div className="flex-1 overflow-y-auto">
        {suggestions.map((suggestion) => {
          const existingCode = suggestion.questionId
            ? questions.find((q) => q.id === suggestion.questionId)
            : null;

          return (
            <div
              key={suggestion.id}
              className="border-b border-gray-50 px-3 py-2 last:border-0 dark:border-gray-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {existingCode ? (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: existingCode.color }}
                      />
                    ) : (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300 shrink-0 border border-dashed border-gray-400" />
                    )}
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                      {suggestion.suggestedText}
                    </span>
                    {!existingCode && (
                      <span className="shrink-0 rounded bg-yellow-100 px-1 py-0.5 text-[9px] text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        new
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500 line-clamp-2 italic">
                    &ldquo;{suggestion.codedText.slice(0, 80)}{suggestion.codedText.length > 80 ? '...' : ''}&rdquo;
                  </p>
                  <div className="mt-0.5 flex items-center gap-1">
                    <div className="h-1 w-12 rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="h-1 rounded-full bg-purple-400"
                        style={{ width: `${Math.round(suggestion.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-400">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onAccept(suggestion.id)}
                    className="rounded p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                    title="Accept"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onReject(suggestion.id)}
                    className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Reject"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk actions */}
      {suggestions.length > 1 && (
        <div className="flex items-center justify-between border-t border-purple-100 px-3 py-1.5 dark:border-purple-800">
          <button
            onClick={() => onBulkAccept(pendingIds)}
            className="rounded px-2 py-1 text-[10px] font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
          >
            Accept All
          </button>
          <button
            onClick={() => onBulkReject(pendingIds)}
            className="rounded px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Reject All
          </button>
        </div>
      )}
    </div>
  );
}
