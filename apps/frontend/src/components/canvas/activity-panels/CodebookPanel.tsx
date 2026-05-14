import { useMemo, useState } from 'react';
import { useCanvasStore, useCanvasQuestions, useCanvasCodings } from '../../../stores/canvasStore';

/**
 * Sprint G — Codebook panel. Shows every code in the active canvas with a
 * coding-count badge, sortable by recency (default) or frequency. Click a
 * code to focus its node on the canvas; the sidebar stays open so the
 * researcher can keep navigating without losing the codebook view.
 */
export default function CodebookPanel() {
  const questions = useCanvasQuestions();
  const codings = useCanvasCodings();
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const setSelectedQuestionId = useCanvasStore((s) => s.setSelectedQuestionId);
  const selectedQuestionId = useCanvasStore((s) => s.selectedQuestionId);
  const [sortMode, setSortMode] = useState<'recency' | 'frequency' | 'alpha'>('recency');

  const codingsByQuestion = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of codings) m.set(c.questionId, (m.get(c.questionId) ?? 0) + 1);
    return m;
  }, [codings]);

  const ordered = useMemo(() => {
    const arr = [...questions];
    if (sortMode === 'frequency') {
      arr.sort((a, b) => (codingsByQuestion.get(b.id) ?? 0) - (codingsByQuestion.get(a.id) ?? 0));
    } else if (sortMode === 'alpha') {
      arr.sort((a, b) => a.text.localeCompare(b.text));
    } else {
      // recency = sortOrder (preserved by canvasStore)
      arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    return arr;
  }, [questions, sortMode, codingsByQuestion]);

  if (!activeCanvasId) {
    return <p className="px-3 py-3 text-[11px] text-gray-400 dark:text-gray-500">Open a canvas to see its codebook.</p>;
  }

  return (
    <div className="py-2">
      <div className="px-3 pb-2 flex items-center gap-2 text-[10px]">
        <span className="text-gray-400">Sort</span>
        {(
          [
            ['recency', 'Recent'],
            ['frequency', 'Most-used'],
            ['alpha', 'A → Z'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSortMode(id)}
            className={`rounded px-1.5 py-0.5 ${
              sortMode === id
                ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-medium'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {ordered.length === 0 ? (
        <p className="px-3 text-[11px] text-gray-400 dark:text-gray-500">
          No codes yet. Highlight transcript text to create your first code.
        </p>
      ) : (
        <ul className="px-1">
          {ordered.map((q) => {
            const count = codingsByQuestion.get(q.id) ?? 0;
            const isSelected = selectedQuestionId === q.id;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setSelectedQuestionId(isSelected ? null : q.id)}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors ${
                    isSelected ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  data-testid={`codebook-panel-code-${q.id}`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: q.color }}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-200 truncate flex-1">{q.text}</span>
                  {count > 0 && (
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 tabular-nums">{count}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
