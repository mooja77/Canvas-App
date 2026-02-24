import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '../../../stores/canvasStore';
import AnnotationPopover from './AnnotationPopover';
import ConfirmDialog from '../ConfirmDialog';
import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript } from '@canvas-app/shared';
import toast from 'react-hot-toast';

export default function CodingDetailPanel() {
  const { activeCanvas, selectedQuestionId, setSelectedQuestionId, deleteCoding, reassignCoding } = useCanvasStore();
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [filterTranscript, setFilterTranscript] = useState<string>('all');

  const question = useMemo(
    () => activeCanvas?.questions.find((q: CanvasQuestion) => q.id === selectedQuestionId),
    [activeCanvas?.questions, selectedQuestionId],
  );

  const allCodings = useMemo(
    () => (activeCanvas?.codings ?? []).filter((c: CanvasTextCoding) => c.questionId === selectedQuestionId),
    [activeCanvas?.codings, selectedQuestionId],
  );

  // Filter by transcript
  const codings = useMemo(() => {
    if (filterTranscript === 'all') return allCodings;
    return allCodings.filter(c => c.transcriptId === filterTranscript);
  }, [allCodings, filterTranscript]);

  const transcriptMap = useMemo(() => {
    const map = new Map<string, string>();
    activeCanvas?.transcripts.forEach((t: CanvasTranscript) => map.set(t.id, t.title));
    return map;
  }, [activeCanvas?.transcripts]);

  // Unique transcripts that have codings for this question
  const codedTranscripts = useMemo(() => {
    const ids = new Set(allCodings.map(c => c.transcriptId));
    return Array.from(ids).map(id => ({ id, title: transcriptMap.get(id) || 'Unknown' }));
  }, [allCodings, transcriptMap]);

  const allQuestions = useMemo(() => activeCanvas?.questions ?? [], [activeCanvas?.questions]);

  const handleReassign = async (codingId: string, newQuestionId: string) => {
    try {
      await reassignCoding(codingId, newQuestionId);
      toast.success('Coding reassigned');
      setReassigningId(null);
    } catch {
      toast.error('Failed to reassign');
    }
  };

  if (!question) return null;

  return (
    <div data-tour="canvas-detail-panel" className="animate-slide-in-right flex h-full w-80 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">Coded Segments</h4>
          <div className="mt-0.5 flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: question.color }} />
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{question.text}</span>
          </div>
        </div>
        <button
          onClick={() => setSelectedQuestionId(null)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Filter by transcript */}
      {codedTranscripts.length > 1 && (
        <div className="border-b border-gray-100 dark:border-gray-700/50 px-4 py-2">
          <select
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-400 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-colors"
            value={filterTranscript}
            onChange={e => setFilterTranscript(e.target.value)}
          >
            <option value="all">All sources ({allCodings.length})</option>
            {codedTranscripts.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Coded segments list */}
      <div className="flex-1 overflow-y-auto p-3">
        {codings.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            {filterTranscript !== 'all' ? (
              'No segments in this source. Try another filter.'
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-750">
                  <svg className="h-6 w-6 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                </div>
                <p className="text-xs">No segments coded yet.</p>
                <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">Select text in a transcript and choose this code.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {codings.map((coding: CanvasTextCoding) => (
              <div key={coding.id} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-750/80 transition-all hover:shadow-sm">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                  <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  {transcriptMap.get(coding.transcriptId) || 'Unknown transcript'}
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  &ldquo;{coding.codedText}&rdquo;
                </p>

                {/* Annotation display */}
                {coding.annotation && (
                  <div
                    className="mt-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 border-l-2 border-amber-400 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
                    onClick={() => { setAnnotatingId(coding.id); }}
                    title="Click to edit"
                  >
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">{coding.annotation}</p>
                  </div>
                )}

                {/* Reassign dropdown */}
                {reassigningId === coding.id && (
                  <div className="mt-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 max-h-[120px] overflow-y-auto animate-slide-down">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 px-1.5 pb-1">Move to:</p>
                    {allQuestions
                      .filter((q: CanvasQuestion) => q.id !== selectedQuestionId)
                      .map((q: CanvasQuestion) => (
                        <button
                          key={q.id}
                          onClick={() => handleReassign(coding.id, q.id)}
                          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: q.color }} />
                          <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate">{q.text}</span>
                        </button>
                      ))}
                    <button
                      onClick={() => setReassigningId(null)}
                      className="w-full text-[10px] text-gray-400 hover:text-gray-600 mt-1 py-0.5"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 tabular-nums">
                    {coding.endOffset - coding.startOffset} chars
                  </span>
                  {reassigningId !== coding.id && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(coding.codedText);
                          toast.success('Copied to clipboard');
                        }}
                        className="rounded px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => setAnnotatingId(annotatingId === coding.id ? null : coding.id)}
                        className="rounded px-1.5 py-0.5 text-[10px] text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      >
                        {coding.annotation ? 'Edit note' : 'Annotate'}
                      </button>
                      <button
                        onClick={() => setReassigningId(coding.id)}
                        className="rounded px-1.5 py-0.5 text-[10px] text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        Move
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(coding.id)}
                        className="rounded px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline annotation popover */}
                {annotatingId === coding.id && (
                  <div className="mt-2 animate-slide-down">
                    <AnnotationPopover
                      codingId={coding.id}
                      currentAnnotation={coding.annotation}
                      onClose={() => setAnnotatingId(null)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary footer */}
      <div className="border-t border-gray-200 px-4 py-2 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {codings.length} segment{codings.length !== 1 ? 's' : ''}
          </span>
          {codings.length > 0 && (
            <span className="text-[10px] text-gray-400 tabular-nums">
              {codings.reduce((sum: number, c: CanvasTextCoding) => sum + (c.endOffset - c.startOffset), 0).toLocaleString()} chars
            </span>
          )}
        </div>
      </div>

      {/* Delete coding confirmation */}
      {confirmDeleteId && createPortal(
        <ConfirmDialog
          title="Remove Coded Segment"
          message="Remove this coded segment? The transcript text will not be affected."
          confirmLabel="Remove"
          onConfirm={() => { deleteCoding(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />,
        document.body,
      )}
    </div>
  );
}
