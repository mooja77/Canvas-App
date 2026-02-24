import { useState, useEffect, useRef, useMemo } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasTranscript, CanvasQuestion, CanvasMemo } from '@canvas-app/shared';

interface CanvasSearchOverlayProps {
  onClose: () => void;
  onResults: (nodeIds: Set<string>) => void;
}

export default function CanvasSearchOverlay({ onClose, onResults }: CanvasSearchOverlayProps) {
  const { activeCanvas } = useCanvasStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onResults(new Set());
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onResults]);

  const matchingNodeIds = useMemo(() => {
    if (!query.trim() || !activeCanvas) return new Set<string>();
    const q = query.toLowerCase();
    const ids = new Set<string>();

    activeCanvas.transcripts.forEach((t: CanvasTranscript) => {
      if (t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q)) {
        ids.add(`transcript-${t.id}`);
      }
    });

    activeCanvas.questions.forEach((qn: CanvasQuestion) => {
      if (qn.text.toLowerCase().includes(q)) {
        ids.add(`question-${qn.id}`);
      }
    });

    activeCanvas.memos.forEach((m: CanvasMemo) => {
      if (
        (m.title && m.title.toLowerCase().includes(q)) ||
        m.content.toLowerCase().includes(q)
      ) {
        ids.add(`memo-${m.id}`);
      }
    });

    return ids;
  }, [query, activeCanvas]);

  useEffect(() => {
    onResults(query.trim() ? matchingNodeIds : new Set());
  }, [matchingNodeIds, query, onResults]);

  const totalNodes =
    (activeCanvas?.transcripts.length ?? 0) +
    (activeCanvas?.questions.length ?? 0) +
    (activeCanvas?.memos.length ?? 0);

  return (
    <div className="absolute top-3 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/95">
        <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="w-52 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none dark:text-gray-200 dark:placeholder-gray-500"
          placeholder="Search canvas nodes..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query.trim() && (
          <span className="text-[10px] text-gray-400 whitespace-nowrap">
            {matchingNodeIds.size}/{totalNodes}
          </span>
        )}
        <button
          onClick={() => { onResults(new Set()); onClose(); }}
          className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Close search (Esc)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
