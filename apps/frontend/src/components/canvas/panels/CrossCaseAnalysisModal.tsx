import { useState, useMemo, useRef } from 'react';
import { useActiveCanvas } from '../../../stores/canvasStore';
import type { CanvasCase, CanvasQuestion, CanvasTextCoding } from '@qualcanvas/shared';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

interface CrossCaseAnalysisModalProps {
  onClose: () => void;
}

export default function CrossCaseAnalysisModal({ onClose }: CrossCaseAnalysisModalProps) {
  // Keep Tab inside the dialog and give focus back to the trigger on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  const groupSelectRef = useRef<HTMLSelectElement>(null);
  useFocusTrap(dialogRef);
  useEscapeToClose(onClose);
  const activeCanvas = useActiveCanvas();
  const [groupByAttr, setGroupByAttr] = useState('');
  const [filterAttr, setFilterAttr] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [viewMode, setViewMode] = useState<'matrix' | 'excerpts'>('matrix');

  const rawCases = activeCanvas?.cases;
  const rawQuestions = activeCanvas?.questions;
  const rawCodings = activeCanvas?.codings;
  const rawTranscripts = activeCanvas?.transcripts;
  const cases = useMemo(() => rawCases ?? [], [rawCases]);
  const questions = useMemo(() => rawQuestions ?? [], [rawQuestions]);
  const codings = useMemo(() => rawCodings ?? [], [rawCodings]);
  const transcripts = useMemo(() => rawTranscripts ?? [], [rawTranscripts]);

  // Discover all attribute keys across all cases
  const attrKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of cases) {
      if (c.attributes) {
        for (const k of Object.keys(c.attributes)) keys.add(k);
      }
    }
    return Array.from(keys).sort();
  }, [cases]);

  // Get all values for a given attribute
  const attrValues = useMemo(() => {
    if (!groupByAttr && !filterAttr) return [];
    const key = groupByAttr || filterAttr;
    const vals = new Set<string>();
    for (const c of cases) {
      const v = c.attributes?.[key];
      if (v) vals.add(v);
    }
    return Array.from(vals).sort();
  }, [cases, groupByAttr, filterAttr]);

  // Build a lookup: transcriptId -> case
  const transcriptCaseMap = useMemo(() => {
    const caseMap = new Map(cases.map((c) => [c.id, c]));
    const map = new Map<string, CanvasCase>();
    for (const t of transcripts) {
      if (t.caseId) {
        const c = caseMap.get(t.caseId);
        if (c) map.set(t.id, c);
      }
    }
    return map;
  }, [cases, transcripts]);

  // Filter codings by attribute filter
  const filteredCodings = useMemo(() => {
    let result = codings;
    if (filterAttr && filterValue) {
      result = result.filter((c) => {
        const cs = transcriptCaseMap.get(c.transcriptId);
        return cs?.attributes?.[filterAttr] === filterValue;
      });
    }
    if (selectedCode) {
      result = result.filter((c) => c.questionId === selectedCode);
    }
    return result;
  }, [codings, filterAttr, filterValue, selectedCode, transcriptCaseMap]);

  // Build matrix: attrValue x code -> count
  const matrix = useMemo(() => {
    if (!groupByAttr) return null;

    const groups = new Map<string, Map<string, { count: number; excerpts: string[] }>>();

    // Initialize groups for all attribute values
    for (const v of attrValues) {
      const codeMap = new Map<string, { count: number; excerpts: string[] }>();
      for (const q of questions) {
        codeMap.set(q.id, { count: 0, excerpts: [] });
      }
      groups.set(v, codeMap);
    }

    // Count codings per group
    for (const coding of filteredCodings) {
      const cs = transcriptCaseMap.get(coding.transcriptId);
      if (!cs) continue;
      const attrVal = cs.attributes?.[groupByAttr];
      if (!attrVal) continue;
      const codeMap = groups.get(attrVal);
      if (!codeMap) continue;
      const entry = codeMap.get(coding.questionId);
      if (entry) {
        entry.count++;
        if (entry.excerpts.length < 3) entry.excerpts.push(coding.codedText.slice(0, 60));
      }
    }

    return {
      rows: Array.from(groups.entries()).map(([attrVal, codeMap]) => ({
        attrVal,
        cells: questions.map((q) => ({
          questionId: q.id,
          ...(codeMap.get(q.id) ?? { count: 0, excerpts: [] }),
        })),
        total: Array.from(codeMap.values()).reduce((s, c) => s + c.count, 0),
      })),
      codes: questions,
    };
  }, [groupByAttr, attrValues, filteredCodings, questions, transcriptCaseMap]);

  // Excerpt view: group codings by attribute value
  const excerptGroups = useMemo(() => {
    if (!groupByAttr) return [];
    const groups = new Map<
      string,
      (CanvasTextCoding & { caseName: string; codeName: string; codeColor: string; source: string })[]
    >();

    const qMap = new Map(questions.map((q) => [q.id, q]));
    const tMap = new Map(transcripts.map((t) => [t.id, t]));

    for (const coding of filteredCodings) {
      const cs = transcriptCaseMap.get(coding.transcriptId);
      if (!cs) continue;
      const attrVal = cs.attributes?.[groupByAttr] ?? 'Unclassified';
      const q = qMap.get(coding.questionId);
      const t = tMap.get(coding.transcriptId);
      if (!groups.has(attrVal)) groups.set(attrVal, []);
      groups.get(attrVal)!.push({
        ...coding,
        caseName: cs.name,
        codeName: q?.text ?? '?',
        codeColor: q?.color ?? '#94A3B8',
        source: t?.title ?? '?',
      });
    }

    return Array.from(groups.entries())
      .map(([attrVal, codings]) => ({ attrVal, codings }))
      .sort((a, b) => a.attrVal.localeCompare(b.attrVal));
  }, [groupByAttr, filteredCodings, questions, transcripts, transcriptCaseMap]);

  // Summary stats
  const stats = useMemo(() => {
    const casesWithAttrs = cases.filter((c) => Object.keys(c.attributes ?? {}).length > 0).length;
    const assignedTranscripts = transcripts.filter((t) => t.caseId).length;
    return { casesWithAttrs, assignedTranscripts, totalCodings: filteredCodings.length };
  }, [cases, transcripts, filteredCodings]);

  const handleExport = () => {
    if (!matrix) return;
    const lines = [
      'Cross-Case Analysis Report',
      `Grouped by: ${groupByAttr}`,
      filterAttr && filterValue ? `Filtered: ${filterAttr} = ${filterValue}` : '',
      selectedCode ? `Code filter: ${questions.find((q) => q.id === selectedCode)?.text ?? ''}` : '',
      '',
      // Header
      ['Attribute Value', ...matrix.codes.map((q) => q.text), 'Total'].join('\t'),
      // Rows
      ...matrix.rows.map((r) => [r.attrVal, ...r.cells.map((c) => c.count), r.total].join('\t')),
    ].filter(Boolean);
    const blob = new Blob([lines.join('\n')], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross-case-analysis-${Date.now()}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxCount = matrix ? Math.max(1, ...matrix.rows.flatMap((r) => r.cells.map((c) => c.count))) : 1;
  const openCases = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('qualcanvas:open-canvas-modal', { detail: { modal: 'case-manager' } }));
  };
  const openSource = () => {
    onClose();
    window.dispatchEvent(
      transcripts.length
        ? new CustomEvent('qualcanvas:focus-node', { detail: { nodeId: `transcript-${transcripts[0].id}` } })
        : new CustomEvent('qualcanvas:open-transcript-picker'),
    );
  };
  const clearFilters = () => {
    setFilterAttr('');
    setFilterValue('');
    setSelectedCode('');
  };
  const hasFilter = !!(selectedCode || (filterAttr && filterValue));
  const emptyFiltered = hasFilter && filteredCodings.length === 0 && codings.length > 0;
  const matchedCount =
    viewMode === 'excerpts'
      ? excerptGroups.reduce((sum, group) => sum + group.codings.length, 0)
      : (matrix?.rows.reduce((sum, row) => sum + row.total, 0) ?? 0);
  const recovery = (
    <div className="space-y-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-700/30 dark:text-gray-200">
      <p>
        {emptyFiltered
          ? 'No passages match these filters. Your saved passages have not been removed.'
          : codings.length === 0
            ? 'Compare groups after highlighting a passage and giving it a code. Your research stays unchanged until you choose an action.'
            : 'Your coded transcripts are not assigned to cases with this group attribute. Add the attribute and assign each transcript in Cases.'}
      </p>
      <button
        className="btn-primary min-h-11 px-3"
        onClick={emptyFiltered ? clearFilters : codings.length === 0 ? openSource : openCases}
      >
        {emptyFiltered
          ? 'Clear filters'
          : codings.length === 0
            ? transcripts.length
              ? 'Open a transcript to code'
              : 'Paste or import a transcript'
            : 'Set up cases and assign transcripts'}
      </button>
      <p>
        <a className="text-indigo-700 underline dark:text-indigo-300" href="/help/first-code.html">
          See a coded-passage example
        </a>
      </p>
    </div>
  );

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cross-case-title"
        className="modal-content w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
          <div>
            <h3 id="cross-case-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Cross-Case Analysis
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Query and compare codings across case attributes ({stats.casesWithAttrs} case
              {stats.casesWithAttrs !== 1 ? 's' : ''} with attributes, {stats.assignedTranscripts} assigned transcript
              {stats.assignedTranscripts !== 1 ? 's' : ''})
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg p-1 text-gray-600 dark:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Config */}
        <div className="border-b border-gray-100 dark:border-gray-700/50 px-5 py-3">
          <p className="mb-3 text-sm text-gray-700 dark:text-gray-200">
            Compare what different groups said, such as managers and staff. A case identifies a participant or
            organisation; an attribute describes their group.
          </p>
          {attrKeys.length === 0 ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No case attributes found. Add attributes to your cases (e.g., "role: Manager, age: 30-40") in the Cases
                panel to enable cross-case analysis.
              </p>
              <button className="btn-primary mt-3 min-h-11 px-3" onClick={openCases}>
                Set up cases and assign transcripts
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
                <div className="flex-1">
                  <label
                    htmlFor="cross-case-group"
                    className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
                  >
                    Group by attribute
                  </label>
                  <select
                    id="cross-case-group"
                    ref={groupSelectRef}
                    value={groupByAttr}
                    onChange={(e) => setGroupByAttr(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                  >
                    <option value="">Select attribute...</option>
                    {attrKeys.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label
                    htmlFor="cross-case-filter"
                    className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
                  >
                    Filter by attribute
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      id="cross-case-filter"
                      value={filterAttr}
                      onChange={(e) => {
                        setFilterAttr(e.target.value);
                        setFilterValue('');
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                    >
                      <option value="">No filter</option>
                      {attrKeys.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    {filterAttr && (
                      <select
                        aria-label="Filter attribute value"
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                      >
                        <option value="">All values</option>
                        {Array.from(new Set(cases.map((c) => c.attributes?.[filterAttr]).filter(Boolean)))
                          .sort()
                          .map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="cross-case-code"
                    className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
                  >
                    Filter by code
                  </label>
                  <select
                    id="cross-case-code"
                    value={selectedCode}
                    onChange={(e) => setSelectedCode(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                  >
                    <option value="">All codes</option>
                    {questions.map((q: CanvasQuestion) => (
                      <option key={q.id} value={q.id}>
                        {q.text}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
                  {(['matrix', 'excerpts'] as const).map((mode) => (
                    <button
                      key={mode}
                      aria-pressed={viewMode === mode}
                      onClick={() => setViewMode(mode)}
                      className={`min-h-8 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        viewMode === mode
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {mode === 'matrix' ? 'Heatmap Matrix' : 'Excerpts'}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {matchedCount} coding{matchedCount !== 1 ? 's' : ''} represented in this view
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div
          role="region"
          aria-label="Cross-case results"
          tabIndex={0}
          className="min-h-0 flex-1 overflow-auto px-5 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          {!groupByAttr ? (
            <div className="py-12 text-center">
              <svg
                className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.375"
                />
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {attrKeys.length
                  ? 'Choose the attribute you want to compare. For example, role compares managers with staff.'
                  : 'Start by adding cases and assigning your transcripts using the button above.'}
              </p>
              {attrKeys.length > 0 && (
                <button className="btn-primary mt-3 min-h-11 px-3" onClick={() => groupSelectRef.current?.focus()}>
                  Choose a group
                </button>
              )}
            </div>
          ) : matchedCount === 0 ? (
            recovery
          ) : viewMode === 'matrix' && matrix ? (
            /* Heatmap matrix view */
            <div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white dark:bg-gray-800 px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                      {groupByAttr}
                    </th>
                    {matrix.codes.map((q) => (
                      <th
                        key={q.id}
                        className="px-2 py-2 text-center text-[10px] font-medium border-b border-gray-200 dark:border-gray-700 max-w-[100px]"
                        style={{ color: 'inherit' }}
                        title={q.text}
                      >
                        <div className="truncate">{q.text}</div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row) => (
                    <tr key={row.attrVal} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="sticky left-0 bg-white dark:bg-gray-800 px-3 py-2 font-medium text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700/50 whitespace-nowrap">
                        {row.attrVal}
                      </td>
                      {row.cells.map((cell) => {
                        const intensity = cell.count / maxCount;
                        return (
                          <td
                            key={cell.questionId}
                            className="px-2 py-2 text-center border-b border-gray-100 dark:border-gray-700/50 relative group"
                            style={{
                              backgroundColor:
                                cell.count > 0 ? `rgba(99, 102, 241, ${0.08 + intensity * 0.35})` : undefined,
                            }}
                          >
                            {cell.count > 0 && (
                              <>
                                <span className="font-semibold text-gray-700 dark:text-gray-200">{cell.count}</span>
                                {cell.excerpts.length > 0 && (
                                  <details className="text-left text-xs">
                                    <summary className="min-h-8 cursor-pointer text-gray-700 dark:text-gray-200">
                                      Read passages
                                    </summary>
                                    {cell.excerpts.map((ex, i) => (
                                      <p
                                        key={i}
                                        className="max-w-48 whitespace-normal break-words text-gray-700 dark:text-gray-200"
                                      >
                                        {ex}
                                      </p>
                                    ))}
                                  </details>
                                )}
                              </>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center font-bold text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700/50">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {matrix.rows.length === 0 && (
                <p className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">
                  No data for this attribute. Make sure cases have the "{groupByAttr}" attribute and transcripts are
                  assigned.
                </p>
              )}
            </div>
          ) : viewMode === 'excerpts' ? (
            /* Excerpts grouped by attribute value */
            <div className="space-y-4">
              {excerptGroups.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">No excerpts found</p>
              ) : (
                excerptGroups.map((g) => (
                  <div key={g.attrVal}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {groupByAttr}: {g.attrVal}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        ({g.codings.length} excerpt{g.codings.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="space-y-1 ml-2">
                      {g.codings.slice(0, 20).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-700/30 px-3 py-1.5"
                        >
                          <div
                            className="h-2 w-2 rounded-full mt-1 shrink-0"
                            style={{ backgroundColor: c.codeColor }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="font-medium text-gray-700 dark:text-gray-200">{c.codeName}</span>
                              <span aria-hidden="true" className="text-gray-600 dark:text-gray-300">
                                |
                              </span>
                              <span className="text-gray-600 dark:text-gray-300">
                                {c.caseName} / {c.source}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">"{c.codedText}"</p>
                          </div>
                        </div>
                      ))}
                      {g.codings.length > 20 && (
                        <p className="text-[10px] text-gray-400 ml-4">...and {g.codings.length - 20} more</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="border-t border-gray-200 px-5 py-3 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-200">
          <a className="text-indigo-700 underline dark:text-indigo-300" href="/training#video-14">
            See a worked case example
          </a>
          <p className="mt-2">
            Need help setting this up for your research?{' '}
            <a className="text-indigo-700 underline dark:text-indigo-300" href="mailto:support@qualcanvas.com">
              Email us
            </a>
            . We reply within two working days and can help by email; no call needed.
          </p>
        </div>

        {/* Footer */}
        {matrix && matrix.rows.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700/50 px-5 py-2 flex justify-end">
            <button
              onClick={handleExport}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            >
              Export TSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
