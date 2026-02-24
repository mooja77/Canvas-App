import { useEffect, useRef, useMemo } from 'react';
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
  const { activeCanvas, createCoding, codeInVivo, spreadToParagraph } = useCanvasStore();
  const questions = useMemo(() => activeCanvas?.questions ?? [], [activeCanvas?.questions]);

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

  // Position: above the selection, centered
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(anchorRect.x - 120, window.innerWidth - 260)),
    top: Math.max(8, anchorRect.y - 12),
    transform: 'translateY(-100%)',
    zIndex: 9999,
  };

  return createPortal(
    <div ref={ref} className="context-menu-enter" style={popoverStyle}>
      <div className="w-[260px] rounded-xl border border-gray-200/60 bg-white/98 shadow-xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/98 overflow-hidden">
        {/* Question buttons */}
        {questions.length > 0 && (
          <div className="p-2">
            <p className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Code to question
            </p>
            <div className="max-h-[180px] overflow-y-auto space-y-0.5">
              {questions.map((q: CanvasQuestion) => (
                <button
                  key={q.id}
                  onClick={() => handleCodeToQuestion(q.id, q.text)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-75 hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
                >
                  <div
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-gray-800 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: q.color }}
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{q.text}</span>
                </button>
              ))}
            </div>
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
        {questions.length === 0 && (
          <div className="px-3 py-3 text-center">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              No questions yet. Use &quot;In Vivo&quot; to create your first code.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
