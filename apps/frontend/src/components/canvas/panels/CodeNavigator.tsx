import { useMemo, useState } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript } from '@canvas-app/shared';

interface CodeNavigatorProps {
  onFocusNode: (nodeId: string) => void;
}

interface TreeItem {
  question: CanvasQuestion;
  children: TreeItem[];
  codingCount: number;
}

export default function CodeNavigator({ onFocusNode }: CodeNavigatorProps) {
  const { activeCanvas, setSelectedQuestionId, selectedQuestionId } = useCanvasStore();
  const [activeTab, setActiveTab] = useState<'codes' | 'sources'>('codes');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const questions = activeCanvas?.questions ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];
  const codings = activeCanvas?.codings ?? [];

  // Build question tree
  const tree = useMemo(() => {
    const codingCounts = new Map<string, number>();
    codings.forEach((c: CanvasTextCoding) => {
      codingCounts.set(c.questionId, (codingCounts.get(c.questionId) || 0) + 1);
    });

    const map = new Map<string, TreeItem>();
    const roots: TreeItem[] = [];

    questions.forEach((q: CanvasQuestion) => {
      map.set(q.id, {
        question: q,
        children: [],
        codingCount: codingCounts.get(q.id) || 0,
      });
    });

    questions.forEach((q: CanvasQuestion) => {
      const item = map.get(q.id)!;
      if (q.parentQuestionId && map.has(q.parentQuestionId)) {
        map.get(q.parentQuestionId)!.children.push(item);
      } else {
        roots.push(item);
      }
    });

    return roots;
  }, [questions, codings]);

  // Transcript coding coverage
  const transcriptCoverage = useMemo(() => {
    const coverageMap = new Map<string, { coded: number; total: number }>();
    transcripts.forEach((t: CanvasTranscript) => {
      const tCodings = codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
      const codedChars = new Set<number>();
      tCodings.forEach((c: CanvasTextCoding) => {
        for (let i = c.startOffset; i < c.endOffset; i++) codedChars.add(i);
      });
      coverageMap.set(t.id, { coded: codedChars.size, total: t.content.length });
    });
    return coverageMap;
  }, [transcripts, codings]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTreeItem = (item: TreeItem, depth: number = 0) => {
    const isExpanded = expandedIds.has(item.question.id);
    const isSelected = selectedQuestionId === item.question.id;
    const hasChildren = item.children.length > 0;

    return (
      <div key={item.question.id}>
        <button
          className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors duration-75 group ${
            isSelected
              ? 'bg-brand-50 dark:bg-brand-900/20'
              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => {
            setSelectedQuestionId(isSelected ? null : item.question.id);
            onFocusNode(`question-${item.question.id}`);
          }}
        >
          {hasChildren && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); toggleExpand(item.question.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleExpand(item.question.id); } }}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <svg className={`h-3 w-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          )}
          {!hasChildren && <span className="w-4" />}
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.question.color }}
          />
          <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
            {item.question.text}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
            {item.codingCount}
          </span>
        </button>
        {hasChildren && isExpanded && (
          <div>
            {item.children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-gray-200/80 bg-white/95 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/95">
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('codes')}
          className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
            activeTab === 'codes'
              ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Codes ({questions.length})
        </button>
        <button
          onClick={() => setActiveTab('sources')}
          className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
            activeTab === 'sources'
              ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Sources ({transcripts.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {activeTab === 'codes' && (
          <>
            {tree.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  No codes yet. Add a question from the toolbar.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {tree.map(item => renderTreeItem(item))}
              </div>
            )}
          </>
        )}

        {activeTab === 'sources' && (
          <>
            {transcripts.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  No sources yet. Add a transcript from the toolbar.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {transcripts.map((t: CanvasTranscript) => {
                  const coverage = transcriptCoverage.get(t.id);
                  const pct = coverage && coverage.total > 0
                    ? Math.round((coverage.coded / coverage.total) * 100)
                    : 0;

                  return (
                    <button
                      key={t.id}
                      onClick={() => onFocusNode(`transcript-${t.id}`)}
                      className="flex w-full flex-col gap-1 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="h-3.5 w-3.5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">{t.title}</span>
                      </div>
                      {/* Coverage bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 dark:bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-gray-400 tabular-nums w-7 text-right">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
          <span>{codings.length} codings</span>
          {transcripts.length > 0 && (() => {
            let totalCoded = 0;
            let totalChars = 0;
            transcriptCoverage.forEach(v => { totalCoded += v.coded; totalChars += v.total; });
            const overallPct = totalChars > 0 ? Math.round((totalCoded / totalChars) * 100) : 0;
            return <span>{overallPct}% coverage</span>;
          })()}
        </div>
      </div>
    </div>
  );
}
