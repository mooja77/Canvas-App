import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTextCoding } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface CodingSegmentPopoverProps {
  codings: CanvasTextCoding[];
  anchorRect: { x: number; y: number };
  onClose: () => void;
}

export default function CodingSegmentPopover({ codings, anchorRect, onClose }: CodingSegmentPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { activeCanvas, deleteCoding, updateCodingAnnotation, reassignCoding } = useCanvasStore();
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const questions = useMemo(() => {
    const map = new Map<string, CanvasQuestion>();
    activeCanvas?.questions.forEach((q: CanvasQuestion) => map.set(q.id, q));
    return map;
  }, [activeCanvas?.questions]);

  const allQuestions = useMemo(() => activeCanvas?.questions ?? [], [activeCanvas?.questions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 50);
    document.addEventListener('keydown', keyHandler);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const handleDelete = async (codingId: string) => {
    try {
      await deleteCoding(codingId);
      toast.success('Coding removed');
      if (codings.length <= 1) onClose();
    } catch {
      toast.error('Failed to remove coding');
    }
  };

  const handleSaveAnnotation = async (codingId: string) => {
    setSaving(true);
    try {
      await updateCodingAnnotation(codingId, annotationText.trim() || null);
      toast.success('Annotation saved');
      setEditingAnnotation(null);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReassign = async (codingId: string, newQuestionId: string) => {
    try {
      await reassignCoding(codingId, newQuestionId);
      toast.success('Coding reassigned');
      setReassigningId(null);
    } catch {
      toast.error('Failed to reassign');
    }
  };

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(anchorRect.x - 150, window.innerWidth - 320)),
    top: Math.max(8, anchorRect.y - 8),
    transform: 'translateY(-100%)',
    zIndex: 9999,
  };

  return createPortal(
    <div ref={ref} className="context-menu-enter" style={popoverStyle}>
      <div className="w-[300px] rounded-xl border border-gray-200/60 bg-white/98 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/98 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50/80 dark:bg-gray-750/80 border-b border-gray-100 dark:border-gray-700">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {codings.length} coding{codings.length !== 1 ? 's' : ''} on this segment
          </span>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Coding entries */}
        <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
          {codings.map((coding) => {
            const question = questions.get(coding.questionId);
            if (!question) return null;

            return (
              <div key={coding.id} className="px-3 py-2.5 hover:bg-gray-50/50 dark:hover:bg-gray-750/50 transition-colors">
                {/* Question label */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white dark:ring-gray-800"
                    style={{ backgroundColor: question.color }}
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
                    {question.text}
                  </span>
                </div>

                {/* Coded text preview */}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-1.5 italic">
                  &ldquo;{coding.codedText}&rdquo;
                </p>

                {/* Annotation */}
                {editingAnnotation === coding.id ? (
                  <div className="mt-1.5 space-y-1.5">
                    <textarea
                      className="input w-full text-[11px] resize-none rounded-lg"
                      rows={2}
                      placeholder="Add a researcher note..."
                      value={annotationText}
                      onChange={e => setAnnotationText(e.target.value)}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveAnnotation(coding.id); }
                        if (e.key === 'Escape') setEditingAnnotation(null);
                      }}
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setEditingAnnotation(null)}
                        className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveAnnotation(coding.id)}
                        disabled={saving}
                        className="text-[10px] font-medium text-brand-600 hover:text-brand-700 px-1.5 py-0.5 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : coding.annotation ? (
                  <div
                    className="mt-1 rounded-md bg-amber-50/80 dark:bg-amber-900/15 px-2 py-1 border-l-2 border-amber-400 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/25 transition-colors"
                    onClick={() => { setEditingAnnotation(coding.id); setAnnotationText(coding.annotation || ''); }}
                    title="Click to edit annotation"
                  >
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">{coding.annotation}</p>
                  </div>
                ) : null}

                {/* Reassign dropdown */}
                {reassigningId === coding.id && (
                  <div className="mt-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 max-h-[120px] overflow-y-auto">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 px-1.5 pb-1">Move to:</p>
                    {allQuestions
                      .filter((q: CanvasQuestion) => q.id !== coding.questionId)
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

                {/* Actions */}
                {reassigningId !== coding.id && editingAnnotation !== coding.id && (
                  <div className="flex items-center gap-0.5 mt-1.5">
                    <button
                      onClick={() => { setEditingAnnotation(coding.id); setAnnotationText(coding.annotation || ''); }}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                      {coding.annotation ? 'Edit note' : 'Annotate'}
                    </button>
                    <button
                      onClick={() => setReassigningId(coding.id)}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                      </svg>
                      Move
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(coding.codedText);
                        toast.success('Copied');
                      }}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                      Copy
                    </button>
                    <button
                      onClick={() => handleDelete(coding.id)}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors ml-auto"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
