import { useMemo, useState, useCallback } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript, CanvasCase } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface ExcerptBrowserModalProps {
  onClose: () => void;
}

type SortMode = 'newest' | 'oldest' | 'source' | 'code' | 'length';
type ViewMode = 'excerpts' | 'kwic';

interface EnrichedExcerpt {
  coding: CanvasTextCoding;
  transcriptTitle: string;
  codeName: string;
  codeColor: string;
  parentTheme: string;
  caseName: string;
  contextBefore: string;
  contextAfter: string;
}

export default function ExcerptBrowserModal({ onClose }: ExcerptBrowserModalProps) {
  const { activeCanvas, deleteCoding, setSelectedQuestionId } = useCanvasStore();
  const [filterCode, setFilterCode] = useState<string>('all');
  const [filterTranscript, setFilterTranscript] = useState<string>('all');
  const [filterCase, setFilterCase] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('excerpts');
  const [kwicWord, setKwicWord] = useState('');
  const [kwicWindowSize] = useState(50);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Build lookup maps
  const { questionMap, transcriptMap, caseMap } = useMemo(() => {
    const qMap = new Map<string, CanvasQuestion>();
    const tMap = new Map<string, CanvasTranscript>();
    const cMap = new Map<string, CanvasCase>();
    activeCanvas?.questions.forEach(q => qMap.set(q.id, q));
    activeCanvas?.transcripts.forEach(t => tMap.set(t.id, t));
    activeCanvas?.cases.forEach(c => cMap.set(c.id, c));
    return { questionMap: qMap, transcriptMap: tMap, caseMap: cMap };
  }, [activeCanvas]);

  // Enrich all excerpts with context
  const allExcerpts = useMemo((): EnrichedExcerpt[] => {
    if (!activeCanvas) return [];
    return activeCanvas.codings.map((coding: CanvasTextCoding) => {
      const transcript = transcriptMap.get(coding.transcriptId);
      const question = questionMap.get(coding.questionId);
      const parentQ = question?.parentQuestionId ? questionMap.get(question.parentQuestionId) : null;
      const caseObj = transcript?.caseId ? caseMap.get(transcript.caseId) : null;
      const content = transcript?.content || '';
      const ctxStart = Math.max(0, coding.startOffset - 80);
      const ctxEnd = Math.min(content.length, coding.endOffset + 80);
      return {
        coding,
        transcriptTitle: transcript?.title || 'Unknown',
        codeName: question?.text || 'Unknown',
        codeColor: question?.color || '#888',
        parentTheme: parentQ?.text || '',
        caseName: caseObj?.name || '',
        contextBefore: content.slice(ctxStart, coding.startOffset),
        contextAfter: content.slice(coding.endOffset, ctxEnd),
      };
    });
  }, [activeCanvas, questionMap, transcriptMap, caseMap]);

  // Apply filters
  const filteredExcerpts = useMemo(() => {
    let items = allExcerpts;
    if (filterCode !== 'all') items = items.filter(e => e.coding.questionId === filterCode);
    if (filterTranscript !== 'all') items = items.filter(e => e.coding.transcriptId === filterTranscript);
    if (filterCase !== 'all') {
      items = items.filter(e => {
        const t = transcriptMap.get(e.coding.transcriptId);
        return t?.caseId === filterCase;
      });
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      items = items.filter(e =>
        e.coding.codedText.toLowerCase().includes(q) ||
        e.codeName.toLowerCase().includes(q) ||
        e.coding.annotation?.toLowerCase().includes(q)
      );
    }
    // Sort
    switch (sortMode) {
      case 'newest': items = [...items].sort((a, b) => new Date(b.coding.createdAt).getTime() - new Date(a.coding.createdAt).getTime()); break;
      case 'oldest': items = [...items].sort((a, b) => new Date(a.coding.createdAt).getTime() - new Date(b.coding.createdAt).getTime()); break;
      case 'source': items = [...items].sort((a, b) => a.transcriptTitle.localeCompare(b.transcriptTitle)); break;
      case 'code': items = [...items].sort((a, b) => a.codeName.localeCompare(b.codeName)); break;
      case 'length': items = [...items].sort((a, b) => b.coding.codedText.length - a.coding.codedText.length); break;
    }
    return items;
  }, [allExcerpts, filterCode, filterTranscript, filterCase, searchText, sortMode, transcriptMap]);

  // Group excerpts by code for grouped view
  const groupedByCode = useMemo(() => {
    const groups = new Map<string, EnrichedExcerpt[]>();
    filteredExcerpts.forEach(e => {
      const key = e.coding.questionId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    });
    return Array.from(groups.entries()).map(([qId, items]) => ({
      questionId: qId,
      codeName: items[0].codeName,
      codeColor: items[0].codeColor,
      parentTheme: items[0].parentTheme,
      excerpts: items,
    }));
  }, [filteredExcerpts]);

  // KWIC concordance view
  const kwicResults = useMemo(() => {
    if (!kwicWord.trim() || !activeCanvas) return [];
    const word = kwicWord.toLowerCase();
    const results: { transcriptTitle: string; before: string; match: string; after: string; transcriptId: string; offset: number }[] = [];
    activeCanvas.transcripts.forEach((t: CanvasTranscript) => {
      const lower = t.content.toLowerCase();
      let idx = lower.indexOf(word);
      while (idx !== -1) {
        const before = t.content.slice(Math.max(0, idx - kwicWindowSize), idx);
        const match = t.content.slice(idx, idx + kwicWord.length);
        const after = t.content.slice(idx + kwicWord.length, idx + kwicWord.length + kwicWindowSize);
        results.push({ transcriptTitle: t.title, before, match, after, transcriptId: t.id, offset: idx });
        idx = lower.indexOf(word, idx + 1);
      }
    });
    return results;
  }, [kwicWord, kwicWindowSize, activeCanvas]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleCopyExcerpt = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch { toast.error('Failed to copy'); }
  }, []);

  const handleDeleteExcerpt = useCallback(async (codingId: string) => {
    try {
      await deleteCoding(codingId);
      toast.success('Excerpt removed');
    } catch { toast.error('Failed to remove'); }
  }, [deleteCoding]);

  // Stats
  const uniqueCodes = useMemo(() => new Set(filteredExcerpts.map(e => e.coding.questionId)).size, [filteredExcerpts]);
  const uniqueSources = useMemo(() => new Set(filteredExcerpts.map(e => e.coding.transcriptId)).size, [filteredExcerpts]);

  const questions = activeCanvas?.questions ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];
  const cases = activeCanvas?.cases ?? [];

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="modal-content w-[960px] max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
              <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Excerpt Browser</h3>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {filteredExcerpts.length} excerpt{filteredExcerpts.length !== 1 ? 's' : ''} across {uniqueSources} source{uniqueSources !== 1 ? 's' : ''} and {uniqueCodes} code{uniqueCodes !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setViewMode('excerpts')}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${viewMode === 'excerpts' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'}`}
              >
                Excerpts
              </button>
              <button
                onClick={() => setViewMode('kwic')}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors border-l border-gray-200 dark:border-gray-600 ${viewMode === 'kwic' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'}`}
              >
                KWIC
              </button>
            </div>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        {viewMode === 'excerpts' && (
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700/50 px-5 py-2">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 pl-8 pr-3 py-1.5 text-[11px] text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-colors"
                placeholder="Search excerpts..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
            {/* Code filter */}
            <select
              className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5 text-[11px] text-gray-600 dark:text-gray-400 focus:border-brand-400 outline-none"
              value={filterCode}
              onChange={e => setFilterCode(e.target.value)}
            >
              <option value="all">All codes ({questions.length})</option>
              {questions.map((q: CanvasQuestion) => (
                <option key={q.id} value={q.id}>{q.text}</option>
              ))}
            </select>
            {/* Transcript filter */}
            <select
              className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5 text-[11px] text-gray-600 dark:text-gray-400 focus:border-brand-400 outline-none"
              value={filterTranscript}
              onChange={e => setFilterTranscript(e.target.value)}
            >
              <option value="all">All sources ({transcripts.length})</option>
              {transcripts.map((t: CanvasTranscript) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            {/* Case filter */}
            {cases.length > 0 && (
              <select
                className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5 text-[11px] text-gray-600 dark:text-gray-400 focus:border-brand-400 outline-none"
                value={filterCase}
                onChange={e => setFilterCase(e.target.value)}
              >
                <option value="all">All cases</option>
                {cases.map((c: CanvasCase) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {/* Sort */}
            <select
              className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5 text-[11px] text-gray-600 dark:text-gray-400 focus:border-brand-400 outline-none"
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="code">By code</option>
              <option value="source">By source</option>
              <option value="length">By length</option>
            </select>
          </div>
        )}

        {/* KWIC search bar */}
        {viewMode === 'kwic' && (
          <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700/50 px-5 py-2">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 pl-8 pr-3 py-1.5 text-[11px] text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-colors"
                placeholder="Enter keyword for concordance view..."
                value={kwicWord}
                onChange={e => setKwicWord(e.target.value)}
                autoFocus
              />
            </div>
            <span className="text-[10px] text-gray-400">
              {kwicWord.trim() ? `${kwicResults.length} occurrence${kwicResults.length !== 1 ? 's' : ''} across all transcripts` : 'Type a word to see every occurrence in context'}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* EXCERPTS VIEW */}
          {viewMode === 'excerpts' && (
            <>
              {filteredExcerpts.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-750">
                    <svg className="h-6 w-6 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {searchText.trim() || filterCode !== 'all' || filterTranscript !== 'all'
                      ? 'No excerpts match your filters.'
                      : 'No coded excerpts yet. Select text in a transcript and assign a code to start.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {sortMode === 'code'
                    ? groupedByCode.map(group => (
                        <div key={group.questionId}>
                          {/* Group header */}
                          <button
                            onClick={() => toggleExpanded(group.questionId)}
                            className="flex w-full items-center gap-2.5 px-5 py-2.5 bg-gray-50/80 dark:bg-gray-750/50 hover:bg-gray-100/80 dark:hover:bg-gray-750 transition-colors sticky top-0 z-10"
                          >
                            <svg className={`h-3 w-3 text-gray-400 transition-transform ${expandedIds.has(group.questionId) || !expandedIds.size ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.codeColor }} />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{group.codeName}</span>
                            {group.parentTheme && <span className="text-[10px] text-gray-400">/ {group.parentTheme}</span>}
                            <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{group.excerpts.length}</span>
                          </button>
                          {(expandedIds.has(group.questionId) || expandedIds.size === 0) && (
                            <div className="divide-y divide-gray-50 dark:divide-gray-700/30">
                              {group.excerpts.map(e => (
                                <ExcerptCard key={e.coding.id} excerpt={e} onCopy={handleCopyExcerpt} onDelete={handleDeleteExcerpt} onSelectCode={setSelectedQuestionId} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    : filteredExcerpts.map(e => (
                        <ExcerptCard key={e.coding.id} excerpt={e} onCopy={handleCopyExcerpt} onDelete={handleDeleteExcerpt} onSelectCode={setSelectedQuestionId} />
                      ))}
                </div>
              )}
            </>
          )}

          {/* KWIC VIEW */}
          {viewMode === 'kwic' && (
            <>
              {!kwicWord.trim() ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20">
                    <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">Keyword-in-Context (KWIC) Concordance</p>
                  <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Enter a keyword above to see every occurrence with surrounding context</p>
                </div>
              ) : kwicResults.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-gray-400">No occurrences of &ldquo;{kwicWord}&rdquo; found</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-750 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 w-24">Source</th>
                      <th className="px-1 py-2 text-right font-medium text-gray-400 w-[35%]">Before</th>
                      <th className="px-1 py-2 text-center font-medium text-brand-600 dark:text-brand-400">Keyword</th>
                      <th className="px-1 py-2 text-left font-medium text-gray-400 w-[35%]">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30 font-mono">
                    {kwicResults.map((r, i) => (
                      <tr key={`${r.transcriptId}-${r.offset}-${i}`} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                        <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 truncate max-w-[100px]" title={r.transcriptTitle}>{r.transcriptTitle}</td>
                        <td className="px-1 py-1.5 text-right text-gray-500 dark:text-gray-400 truncate">{r.before}</td>
                        <td className="px-1 py-1.5 text-center font-semibold text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-900/20">{r.match}</td>
                        <td className="px-1 py-1.5 text-left text-gray-500 dark:text-gray-400 truncate">{r.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {viewMode === 'excerpts'
              ? `${filteredExcerpts.length} of ${allExcerpts.length} excerpts`
              : kwicWord.trim() ? `${kwicResults.length} occurrences` : 'KWIC concordance view'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (viewMode === 'excerpts') {
                  const lines = filteredExcerpts.map(e =>
                    `[${e.codeName}] "${e.coding.codedText}" — ${e.transcriptTitle}${e.coding.annotation ? ` (Note: ${e.coding.annotation})` : ''}`
                  );
                  navigator.clipboard.writeText(lines.join('\n'));
                } else {
                  const lines = kwicResults.map(r => `${r.before}**${r.match}**${r.after} — ${r.transcriptTitle}`);
                  navigator.clipboard.writeText(lines.join('\n'));
                }
                toast.success('Copied to clipboard');
              }}
              className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
              Copy All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Individual excerpt card ──
function ExcerptCard({
  excerpt,
  onCopy,
  onDelete,
  onSelectCode,
}: {
  excerpt: EnrichedExcerpt;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
  onSelectCode: (id: string | null) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  return (
    <div
      className="px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-750/30 transition-colors group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Meta row */}
      <div className="flex items-center gap-2 mb-1.5">
        <button
          onClick={() => onSelectCode(excerpt.coding.questionId)}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-600"
          style={{ backgroundColor: excerpt.codeColor + '18', color: excerpt.codeColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: excerpt.codeColor }} />
          {excerpt.codeName}
        </button>
        {excerpt.parentTheme && (
          <span className="text-[9px] text-gray-400">/ {excerpt.parentTheme}</span>
        )}
        <span className="text-[10px] text-gray-400 ml-auto flex items-center gap-1">
          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          {excerpt.transcriptTitle}
        </span>
        {excerpt.caseName && (
          <span className="text-[9px] text-gray-400 rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5">{excerpt.caseName}</span>
        )}
      </div>
      {/* Excerpt text with context */}
      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
        {excerpt.contextBefore && <span className="text-gray-400 dark:text-gray-500">...{excerpt.contextBefore}</span>}
        <span className="rounded px-0.5 font-medium" style={{ backgroundColor: excerpt.codeColor + '20' }}>
          {excerpt.coding.codedText}
        </span>
        {excerpt.contextAfter && <span className="text-gray-400 dark:text-gray-500">{excerpt.contextAfter}...</span>}
      </p>
      {/* Annotation */}
      {excerpt.coding.annotation && (
        <div className="mt-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 px-2 py-1 border-l-2 border-amber-400">
          <p className="text-[10px] text-amber-700 dark:text-amber-300">{excerpt.coding.annotation}</p>
        </div>
      )}
      {/* Actions */}
      <div className={`mt-1.5 flex items-center gap-2 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-[9px] text-gray-400 tabular-nums">{excerpt.coding.codedText.length} chars</span>
        <button onClick={() => onCopy(excerpt.coding.codedText)} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Copy</button>
        <button onClick={() => onDelete(excerpt.coding.id)} className="text-[10px] text-red-400 hover:text-red-600">Remove</button>
      </div>
    </div>
  );
}
