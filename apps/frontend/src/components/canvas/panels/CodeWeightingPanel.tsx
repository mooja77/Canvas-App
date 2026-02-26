import { useState, useMemo, useCallback, useEffect } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript } from '@canvas-app/shared';

interface CodeWeightingPanelProps {
  onClose: () => void;
}

// Store weights in localStorage per canvas
function getWeights(canvasId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`canvas-weights-${canvasId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveWeights(canvasId: string, weights: Record<string, number>) {
  localStorage.setItem(`canvas-weights-${canvasId}`, JSON.stringify(weights));
}

function StarRating({ value, onChange, size = 'sm' }: { value: number; onChange: (v: number) => void; size?: 'sm' | 'md' }) {
  const [hover, setHover] = useState(0);
  const s = size === 'md' ? 'h-4 w-4' : 'h-3 w-3';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onChange(star === value ? 0 : star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0 transition-colors"
          title={star === value ? 'Clear rating' : `Rate ${star}/5`}
        >
          <svg
            className={`${s} ${(hover || value) >= star ? 'text-amber-400' : 'text-gray-200 dark:text-gray-600'}`}
            fill={(hover || value) >= star ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function CodeWeightingPanel({ onClose }: CodeWeightingPanelProps) {
  const { activeCanvas, activeCanvasId } = useCanvasStore();
  const [weights, setWeightsState] = useState<Record<string, number>>({});
  const [filterCode, setFilterCode] = useState('');
  const [sortBy, setSortBy] = useState<'source' | 'code' | 'weight'>('source');

  const questions = activeCanvas?.questions ?? [];
  const codings = activeCanvas?.codings ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];

  // Load weights from localStorage
  useEffect(() => {
    if (activeCanvasId) {
      setWeightsState(getWeights(activeCanvasId));
    }
  }, [activeCanvasId]);

  const setWeight = useCallback((codingId: string, weight: number) => {
    if (!activeCanvasId) return;
    setWeightsState(prev => {
      const next = { ...prev };
      if (weight === 0) delete next[codingId];
      else next[codingId] = weight;
      saveWeights(activeCanvasId, next);
      return next;
    });
  }, [activeCanvasId]);

  // Build enriched codings list
  const enrichedCodings = useMemo(() => {
    const qMap = new Map(questions.map(q => [q.id, q]));
    const tMap = new Map(transcripts.map(t => [t.id, t]));

    return codings.map(c => ({
      ...c,
      question: qMap.get(c.questionId),
      transcript: tMap.get(c.transcriptId),
      weight: weights[c.id] || 0,
    }));
  }, [codings, questions, transcripts, weights]);

  // Filter and sort
  const displayCodings = useMemo(() => {
    let result = enrichedCodings;
    if (filterCode) {
      result = result.filter(c => c.questionId === filterCode);
    }
    result.sort((a, b) => {
      if (sortBy === 'weight') return (b.weight || 0) - (a.weight || 0);
      if (sortBy === 'code') return (a.question?.text ?? '').localeCompare(b.question?.text ?? '');
      return (a.transcript?.title ?? '').localeCompare(b.transcript?.title ?? '');
    });
    return result;
  }, [enrichedCodings, filterCode, sortBy]);

  // Weight stats
  const stats = useMemo(() => {
    const weighted = enrichedCodings.filter(c => c.weight > 0);
    const avgWeight = weighted.length > 0 ? weighted.reduce((s, c) => s + c.weight, 0) / weighted.length : 0;
    const perCode = new Map<string, { total: number; count: number; name: string; color: string }>();
    for (const c of enrichedCodings) {
      if (!c.question) continue;
      const entry = perCode.get(c.questionId) ?? { total: 0, count: 0, name: c.question.text, color: c.question.color };
      entry.total += c.weight || 0;
      entry.count++;
      perCode.set(c.questionId, entry);
    }
    return {
      totalCodings: enrichedCodings.length,
      weightedCount: weighted.length,
      avgWeight,
      perCode: Array.from(perCode.entries()).map(([id, v]) => ({
        id,
        name: v.name,
        color: v.color,
        avgWeight: v.count > 0 ? v.total / v.count : 0,
        count: v.count,
      })).sort((a, b) => b.avgWeight - a.avgWeight),
    };
  }, [enrichedCodings]);

  const handleExport = () => {
    const lines = [
      'Code Weighting Report',
      `Canvas: ${activeCanvas?.name ?? ''}`,
      `Total Codings: ${stats.totalCodings}`,
      `Weighted: ${stats.weightedCount}`,
      `Average Weight: ${stats.avgWeight.toFixed(2)}`,
      '',
      'Per-Code Average Weight:',
      ...stats.perCode.map(c => `  ${c.name}: ${c.avgWeight.toFixed(2)} avg (${c.count} codings)`),
      '',
      'All Weighted Codings:',
      ...enrichedCodings
        .filter(c => c.weight > 0)
        .sort((a, b) => b.weight - a.weight)
        .map(c => `  [${c.weight}/5] ${c.question?.text ?? '?'} | "${c.codedText.slice(0, 80)}" (${c.transcript?.title ?? '?'})`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-weights-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-content w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Code Weighting</h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Rate importance/intensity of coded segments (1-5 stars)</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats bar */}
        <div className="border-b border-gray-100 dark:border-gray-700/50 px-5 py-2 flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
          <span>{stats.totalCodings} codings</span>
          <span>{stats.weightedCount} weighted</span>
          <span>Avg: {stats.avgWeight > 0 ? stats.avgWeight.toFixed(1) + '/5' : '--'}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <select
              value={filterCode}
              onChange={e => setFilterCode(e.target.value)}
              className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <option value="">All codes</option>
              {questions.map((q: CanvasQuestion) => (
                <option key={q.id} value={q.id}>{q.text}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'source' | 'code' | 'weight')}
              className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <option value="source">Sort by source</option>
              <option value="code">Sort by code</option>
              <option value="weight">Sort by weight</option>
            </select>
          </div>
        </div>

        {/* Top codes by weight */}
        {stats.perCode.some(c => c.avgWeight > 0) && (
          <div className="border-b border-gray-100 dark:border-gray-700/50 px-5 py-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">Top:</span>
              {stats.perCode.filter(c => c.avgWeight > 0).slice(0, 8).map(c => (
                <button
                  key={c.id}
                  onClick={() => setFilterCode(filterCode === c.id ? '' : c.id)}
                  className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                    filterCode === c.id ? 'ring-2 ring-indigo-400' : ''
                  }`}
                  style={{ backgroundColor: c.color + '15', color: c.color }}
                >
                  <span className="font-medium">{c.name.slice(0, 15)}</span>
                  <span className="text-amber-500">{c.avgWeight.toFixed(1)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Codings list */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {displayCodings.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 dark:text-gray-500">
              No codings found{filterCode ? ' for this code' : ''}
            </div>
          ) : (
            <div className="space-y-1">
              {displayCodings.map(c => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: c.question?.color ?? '#94A3B8' }}
                      />
                      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                        {c.question?.text ?? 'Unknown'}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        in {c.transcript?.title ?? 'Unknown'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                      "{c.codedText}"
                    </p>
                  </div>
                  <div className="shrink-0 pt-1">
                    <StarRating
                      value={c.weight}
                      onChange={v => setWeight(c.id, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700/50 px-5 py-2 flex items-center justify-between">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Click stars to rate importance. Click again to clear.
          </p>
          <button
            onClick={handleExport}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          >
            Export Weights
          </button>
        </div>
      </div>
    </div>
  );
}
