import { useMemo } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasTranscript, CanvasQuestion, CanvasTextCoding } from '@canvas-app/shared';

interface Props {
  onClose: () => void;
}

export default function ProjectDashboard({ onClose }: Props) {
  const { activeCanvas } = useCanvasStore();

  const stats = useMemo(() => {
    if (!activeCanvas) return null;
    const { transcripts, questions, codings, memos, cases } = activeCanvas;

    // Coverage calculation
    let totalChars = 0;
    const codedChars = new Set<string>();
    transcripts.forEach((t: CanvasTranscript) => {
      totalChars += t.content.length;
      codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id).forEach((c: CanvasTextCoding) => {
        for (let i = c.startOffset; i < Math.min(c.endOffset, t.content.length); i++) {
          codedChars.add(`${t.id}-${i}`);
        }
      });
    });
    const coveragePct = totalChars > 0 ? Math.round((codedChars.size / totalChars) * 100) : 0;

    // Total words
    const totalWords = transcripts.reduce((sum: number, t: CanvasTranscript) => sum + t.content.split(/\s+/).filter(Boolean).length, 0);

    // Per-code stats (top 10)
    const questionMap = new Map<string, CanvasQuestion>();
    questions.forEach((q: CanvasQuestion) => questionMap.set(q.id, q));
    const codeFreqs = questions
      .map((q: CanvasQuestion) => ({
        name: q.text,
        color: q.color,
        count: codings.filter((c: CanvasTextCoding) => c.questionId === q.id).length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const maxFreq = Math.max(1, ...codeFreqs.map(f => f.count));

    // Per-transcript coverage
    const transcriptCoverage = transcripts.map((t: CanvasTranscript) => {
      const tCodings = codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
      const chars = new Set<number>();
      tCodings.forEach((c: CanvasTextCoding) => {
        for (let i = c.startOffset; i < Math.min(c.endOffset, t.content.length); i++) chars.add(i);
      });
      return {
        title: t.title,
        coverage: t.content.length > 0 ? Math.round((chars.size / t.content.length) * 100) : 0,
        codingCount: tCodings.length,
        wordCount: t.content.split(/\s+/).filter(Boolean).length,
      };
    });

    // Recent codings (last 8)
    const recentCodings = [...codings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
      .map((c: CanvasTextCoding) => {
        const transcript = transcripts.find((t: CanvasTranscript) => t.id === c.transcriptId);
        const question = questionMap.get(c.questionId);
        return {
          codedText: c.codedText.slice(0, 60) + (c.codedText.length > 60 ? '...' : ''),
          codeName: question?.text || 'Unknown',
          codeColor: question?.color || '#888',
          transcriptTitle: transcript?.title || 'Unknown',
          date: new Date(c.createdAt).toLocaleDateString(),
        };
      });

    return {
      transcriptCount: transcripts.length,
      codeCount: questions.length,
      codingCount: codings.length,
      memoCount: memos.length,
      caseCount: cases.length,
      coveragePct,
      totalWords,
      codeFreqs,
      maxFreq,
      transcriptCoverage,
      recentCodings,
    };
  }, [activeCanvas]);

  if (!stats) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-content w-[800px] max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Project Overview</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{activeCanvas?.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              label="Transcripts"
              value={stats.transcriptCount}
              sublabel={`${stats.totalWords.toLocaleString()} words`}
              color="blue"
              icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>}
            />
            <MetricCard
              label="Codes"
              value={stats.codeCount}
              sublabel={`${stats.codingCount} codings`}
              color="purple"
              icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>}
            />
            <MetricCard
              label="Coverage"
              value={stats.coveragePct}
              valueSuffix="%"
              sublabel="of text coded"
              color="emerald"
              icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" /></svg>}
            />
            <MetricCard
              label="Memos"
              value={stats.memoCount}
              sublabel={stats.caseCount > 0 ? `${stats.caseCount} cases` : 'analytical notes'}
              color="amber"
              icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>}
            />
          </div>

          {/* Two-column layout: Code Frequency + Transcript Coverage */}
          <div className="grid grid-cols-2 gap-6">
            {/* Code Frequency */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-750/50">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Code Frequency</h4>
              {stats.codeFreqs.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No codes yet</p>
              ) : (
                <div className="space-y-2">
                  {stats.codeFreqs.map((cf, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cf.color }} />
                      <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate flex-1 min-w-0">{cf.name}</span>
                      <div className="w-24 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(cf.count / stats.maxFreq) * 100}%`, backgroundColor: cf.color }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400 w-6 text-right">{cf.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transcript Coverage */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-750/50">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Transcript Coverage</h4>
              {stats.transcriptCoverage.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No transcripts yet</p>
              ) : (
                <div className="space-y-2">
                  {stats.transcriptCoverage.map((tc, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate flex-1 min-w-0">{tc.title}</span>
                      <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${tc.coverage}%`,
                            backgroundColor: tc.coverage < 30 ? '#f59e0b' : tc.coverage < 70 ? '#3b82f6' : '#10b981',
                          }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400 w-8 text-right">{tc.coverage}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Coding Activity */}
          {stats.recentCodings.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-750/50">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Coding Activity</h4>
              <div className="space-y-1.5">
                {stats.recentCodings.map((rc, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <div className="mt-0.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: rc.codeColor }} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] text-gray-700 dark:text-gray-300">
                        <span className="font-medium" style={{ color: rc.codeColor }}>{rc.codeName}</span>
                        <span className="mx-1 text-gray-300 dark:text-gray-600">&middot;</span>
                        <span className="text-gray-500 dark:text-gray-400">{rc.transcriptTitle}</span>
                      </span>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate italic">&ldquo;{rc.codedText}&rdquo;</p>
                    </div>
                    <span className="text-[9px] text-gray-400 shrink-0">{rc.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Metric card sub-component
function MetricCard({ label, value, valueSuffix, sublabel, color, icon }: {
  label: string;
  value: number;
  valueSuffix?: string;
  sublabel: string;
  color: 'blue' | 'purple' | 'emerald' | 'amber';
  icon: React.ReactNode;
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  };
  const valueColor = {
    blue: 'text-blue-700 dark:text-blue-300',
    purple: 'text-purple-700 dark:text-purple-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`rounded-lg p-1.5 ${colorMap[color]}`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valueColor[color]}`}>
        {value.toLocaleString()}{valueSuffix || ''}
      </p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sublabel}</p>
    </div>
  );
}
