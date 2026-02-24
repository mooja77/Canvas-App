import { useEffect, useRef, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface QuickCodePopoverProps {
  transcriptId: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
  anchorRect: { x: number; y: number };
  onClose: () => void;
}

export default function QuickCodePopover({
  transcriptId,
  startOffset,
  endOffset,
  codedText,
  anchorRect,
  onClose,
}: QuickCodePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { activeCanvas, createCoding, codeInVivo, spreadToParagraph, addQuestion } = useCanvasStore();
  const questions = useMemo(() => activeCanvas?.questions ?? [], [activeCanvas?.questions]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  // Recently coded questions (based on existing codings in this transcript)
  const recentQuestionIds = useMemo(() => {
    if (!activeCanvas) return new Set<string>();
    const tCodings = activeCanvas.codings
      .filter(c => c.transcriptId === transcriptId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const c of tCodings) {
      if (!seen.has(c.questionId)) {
        seen.add(c.questionId);
        ids.push(c.questionId);
      }
      if (ids.length >= 3) break;
    }
    return new Set(ids);
  }, [activeCanvas, transcriptId]);

  // Filtered and sorted questions
  const filteredQuestions = useMemo(() => {
    let result = questions;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((qq: CanvasQuestion) => qq.text.toLowerCase().includes(q));
    }
    // Sort: recent first, then alphabetical
    return [...result].sort((a: CanvasQuestion, b: CanvasQuestion) => {
      const aRecent = recentQuestionIds.has(a.id) ? 0 : 1;
      const bRecent = recentQuestionIds.has(b.id) ? 0 : 1;
      if (aRecent !== bRecent) return aRecent - bRecent;
      return a.text.localeCompare(b.text);
    });
  }, [questions, search, recentQuestionIds]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Delay adding listener to avoid immediate close from the mouseup that triggered this
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

  // Focus search on open if there are questions
  useEffect(() => {
    if (questions.length > 3) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [questions.length]);

  const handleCodeToQuestion = async (questionId: string, questionText: string) => {
    try {
      await createCoding(transcriptId, questionId, startOffset, endOffset, codedText);
      window.getSelection()?.removeAllRanges();
      toast.success(`Coded to "${questionText.slice(0, 30)}${questionText.length > 30 ? '...' : ''}"`);
      onClose();
    } catch {
      toast.error('Failed to code text');
    }
  };

  const handleCodeInVivo = async () => {
    try {
      await codeInVivo(transcriptId, startOffset, endOffset, codedText);
      window.getSelection()?.removeAllRanges();
      toast.success('In-vivo code created');
      onClose();
    } catch {
      toast.error('Failed to create in-vivo code');
    }
  };

  const handleSpreadToParagraph = async () => {
    try {
      await spreadToParagraph(transcriptId, startOffset, endOffset, codedText);
      window.getSelection()?.removeAllRanges();
      toast.success('Spread to paragraph');
      onClose();
    } catch {
      toast.error('Failed to spread to paragraph');
    }
  };

  const handleCreateNewCode = async () => {
    if (!search.trim() || creating) return;
    setCreating(true);
    try {
      const q = await addQuestion(search.trim());
      await createCoding(transcriptId, q.id, startOffset, endOffset, codedText);
      window.getSelection()?.removeAllRanges();
      toast.success(`New code "${search.trim().slice(0, 30)}" created`);
      onClose();
    } catch {
      toast.error('Failed to create code');
    } finally {
      setCreating(false);
    }
  };

  // Position: above the selection, centered
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(anchorRect.x - 140, window.innerWidth - 300)),
    top: Math.max(8, anchorRect.y - 12),
    transform: 'translateY(-100%)',
    zIndex: 9999,
  };

  return createPortal(
    <div ref={ref} className="context-menu-enter" style={popoverStyle}>
      <div className="w-[280px] rounded-xl border border-gray-200/60 bg-white/98 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/98 overflow-hidden">

        {/* Selected text preview */}
        <div className="px-3 pt-2.5 pb-1.5">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate italic">
            &ldquo;{codedText.slice(0, 60)}{codedText.length > 60 ? '...' : ''}&rdquo;
          </p>
        </div>

        {/* Search bar — shown when > 3 questions */}
        {questions.length > 3 && (
          <div className="px-2.5 pb-1.5">
            <div className="relative">
              <svg className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 pl-7 pr-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-colors"
                placeholder="Search or create code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && search.trim() && filteredQuestions.length === 0) {
                    handleCreateNewCode();
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Question buttons */}
        {filteredQuestions.length > 0 && (
          <div className="px-2 pb-1">
            <div className="max-h-[200px] overflow-y-auto space-y-0.5">
              {filteredQuestions.map((q: CanvasQuestion) => {
                const isRecent = recentQuestionIds.has(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => handleCodeToQuestion(q.id, q.text)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-all duration-75 group ${
                      isRecent
                        ? 'bg-gray-50/80 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div
                      className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-gray-800 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: q.color }}
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">{q.text}</span>
                    {isRecent && (
                      <span className="text-[8px] text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0">recent</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Create new code from search */}
        {search.trim() && filteredQuestions.length === 0 && (
          <div className="px-2.5 pb-2">
            <button
              onClick={handleCreateNewCode}
              disabled={creating}
              className="flex w-full items-center gap-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 px-2.5 py-2 text-left transition-colors hover:bg-brand-100 dark:hover:bg-brand-900/30 disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                {creating ? 'Creating...' : `Create "${search.trim().slice(0, 25)}${search.trim().length > 25 ? '...' : ''}" and code`}
              </span>
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-gray-700" />

        {/* Action buttons */}
        <div className="p-1.5 flex gap-1">
          <button
            onClick={handleCodeInVivo}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
            title="Create a new code from the selected text"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
            </svg>
            In Vivo
          </button>
          <button
            onClick={handleSpreadToParagraph}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/30 transition-colors"
            title="Expand to full paragraph"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            Paragraph
          </button>
        </div>

        {/* Empty state */}
        {questions.length === 0 && !search.trim() && (
          <div className="px-3 py-3 text-center">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              No codes yet. Use &quot;In Vivo&quot; to create your first code, or type above to create one.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
