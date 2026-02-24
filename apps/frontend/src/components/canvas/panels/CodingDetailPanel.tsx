import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '../../../stores/canvasStore';
import AnnotationPopover from './AnnotationPopover';
import ConfirmDialog from '../ConfirmDialog';
import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript } from '@canvas-app/shared';
import toast from 'react-hot-toast';

export default function CodingDetailPanel() {
  const { activeCanvas, selectedQuestionId, setSelectedQuestionId, deleteCoding } = useCanvasStore();
  const [annotatingId, setAnnotatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const question = useMemo(
    () => activeCanvas?.questions.find((q: CanvasQuestion) => q.id === selectedQuestionId),
    [activeCanvas?.questions, selectedQuestionId],
  );

  const codings = useMemo(
    () => (activeCanvas?.codings ?? []).filter((c: CanvasTextCoding) => c.questionId === selectedQuestionId),
    [activeCanvas?.codings, selectedQuestionId],
  );

  const transcriptMap = useMemo(() => {
    const map = new Map<string, string>();
    activeCanvas?.transcripts.forEach((t: CanvasTranscript) => map.set(t.id, t.title));
    return map;
  }, [activeCanvas?.transcripts]);

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

      {/* Coded segments list */}
      <div className="flex-1 overflow-y-auto p-3">
        {codings.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No segments coded yet. Select text in a transcript and drag to this question node to code it.
          </div>
        ) : (
          <div className="space-y-3">
            {codings.map((coding: CanvasTextCoding) => (
              <div key={coding.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-750">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {transcriptMap.get(coding.transcriptId) || 'Unknown transcript'}
                </p>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  "{coding.codedText}"
                </p>

                {/* Annotation display */}
                {coding.annotation && (
                  <div className="mt-1.5 rounded bg-amber-50 dark:bg-amber-900/20 px-2 py-1 border-l-2 border-amber-400">
                    <p className="text-[10px] text-amber-700 dark:text-amber-300">{coding.annotation}</p>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">
                    {coding.endOffset - coding.startOffset} chars
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(coding.codedText);
                        toast.success('Copied to clipboard');
                      }}
                      className="text-[10px] text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => setAnnotatingId(annotatingId === coding.id ? null : coding.id)}
                      className="text-[10px] text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
                    >
                      {coding.annotation ? 'Edit note' : 'Annotate'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(coding.id)}
                      className="text-[10px] text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Inline annotation popover */}
                {annotatingId === coding.id && (
                  <div className="mt-2">
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
        <span className="text-xs text-gray-400">
          {codings.length} segment{codings.length !== 1 ? 's' : ''}{codings.length > 0 ? ` · ${codings.reduce((sum: number, c: CanvasTextCoding) => sum + (c.endOffset - c.startOffset), 0)} total chars` : ''}
        </span>
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
