import { useMemo } from 'react';
import { useActiveCanvas } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTextCoding, CanvasMemo, CanvasCase, CanvasTranscript } from '@qualcanvas/shared';

interface PresentationModeProps {
  onExit: () => void;
}

export default function PresentationMode({ onExit }: PresentationModeProps) {
  const activeCanvas = useActiveCanvas();

  const rawQuestions = activeCanvas?.questions;
  const rawCodings = activeCanvas?.codings;
  const rawTranscripts = activeCanvas?.transcripts;
  const questions = useMemo(() => rawQuestions ?? [], [rawQuestions]);
  const codings = useMemo(() => rawCodings ?? [], [rawCodings]);
  const memos = activeCanvas?.memos ?? [];
  const cases = activeCanvas?.cases ?? [];
  const transcripts = useMemo(() => rawTranscripts ?? [], [rawTranscripts]);

  // Theme summary cards
  const themeSummaries = useMemo(() => {
    return questions.map((q: CanvasQuestion) => {
      const qCodings = codings.filter((c: CanvasTextCoding) => c.questionId === q.id);
      const topQuotes = qCodings.slice(0, 3).map(c => ({
        text: c.codedText,
        source: transcripts.find((t: CanvasTranscript) => t.id === c.transcriptId)?.title || 'Unknown',
      }));
      return { question: q, codingCount: qCodings.length, topQuotes };
    }).sort((a, b) => b.codingCount - a.codingCount);
  }, [questions, codings, transcripts]);

  // All coded excerpts grouped by code
  const excerptsByCode = useMemo(() => {
    return questions.map((q: CanvasQuestion) => {
      const qCodings = codings.filter((c: CanvasTextCoding) => c.questionId === q.id);
      return {
        question: q,
        excerpts: qCodings.map(c => ({
          text: c.codedText,
          source: transcripts.find((t: CanvasTranscript) => t.id === c.transcriptId)?.title || 'Unknown',
        })),
      };
    }).filter(g => g.excerpts.length > 0);
  }, [questions, codings, transcripts]);

  // Code frequencies for bar chart
  const codeFrequencies = useMemo(() => {
    return questions
      .map((q: CanvasQuestion) => ({
        name: q.text,
        color: q.color,
        count: codings.filter((c: CanvasTextCoding) => c.questionId === q.id).length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [questions, codings]);

  const maxFreq = Math.max(...codeFrequencies.map(f => f.count), 1);

  if (!activeCanvas) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-white dark:bg-gray-900 print:relative print:overflow-visible">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-6 py-3 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/95 print:static print:border-b-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{activeCanvas.name}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {transcripts.length} sources &middot; {questions.length} codes &middot; {codings.length} codings
          </p>
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors print:hidden"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          Exit Presentation
        </button>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-10">
        {/* Theme Summary Cards */}
        {themeSummaries.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-4">
              Themes & Codes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {themeSummaries.map(ts => (
                <div
                  key={ts.question.id}
                  className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                  style={{ borderLeftWidth: 4, borderLeftColor: ts.question.color }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: ts.question.color }} />
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{ts.question.text}</h3>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{ts.codingCount} coding{ts.codingCount !== 1 ? 's' : ''}</span>
                  {ts.topQuotes.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {ts.topQuotes.map((q, i) => (
                        <div key={i} className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="italic">&ldquo;{q.text.slice(0, 120)}{q.text.length > 120 ? '...' : ''}&rdquo;</span>
                          <span className="text-gray-400 ml-1">— {q.source}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Code Frequencies */}
        {codeFrequencies.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-4">
              Code Frequencies
            </h2>
            <div className="space-y-2">
              {codeFrequencies.map(cf => (
                <div key={cf.name} className="flex items-center gap-3">
                  <span className="w-40 text-xs text-gray-600 dark:text-gray-400 truncate text-right">{cf.name}</span>
                  <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{ width: `${(cf.count / maxFreq) * 100}%`, backgroundColor: cf.color }}
                    />
                  </div>
                  <span className="w-8 text-xs text-gray-500 dark:text-gray-400 tabular-nums">{cf.count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Key Quotes */}
        {excerptsByCode.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-4">
              Key Quotes by Code
            </h2>
            <div className="space-y-6">
              {excerptsByCode.map(group => (
                <div key={group.question.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.question.color }} />
                    <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">{group.question.text}</h3>
                    <span className="text-[10px] text-gray-400">({group.excerpts.length})</span>
                  </div>
                  <div className="space-y-1.5 pl-5">
                    {group.excerpts.slice(0, 5).map((ex, i) => (
                      <div key={i} className="text-xs text-gray-600 dark:text-gray-400 border-l-2 pl-2" style={{ borderColor: group.question.color }}>
                        <span className="italic">&ldquo;{ex.text.slice(0, 200)}{ex.text.length > 200 ? '...' : ''}&rdquo;</span>
                        <span className="text-gray-400 ml-1">— {ex.source}</span>
                      </div>
                    ))}
                    {group.excerpts.length > 5 && (
                      <p className="text-[10px] text-gray-400 pl-2">...and {group.excerpts.length - 5} more</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Memos */}
        {memos.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-4">
              Research Memos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memos.map((m: CanvasMemo) => (
                <div
                  key={m.id}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: m.color || '#FEF3C7' }}
                >
                  {m.title && <h3 className="text-sm font-semibold text-gray-800 mb-1">{m.title}</h3>}
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cases Overview */}
        {cases.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-4">
              Cases Overview
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Case</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Transcripts</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Attributes</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c: CanvasCase) => {
                    const linkedCount = transcripts.filter((t: CanvasTranscript) => t.caseId === c.id).length;
                    const attrs = typeof c.attributes === 'object' && c.attributes ? Object.entries(c.attributes) : [];
                    return (
                      <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 px-3 text-gray-800 dark:text-gray-200 font-medium">{c.name}</td>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{linkedCount}</td>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                          {attrs.map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
