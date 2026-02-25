import { useMemo, useState } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript, CanvasCase } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface CodebookExportModalProps {
  onClose: () => void;
}

interface CodebookEntry {
  name: string;
  color: string;
  parentTheme: string;
  frequency: number;
  coveragePercent: number;
  examples: string[];
}

interface DataRow {
  transcriptTitle: string;
  codeName: string;
  codeColor: string;
  parentTheme: string;
  codedText: string;
  startOffset: number;
  endOffset: number;
  annotation: string;
  caseName: string;
  createdAt: string;
}

type Tab = 'codebook' | 'data';

export default function CodebookExportModal({ onClose }: CodebookExportModalProps) {
  const { activeCanvas } = useCanvasStore();
  const [tab, setTab] = useState<Tab>('codebook');

  const entries = useMemo((): CodebookEntry[] => {
    if (!activeCanvas) return [];
    const questions = activeCanvas.questions;
    const codings = activeCanvas.codings;
    const transcripts = activeCanvas.transcripts;

    const totalChars = transcripts.reduce((sum, t) => sum + t.content.length, 0);
    const questionMap = new Map<string, CanvasQuestion>();
    questions.forEach(q => questionMap.set(q.id, q));

    return questions.map((q: CanvasQuestion) => {
      const qCodings = codings.filter((c: CanvasTextCoding) => c.questionId === q.id);
      const codedChars = qCodings.reduce((sum, c) => sum + (c.endOffset - c.startOffset), 0);
      const parentQ = q.parentQuestionId ? questionMap.get(q.parentQuestionId) : null;

      return {
        name: q.text,
        color: q.color,
        parentTheme: parentQ?.text || '',
        frequency: qCodings.length,
        coveragePercent: totalChars > 0 ? Math.round((codedChars / totalChars) * 1000) / 10 : 0,
        examples: qCodings.slice(0, 3).map(c => c.codedText.slice(0, 80)),
      };
    });
  }, [activeCanvas]);

  const dataRows = useMemo((): DataRow[] => {
    if (!activeCanvas) return [];
    const { transcripts, questions, codings, cases } = activeCanvas;
    const questionMap = new Map<string, CanvasQuestion>();
    questions.forEach(q => questionMap.set(q.id, q));
    const transcriptMap = new Map<string, CanvasTranscript>();
    transcripts.forEach(t => transcriptMap.set(t.id, t));
    const caseMap = new Map<string, CanvasCase>();
    cases.forEach(c => caseMap.set(c.id, c));

    return codings.map((c: CanvasTextCoding) => {
      const t = transcriptMap.get(c.transcriptId);
      const q = questionMap.get(c.questionId);
      const parentQ = q?.parentQuestionId ? questionMap.get(q.parentQuestionId) : null;
      const caseObj = t?.caseId ? caseMap.get(t.caseId) : null;
      return {
        transcriptTitle: t?.title || 'Unknown',
        codeName: q?.text || 'Unknown',
        codeColor: q?.color || '#888',
        parentTheme: parentQ?.text || '',
        codedText: c.codedText,
        startOffset: c.startOffset,
        endOffset: c.endOffset,
        annotation: c.annotation || '',
        caseName: caseObj?.name || '',
        createdAt: new Date(c.createdAt).toISOString().split('T')[0],
      };
    });
  }, [activeCanvas]);

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

  const handleCopyClipboard = async () => {
    if (tab === 'codebook') {
      const header = 'Code Name\tColor\tParent Theme\tFrequency\tCoverage %\tExample Excerpts';
      const rows = entries.map(e =>
        `${e.name}\t${e.color}\t${e.parentTheme}\t${e.frequency}\t${e.coveragePercent}%\t${e.examples.join(' | ')}`
      );
      await copyText([header, ...rows].join('\n'));
    } else {
      const header = 'Transcript\tCode\tParent Theme\tCoded Text\tAnnotation\tCase\tDate';
      const rows = dataRows.map(r =>
        `${r.transcriptTitle}\t${r.codeName}\t${r.parentTheme}\t${r.codedText}\t${r.annotation}\t${r.caseName}\t${r.createdAt}`
      );
      await copyText([header, ...rows].join('\n'));
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownloadCsv = () => {
    let csv: string;
    let filename: string;

    if (tab === 'codebook') {
      const header = 'Code Name,Color,Parent Theme,Frequency,Coverage %,Example Excerpts';
      const rows = entries.map(e =>
        `${escape(e.name)},${e.color},${escape(e.parentTheme)},${e.frequency},${e.coveragePercent}%,${escape(e.examples.join(' | '))}`
      );
      csv = [header, ...rows].join('\n');
      filename = `codebook-${activeCanvas?.name || 'export'}.csv`;
    } else {
      const header = 'Transcript,Code,Code Color,Parent Theme,Coded Text,Start,End,Annotation,Case,Date';
      const rows = dataRows.map(r =>
        `${escape(r.transcriptTitle)},${escape(r.codeName)},${r.codeColor},${escape(r.parentTheme)},${escape(r.codedText)},${r.startOffset},${r.endOffset},${escape(r.annotation)},${escape(r.caseName)},${r.createdAt}`
      );
      csv = [header, ...rows].join('\n');
      filename = `coded-data-${activeCanvas?.name || 'export'}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="modal-content w-[800px] max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl backdrop-blur-xl ring-1 ring-black/5 dark:bg-gray-800" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center gap-1">
            {/* Tabs */}
            <button
              onClick={() => setTab('codebook')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'codebook' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
            >
              Codebook
            </button>
            <button
              onClick={() => setTab('data')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'data' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
            >
              All Coded Data
              <span className="ml-1.5 rounded-full bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 text-[10px] tabular-nums">{dataRows.length}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClipboard}
              className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
              Copy
            </button>
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download CSV
            </button>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {tab === 'codebook' ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-750">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Code Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Color</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Parent Theme</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Frequency</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Coverage</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Example Excerpts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {entries.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No codes yet. Add questions and create codings first.</td></tr>
                ) : (
                  entries.map((entry, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-medium">{entry.name}</td>
                      <td className="px-3 py-2"><div className="h-4 w-4 rounded" style={{ backgroundColor: entry.color }} /></td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{entry.parentTheme || '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{entry.frequency}</td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{entry.coveragePercent}%</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{entry.examples.join(' | ') || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-750">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Transcript</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Code</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Coded Text</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Annotation</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Case</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {dataRows.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No coded data yet.</td></tr>
                ) : (
                  dataRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[120px] truncate">{row.transcriptTitle}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: row.codeColor }} />
                          <span className="text-gray-700 dark:text-gray-300 font-medium">{row.codeName}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[250px] truncate italic">&ldquo;{row.codedText}&rdquo;</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-[120px] truncate">{row.annotation || '—'}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{row.caseName || '—'}</td>
                      <td className="px-3 py-2 text-gray-400 tabular-nums">{row.createdAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
