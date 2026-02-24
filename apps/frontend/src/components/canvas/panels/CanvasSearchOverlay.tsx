import { useState, useEffect, useRef, useMemo } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasTranscript, CanvasQuestion, CanvasMemo, CanvasTextCoding } from '@canvas-app/shared';

interface CanvasSearchOverlayProps {
  onClose: () => void;
  onResults: (nodeIds: Set<string>) => void;
}

interface SearchMatch {
  nodeId: string;
  label: string;
  type: 'transcript' | 'code' | 'memo' | 'coding';
  context?: string;
  color?: string;
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

  const matches = useMemo((): SearchMatch[] => {
    if (!query.trim() || !activeCanvas) return [];
    const q = query.toLowerCase();
    const results: SearchMatch[] = [];

    activeCanvas.transcripts.forEach((t: CanvasTranscript) => {
      if (t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q)) {
        const idx = t.content.toLowerCase().indexOf(q);
        const context = idx >= 0 ? '...' + t.content.slice(Math.max(0, idx - 20), idx + query.length + 30) + '...' : undefined;
        results.push({ nodeId: `transcript-${t.id}`, label: t.title, type: 'transcript', context });
      }
    });

    activeCanvas.questions.forEach((qn: CanvasQuestion) => {
      if (qn.text.toLowerCase().includes(q)) {
        results.push({ nodeId: `question-${qn.id}`, label: qn.text, type: 'code', color: qn.color });
      }
    });

    activeCanvas.memos.forEach((m: CanvasMemo) => {
      if ((m.title && m.title.toLowerCase().includes(q)) || m.content.toLowerCase().includes(q)) {
        results.push({ nodeId: `memo-${m.id}`, label: m.title || 'Memo', type: 'memo', context: m.content.slice(0, 60) });
      }
    });

    // Also search coded text
    activeCanvas.codings.forEach((c: CanvasTextCoding) => {
      if (c.codedText.toLowerCase().includes(q)) {
        const qn = activeCanvas.questions.find((q: CanvasQuestion) => q.id === c.questionId);
        results.push({
          nodeId: `transcript-${c.transcriptId}`,
          label: `Coded: "${c.codedText.slice(0, 50)}"`,
          type: 'coding',
          color: qn?.color,
        });
      }
    });

    return results;
  }, [query, activeCanvas]);

  const matchingNodeIds = useMemo(() => new Set(matches.map(m => m.nodeId)), [matches]);

  useEffect(() => {
    onResults(query.trim() ? matchingNodeIds : new Set());
  }, [matchingNodeIds, query, onResults]);

  const totalNodes =
    (activeCanvas?.transcripts.length ?? 0) +
    (activeCanvas?.questions.length ?? 0) +
    (activeCanvas?.memos.length ?? 0);

  return (
    <div className="absolute top-3 left-1/2 z-40 -translate-x-1/2">
      <div className="command-palette-enter w-80 rounded-xl border border-gray-200/80 bg-white/95 shadow-lg backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/95 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50">
          <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none dark:text-gray-200 dark:placeholder-gray-500"
            placeholder="Search nodes, text, codings..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query.trim() && (
            <span className="text-[10px] text-gray-400 whitespace-nowrap tabular-nums">
              {matchingNodeIds.size}/{totalNodes}
            </span>
          )}
          <button
            onClick={() => { onResults(new Set()); onClose(); }}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Close (Esc)"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Results list */}
        {query.trim() && matches.length > 0 && (
          <div className="max-h-60 overflow-y-auto p-1">
            {matches.slice(0, 20).map((m, i) => (
              <div
                key={`${m.nodeId}-${i}`}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                {m.type === 'code' && m.color ? (
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                ) : m.type === 'transcript' ? (
                  <svg className="h-3 w-3 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                ) : m.type === 'memo' ? (
                  <svg className="h-3 w-3 shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                ) : (
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.color || '#6B7280' }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-gray-700 dark:text-gray-300 truncate">{m.label}</p>
                  {m.context && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{m.context}</p>
                  )}
                </div>
                <span className="shrink-0 text-[9px] text-gray-400 uppercase">{m.type}</span>
              </div>
            ))}
            {matches.length > 20 && (
              <p className="text-center text-[10px] text-gray-400 py-1">+{matches.length - 20} more</p>
            )}
          </div>
        )}

        {query.trim() && matches.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">
            No matches found
          </div>
        )}
      </div>
    </div>
  );
}
