import { useState, useMemo } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript } from '@canvas-app/shared';

interface IntercoderReliabilityModalProps {
  onClose: () => void;
}

// Segment transcripts into paragraph-level units for comparison
function segmentTranscript(content: string, unitSize: 'paragraph' | 'sentence'): { start: number; end: number }[] {
  const segments: { start: number; end: number }[] = [];
  if (unitSize === 'paragraph') {
    const parts = content.split(/\n\s*\n/);
    let offset = 0;
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        const start = content.indexOf(trimmed, offset);
        segments.push({ start, end: start + trimmed.length });
        offset = start + trimmed.length;
      }
    }
  } else {
    // Sentence-level
    const re = /[^.!?]+[.!?]+/g;
    let match;
    while ((match = re.exec(content)) !== null) {
      segments.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return segments.length > 0 ? segments : [{ start: 0, end: content.length }];
}

// Check if a coding overlaps with a segment
function overlaps(coding: CanvasTextCoding, segment: { start: number; end: number }): boolean {
  return coding.startOffset < segment.end && coding.endOffset > segment.start;
}

// Cohen's Kappa: κ = (Po - Pe) / (1 - Pe)
function computeKappa(a11: number, a10: number, a01: number, a00: number) {
  const n = a11 + a10 + a01 + a00;
  if (n === 0) return { kappa: 0, po: 0, pe: 0, n: 0 };
  const po = (a11 + a00) / n; // observed agreement
  const pA = (a11 + a10) / n; // proportion coded by A
  const pB = (a11 + a01) / n; // proportion coded by B
  const pe = pA * pB + (1 - pA) * (1 - pB); // expected agreement
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { kappa, po, pe, n };
}

function interpretKappa(k: number): { label: string; color: string } {
  if (k < 0) return { label: 'Poor', color: '#EF4444' };
  if (k <= 0.20) return { label: 'Slight', color: '#F97316' };
  if (k <= 0.40) return { label: 'Fair', color: '#F59E0B' };
  if (k <= 0.60) return { label: 'Moderate', color: '#EAB308' };
  if (k <= 0.80) return { label: 'Substantial', color: '#22C55E' };
  return { label: 'Almost Perfect', color: '#10B981' };
}

export default function IntercoderReliabilityModal({ onClose }: IntercoderReliabilityModalProps) {
  const { activeCanvas } = useCanvasStore();
  const [codeA, setCodeA] = useState('');
  const [codeB, setCodeB] = useState('');
  const [unitSize, setUnitSize] = useState<'paragraph' | 'sentence'>('paragraph');
  const [computed, setComputed] = useState(false);

  const questions = activeCanvas?.questions ?? [];
  const codings = activeCanvas?.codings ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];

  // Filter to codes that have at least 1 coding
  const codesWithCodings = useMemo(() => {
    const codedIds = new Set(codings.map(c => c.questionId));
    return questions.filter(q => codedIds.has(q.id));
  }, [questions, codings]);

  // Compute results
  const result = useMemo(() => {
    if (!codeA || !codeB || codeA === codeB || !computed) return null;

    const codingsA = codings.filter(c => c.questionId === codeA);
    const codingsB = codings.filter(c => c.questionId === codeB);

    let totalBoth = 0, totalOnlyA = 0, totalOnlyB = 0, totalNeither = 0;
    const perTranscript: {
      transcriptId: string;
      title: string;
      both: number;
      onlyA: number;
      onlyB: number;
      neither: number;
      segments: number;
    }[] = [];

    for (const t of transcripts) {
      const segments = segmentTranscript(t.content, unitSize);
      const tCodingsA = codingsA.filter(c => c.transcriptId === t.id);
      const tCodingsB = codingsB.filter(c => c.transcriptId === t.id);

      let both = 0, onlyA = 0, onlyB = 0, neither = 0;

      for (const seg of segments) {
        const hasA = tCodingsA.some(c => overlaps(c, seg));
        const hasB = tCodingsB.some(c => overlaps(c, seg));
        if (hasA && hasB) both++;
        else if (hasA) onlyA++;
        else if (hasB) onlyB++;
        else neither++;
      }

      totalBoth += both;
      totalOnlyA += onlyA;
      totalOnlyB += onlyB;
      totalNeither += neither;

      perTranscript.push({
        transcriptId: t.id,
        title: t.title,
        both,
        onlyA,
        onlyB,
        neither,
        segments: segments.length,
      });
    }

    const kResult = computeKappa(totalBoth, totalOnlyA, totalOnlyB, totalNeither);
    const interp = interpretKappa(kResult.kappa);

    return {
      ...kResult,
      both: totalBoth,
      onlyA: totalOnlyA,
      onlyB: totalOnlyB,
      neither: totalNeither,
      interpretation: interp,
      perTranscript,
    };
  }, [codeA, codeB, codings, transcripts, unitSize, computed]);

  const codeAName = questions.find(q => q.id === codeA)?.text ?? '';
  const codeBName = questions.find(q => q.id === codeB)?.text ?? '';

  const handleExport = () => {
    if (!result) return;
    const lines = [
      'Intercoder Reliability Report',
      `Code A: ${codeAName}`,
      `Code B: ${codeBName}`,
      `Unit: ${unitSize}`,
      '',
      `Cohen's Kappa: ${result.kappa.toFixed(3)} (${result.interpretation.label})`,
      `Observed Agreement: ${(result.po * 100).toFixed(1)}%`,
      `Expected Agreement: ${(result.pe * 100).toFixed(1)}%`,
      `Total Units: ${result.n}`,
      '',
      'Contingency Table:',
      `  Both coded: ${result.both}`,
      `  Only ${codeAName}: ${result.onlyA}`,
      `  Only ${codeBName}: ${result.onlyB}`,
      `  Neither: ${result.neither}`,
      '',
      'Per-Transcript Breakdown:',
      ...result.perTranscript.map(pt => {
        const ptK = computeKappa(pt.both, pt.onlyA, pt.onlyB, pt.neither);
        return `  ${pt.title}: κ=${ptK.kappa.toFixed(3)}, ${pt.segments} units, agree=${pt.both + pt.neither}/${pt.segments}`;
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intercoder-reliability-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Intercoder Reliability</h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Compare coding agreement between two codes using Cohen's Kappa</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Config */}
        <div className="border-b border-gray-100 dark:border-gray-700/50 px-5 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Code A</label>
              <select
                value={codeA}
                onChange={e => { setCodeA(e.target.value); setComputed(false); }}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="">Select code...</option>
                {codesWithCodings.map((q: CanvasQuestion) => (
                  <option key={q.id} value={q.id} disabled={q.id === codeB}>
                    {q.text} ({codings.filter(c => c.questionId === q.id).length} codings)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Code B</label>
              <select
                value={codeB}
                onChange={e => { setCodeB(e.target.value); setComputed(false); }}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="">Select code...</option>
                {codesWithCodings.map((q: CanvasQuestion) => (
                  <option key={q.id} value={q.id} disabled={q.id === codeA}>
                    {q.text} ({codings.filter(c => c.questionId === q.id).length} codings)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Analysis Unit</label>
              <div className="flex gap-2">
                {(['paragraph', 'sentence'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => { setUnitSize(u); setComputed(false); }}
                    className={`rounded-lg px-3 py-1 text-[10px] font-medium transition-colors ${
                      unitSize === u
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {u.charAt(0).toUpperCase() + u.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setComputed(true)}
              disabled={!codeA || !codeB || codeA === codeB}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Compute Kappa
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!result ? (
            <div className="py-12 text-center">
              <svg className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Select two codes and click "Compute Kappa" to calculate intercoder reliability
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 max-w-sm mx-auto">
                This compares how two codes overlap across transcript {unitSize}s. Useful for checking coding consistency, especially after multiple coding passes.
              </p>
            </div>
          ) : (
            <>
              {/* Kappa score */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Cohen's Kappa</div>
                <div className="text-3xl font-bold" style={{ color: result.interpretation.color }}>
                  {result.kappa.toFixed(3)}
                </div>
                <div
                  className="mt-1 inline-block rounded-full px-3 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: result.interpretation.color + '20', color: result.interpretation.color }}
                >
                  {result.interpretation.label} Agreement
                </div>
                <div className="mt-3 flex justify-center gap-6 text-[10px] text-gray-500 dark:text-gray-400">
                  <span>Observed: <strong>{(result.po * 100).toFixed(1)}%</strong></span>
                  <span>Expected: <strong>{(result.pe * 100).toFixed(1)}%</strong></span>
                  <span>Units: <strong>{result.n}</strong></span>
                </div>
              </div>

              {/* Contingency table */}
              <div>
                <h4 className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Contingency Table</h4>
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium"></th>
                        <th className="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">
                          {codeBName.slice(0, 20)} Present
                        </th>
                        <th className="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">
                          {codeBName.slice(0, 20)} Absent
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100 dark:border-gray-700/50">
                        <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{codeAName.slice(0, 20)} Present</td>
                        <td className="px-3 py-2 text-center font-semibold text-green-600 dark:text-green-400 bg-green-50/50 dark:bg-green-900/10">{result.both}</td>
                        <td className="px-3 py-2 text-center text-orange-600 dark:text-orange-400">{result.onlyA}</td>
                      </tr>
                      <tr className="border-t border-gray-100 dark:border-gray-700/50">
                        <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{codeAName.slice(0, 20)} Absent</td>
                        <td className="px-3 py-2 text-center text-blue-600 dark:text-blue-400">{result.onlyB}</td>
                        <td className="px-3 py-2 text-center font-semibold text-green-600 dark:text-green-400 bg-green-50/50 dark:bg-green-900/10">{result.neither}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Per-transcript breakdown */}
              {result.perTranscript.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2">Per-Transcript Breakdown</h4>
                  <div className="space-y-1.5">
                    {result.perTranscript.map(pt => {
                      const ptK = computeKappa(pt.both, pt.onlyA, pt.onlyB, pt.neither);
                      const ptInterp = interpretKappa(ptK.kappa);
                      const agreeRate = pt.segments > 0 ? ((pt.both + pt.neither) / pt.segments * 100) : 0;
                      return (
                        <div key={pt.transcriptId} className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{pt.title}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">{pt.segments} {unitSize}s</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold" style={{ color: ptInterp.color }}>
                              κ = {ptK.kappa.toFixed(2)}
                            </span>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">{agreeRate.toFixed(0)}% agree</p>
                          </div>
                          <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${agreeRate}%`, backgroundColor: ptInterp.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interpretation guide */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 p-3">
                <h4 className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 mb-2">Kappa Interpretation Guide</h4>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  {[
                    { range: '< 0', label: 'Poor', color: '#EF4444' },
                    { range: '0.00–0.20', label: 'Slight', color: '#F97316' },
                    { range: '0.21–0.40', label: 'Fair', color: '#F59E0B' },
                    { range: '0.41–0.60', label: 'Moderate', color: '#EAB308' },
                    { range: '0.61–0.80', label: 'Substantial', color: '#22C55E' },
                    { range: '0.81–1.00', label: 'Almost Perfect', color: '#10B981' },
                  ].map(g => (
                    <div key={g.label} className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="text-gray-600 dark:text-gray-400">{g.range}: <strong style={{ color: g.color }}>{g.label}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="border-t border-gray-100 dark:border-gray-700/50 px-5 py-2 flex justify-end">
            <button
              onClick={handleExport}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            >
              Export Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
