import { useMemo, useState, useCallback } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript, CanvasCase } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface CodeNavigatorProps {
  onFocusNode: (nodeId: string) => void;
}

interface TreeItem {
  question: CanvasQuestion;
  children: TreeItem[];
  codingCount: number;
}

export default function CodeNavigator({ onFocusNode }: CodeNavigatorProps) {
  const { activeCanvas, setSelectedQuestionId, selectedQuestionId, updateQuestion, deleteQuestion } = useCanvasStore();
  const [activeTab, setActiveTab] = useState<'codes' | 'sources' | 'cases'>('codes');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'name' | 'count'>('count');

  const questions = activeCanvas?.questions ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];
  const codings = activeCanvas?.codings ?? [];
  const cases = activeCanvas?.cases ?? [];

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

    // Sort
    const sortFn = (a: TreeItem, b: TreeItem) => {
      if (sortMode === 'count') return b.codingCount - a.codingCount;
      return a.question.text.localeCompare(b.question.text);
    };
    roots.sort(sortFn);
    roots.forEach(r => r.children.sort(sortFn));

    return roots;
  }, [questions, codings, sortMode]);

  // Filter tree by search
  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();
    const filterItem = (item: TreeItem): TreeItem | null => {
      const matchesSearch = item.question.text.toLowerCase().includes(q);
      const filteredChildren = item.children.map(filterItem).filter(Boolean) as TreeItem[];
      if (matchesSearch || filteredChildren.length > 0) {
        return { ...item, children: filteredChildren };
      }
      return null;
    };
    return tree.map(filterItem).filter(Boolean) as TreeItem[];
  }, [tree, search]);

  // Total coding count
  const totalCodingCount = useMemo(() => codings.length, [codings]);

  // Transcript coding coverage
  const transcriptCoverage = useMemo(() => {
    const coverageMap = new Map<string, { coded: number; total: number; questionCount: number }>();
    transcripts.forEach((t: CanvasTranscript) => {
      const tCodings = codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
      const codedChars = new Set<number>();
      const questionIds = new Set<string>();
      tCodings.forEach((c: CanvasTextCoding) => {
        for (let i = c.startOffset; i < c.endOffset; i++) codedChars.add(i);
        questionIds.add(c.questionId);
      });
      coverageMap.set(t.id, { coded: codedChars.size, total: t.content.length, questionCount: questionIds.size });
    });
    return coverageMap;
  }, [transcripts, codings]);

  // Case membership
  const caseMembership = useMemo(() => {
    const map = new Map<string, CanvasTranscript[]>();
    cases.forEach((c: CanvasCase) => {
      map.set(c.id, transcripts.filter((t: CanvasTranscript) => t.caseId === c.id));
    });
    return map;
  }, [cases, transcripts]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = useCallback(() => {
    const ids = new Set<string>();
    questions.forEach((q: CanvasQuestion) => ids.add(q.id));
    setExpandedIds(ids);
  }, [questions]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const renderTreeItem = (item: TreeItem, depth: number = 0) => {
    const isExpanded = expandedIds.has(item.question.id);
    const isSelected = selectedQuestionId === item.question.id;
    const hasChildren = item.children.length > 0;

    // Coding frequency bar width
    const maxCount = Math.max(...tree.map(t => t.codingCount), 1);
    const barWidth = Math.max(4, (item.codingCount / maxCount) * 100);

    return (
      <div key={item.question.id}>
        <button
          className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-all duration-75 group relative ${
            isSelected
              ? 'bg-brand-50 dark:bg-brand-900/20 shadow-sm'
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
              <svg className={`h-3 w-3 text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          )}
          {!hasChildren && <span className="w-4" />}
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/50 dark:ring-gray-800/50"
            style={{ backgroundColor: item.question.color }}
          />
          <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
            {item.question.text}
          </span>

          {/* Frequency bar + count */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-12 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: item.question.color,
                  opacity: 0.6,
                }}
              />
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums w-5 text-right">
              {item.codingCount}
            </span>
          </div>
        </button>
        {hasChildren && isExpanded && (
          <div className="animate-slide-down">
            {item.children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="sidebar-slide-in flex h-full w-60 shrink-0 flex-col border-r border-gray-200/80 bg-white/95 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-800/95">
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
        {cases.length > 0 && (
          <button
            onClick={() => setActiveTab('cases')}
            className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
              activeTab === 'cases'
                ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Cases ({cases.length})
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {/* ─── CODES TAB ─── */}
        {activeTab === 'codes' && (
          <div className="p-1.5">
            {/* Search + Sort controls */}
            {questions.length > 0 && (
              <div className="mb-1.5 space-y-1">
                <div className="relative">
                  <svg className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 pl-7 pr-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-colors"
                    placeholder="Filter codes..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSortMode('count')}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${sortMode === 'count' ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      By count
                    </button>
                    <button
                      onClick={() => setSortMode('name')}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${sortMode === 'name' ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      A-Z
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleExpandAll}
                      className="text-[9px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
                      title="Expand all"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                      </svg>
                    </button>
                    <button
                      onClick={handleCollapseAll}
                      className="text-[9px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
                      title="Collapse all"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {filteredTree.length === 0 ? (
              <div className="py-6 text-center">
                {search.trim() ? (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    No codes match &ldquo;{search}&rdquo;
                  </p>
                ) : (
                  <>
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/20">
                      <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      No codes yet
                    </p>
                    <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">
                      Select text in a transcript to start coding
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredTree.map(item => renderTreeItem(item))}
              </div>
            )}
          </div>
        )}

        {/* ─── SOURCES TAB ─── */}
        {activeTab === 'sources' && (
          <div className="p-1.5">
            {transcripts.length === 0 ? (
              <div className="py-6 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  No sources yet
                </p>
                <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">
                  Add transcripts from the toolbar
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {transcripts.map((t: CanvasTranscript) => {
                  const coverage = transcriptCoverage.get(t.id);
                  const pct = coverage && coverage.total > 0
                    ? Math.round((coverage.coded / coverage.total) * 100)
                    : 0;
                  const wordCount = t.content.split(/\s+/).filter(Boolean).length;

                  return (
                    <button
                      key={t.id}
                      onClick={() => onFocusNode(`transcript-${t.id}`)}
                      className="flex w-full flex-col gap-1 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="h-3.5 w-3.5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">{t.title}</span>
                      </div>
                      {/* Stats row */}
                      <div className="flex items-center gap-2 pl-5.5">
                        <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 dark:bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-gray-400 tabular-nums w-7 text-right">{pct}%</span>
                      </div>
                      <div className="flex items-center gap-3 pl-5.5 text-[9px] text-gray-400">
                        <span>{wordCount.toLocaleString()} words</span>
                        {coverage && coverage.questionCount > 0 && (
                          <span>{coverage.questionCount} codes</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── CASES TAB ─── */}
        {activeTab === 'cases' && (
          <div className="p-1.5">
            {cases.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  No cases yet
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {cases.map((c: CanvasCase) => {
                  const members = caseMembership.get(c.id) ?? [];
                  return (
                    <button
                      key={c.id}
                      onClick={() => onFocusNode(`case-${c.id}`)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0 text-teal-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">{c.name}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                        {members.length} source{members.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
          <span>{totalCodingCount} coding{totalCodingCount !== 1 ? 's' : ''}</span>
          {transcripts.length > 0 && (() => {
            let totalCoded = 0;
            let totalChars = 0;
            transcriptCoverage.forEach(v => { totalCoded += v.coded; totalChars += v.total; });
            const overallPct = totalChars > 0 ? Math.round((totalCoded / totalChars) * 100) : 0;
            return (
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${overallPct}%`,
                      backgroundColor: overallPct < 30 ? '#f59e0b' : overallPct < 70 ? '#3b82f6' : '#10b981',
                    }}
                  />
                </div>
                <span>{overallPct}%</span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
