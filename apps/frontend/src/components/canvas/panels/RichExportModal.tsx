import { useMemo, useState } from 'react';
import { useCanvasStore } from '../../../stores/canvasStore';
import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript, CanvasCase, CanvasMemo } from '@canvas-app/shared';
import toast from 'react-hot-toast';

interface RichExportModalProps {
  onClose: () => void;
}

type ExportFormat = 'html' | 'markdown';
type GroupBy = 'code' | 'source' | 'case';

export default function RichExportModal({ onClose }: RichExportModalProps) {
  const { activeCanvas } = useCanvasStore();
  const [format, setFormat] = useState<ExportFormat>('html');
  const [groupBy, setGroupBy] = useState<GroupBy>('code');
  const [includeCodebook, setIncludeCodebook] = useState(true);
  const [includeExcerpts, setIncludeExcerpts] = useState(true);
  const [includeMemos, setIncludeMemos] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeCoverage, setIncludeCoverage] = useState(true);

  const questions = activeCanvas?.questions ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];
  const codings = activeCanvas?.codings ?? [];
  const memos = activeCanvas?.memos ?? [];
  const cases = activeCanvas?.cases ?? [];

  const questionMap = useMemo(() => {
    const m = new Map<string, CanvasQuestion>();
    questions.forEach(q => m.set(q.id, q));
    return m;
  }, [questions]);

  const transcriptMap = useMemo(() => {
    const m = new Map<string, CanvasTranscript>();
    transcripts.forEach(t => m.set(t.id, t));
    return m;
  }, [transcripts]);

  const caseMap = useMemo(() => {
    const m = new Map<string, CanvasCase>();
    cases.forEach(c => m.set(c.id, c));
    return m;
  }, [cases]);

  // Compute coverage per transcript
  const transcriptCoverage = useMemo(() => {
    const coverageMap = new Map<string, { coded: number; total: number; pct: number }>();
    transcripts.forEach((t: CanvasTranscript) => {
      const tCodings = codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
      const codedChars = new Set<number>();
      tCodings.forEach((c: CanvasTextCoding) => {
        for (let i = c.startOffset; i < c.endOffset; i++) codedChars.add(i);
      });
      const pct = t.content.length > 0 ? Math.round((codedChars.size / t.content.length) * 100) : 0;
      coverageMap.set(t.id, { coded: codedChars.size, total: t.content.length, pct });
    });
    return coverageMap;
  }, [transcripts, codings]);

  const generateHTML = (): string => {
    const name = activeCanvas?.name || 'Untitled Canvas';
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const totalWords = transcripts.reduce((sum, t) => sum + t.content.split(/\s+/).filter(Boolean).length, 0);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHTML(name)} — Analysis Report</title>
<style>
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; color: #1f2937; line-height: 1.6; }
  h1 { font-size: 24px; border-bottom: 2px solid #6366f1; padding-bottom: 8px; color: #111827; }
  h2 { font-size: 18px; margin-top: 32px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  h3 { font-size: 14px; margin-top: 20px; color: #4b5563; }
  .meta { color: #6b7280; font-size: 13px; margin-top: 4px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .summary-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
  .summary-card .number { font-size: 24px; font-weight: 700; color: #111827; }
  .summary-card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .code-badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .code-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .excerpt { margin: 8px 0; padding: 10px 14px; background: #f9fafb; border-left: 3px solid #6366f1; border-radius: 0 6px 6px 0; font-size: 13px; }
  .excerpt .source { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  .annotation { margin: 4px 0 0 14px; padding: 6px 10px; background: #fffbeb; border-left: 2px solid #f59e0b; font-size: 12px; color: #92400e; border-radius: 0 4px 4px 0; }
  .coverage-bar { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; width: 120px; display: inline-block; vertical-align: middle; }
  .coverage-fill { height: 100%; border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { background: #f9fafb; font-weight: 600; color: #4b5563; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .memo-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin: 8px 0; }
  .memo-title { font-weight: 600; font-size: 13px; color: #92400e; }
  .memo-content { font-size: 13px; color: #78350f; margin-top: 4px; white-space: pre-wrap; }
  .page-break { page-break-before: always; }
  @media print { body { padding: 20px; } .page-break { page-break-before: always; } }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
<h1>${escHTML(name)}</h1>
<p class="meta">Generated on ${date}</p>
`;

    // Summary section
    if (includeSummary) {
      let totalCoded = 0;
      let totalChars = 0;
      transcriptCoverage.forEach(v => { totalCoded += v.coded; totalChars += v.total; });
      const overallPct = totalChars > 0 ? Math.round((totalCoded / totalChars) * 100) : 0;

      html += `
<h2>Project Summary</h2>
<div class="summary-grid">
  <div class="summary-card"><div class="number">${transcripts.length}</div><div class="label">Sources</div></div>
  <div class="summary-card"><div class="number">${questions.length}</div><div class="label">Codes</div></div>
  <div class="summary-card"><div class="number">${codings.length}</div><div class="label">Excerpts</div></div>
  <div class="summary-card"><div class="number">${overallPct}%</div><div class="label">Coverage</div></div>
</div>
<p class="meta">${totalWords.toLocaleString()} total words across ${transcripts.length} transcript${transcripts.length !== 1 ? 's' : ''}</p>
`;
    }

    // Coverage table
    if (includeCoverage && transcripts.length > 0) {
      html += `<h2>Source Coverage</h2><table><thead><tr><th>Source</th><th>Words</th><th>Coverage</th><th>Codes Applied</th></tr></thead><tbody>`;
      transcripts.forEach((t: CanvasTranscript) => {
        const cov = transcriptCoverage.get(t.id);
        const pct = cov?.pct ?? 0;
        const wordCount = t.content.split(/\s+/).filter(Boolean).length;
        const codeCount = new Set(codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id).map(c => c.questionId)).size;
        const barColor = pct < 30 ? '#f59e0b' : pct < 70 ? '#3b82f6' : '#10b981';
        html += `<tr><td>${escHTML(t.title)}</td><td>${wordCount.toLocaleString()}</td><td><div class="coverage-bar"><div class="coverage-fill" style="width:${pct}%;background:${barColor}"></div></div> ${pct}%</td><td>${codeCount}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    // Codebook section
    if (includeCodebook) {
      html += `<h2>Codebook</h2><table><thead><tr><th>Code</th><th>Parent Theme</th><th>Frequency</th><th>Coverage</th></tr></thead><tbody>`;
      const totalChars = transcripts.reduce((s, t) => s + t.content.length, 0);
      questions.forEach((q: CanvasQuestion) => {
        const qCodings = codings.filter((c: CanvasTextCoding) => c.questionId === q.id);
        const codedChars = qCodings.reduce((s, c) => s + (c.endOffset - c.startOffset), 0);
        const covPct = totalChars > 0 ? Math.round((codedChars / totalChars) * 1000) / 10 : 0;
        const parentQ = q.parentQuestionId ? questionMap.get(q.parentQuestionId) : null;
        html += `<tr><td><span class="code-badge"><span class="code-dot" style="background:${q.color}"></span>${escHTML(q.text)}</span></td><td>${parentQ ? escHTML(parentQ.text) : '—'}</td><td>${qCodings.length}</td><td>${covPct}%</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    // Excerpts section
    if (includeExcerpts) {
      html += `<div class="page-break"></div><h2>Coded Excerpts</h2>`;

      if (groupBy === 'code') {
        questions.forEach((q: CanvasQuestion) => {
          const qCodings = codings.filter((c: CanvasTextCoding) => c.questionId === q.id);
          if (qCodings.length === 0) return;
          html += `<h3><span class="code-dot" style="background:${q.color}"></span> ${escHTML(q.text)} <span style="color:#9ca3af;font-weight:400">(${qCodings.length})</span></h3>`;
          qCodings.forEach((c: CanvasTextCoding) => {
            const t = transcriptMap.get(c.transcriptId);
            html += `<div class="excerpt">&ldquo;${escHTML(c.codedText)}&rdquo;<div class="source">${escHTML(t?.title || 'Unknown')} (chars ${c.startOffset}–${c.endOffset})</div></div>`;
            if (c.annotation) html += `<div class="annotation">${escHTML(c.annotation)}</div>`;
          });
        });
      } else if (groupBy === 'source') {
        transcripts.forEach((t: CanvasTranscript) => {
          const tCodings = codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
          if (tCodings.length === 0) return;
          html += `<h3>${escHTML(t.title)} <span style="color:#9ca3af;font-weight:400">(${tCodings.length} excerpts)</span></h3>`;
          tCodings.forEach((c: CanvasTextCoding) => {
            const q = questionMap.get(c.questionId);
            html += `<div class="excerpt" style="border-left-color:${q?.color || '#6366f1'}">&ldquo;${escHTML(c.codedText)}&rdquo;<div class="source"><span class="code-badge"><span class="code-dot" style="background:${q?.color || '#888'}"></span>${escHTML(q?.text || 'Unknown')}</span></div></div>`;
            if (c.annotation) html += `<div class="annotation">${escHTML(c.annotation)}</div>`;
          });
        });
      } else {
        // Group by case
        const uncased = transcripts.filter(t => !t.caseId);
        const caseGroups = cases.map(c => ({
          case: c,
          transcripts: transcripts.filter((t: CanvasTranscript) => t.caseId === c.id),
        }));

        [...caseGroups, { case: null as CanvasCase | null, transcripts: uncased }].forEach(group => {
          if (group.transcripts.length === 0) return;
          const tIds = new Set(group.transcripts.map(t => t.id));
          const caseCodings = codings.filter((c: CanvasTextCoding) => tIds.has(c.transcriptId));
          if (caseCodings.length === 0) return;
          html += `<h3>${group.case ? escHTML(group.case.name) : 'Uncategorized'} <span style="color:#9ca3af;font-weight:400">(${caseCodings.length} excerpts)</span></h3>`;
          caseCodings.forEach((c: CanvasTextCoding) => {
            const q = questionMap.get(c.questionId);
            const t = transcriptMap.get(c.transcriptId);
            html += `<div class="excerpt" style="border-left-color:${q?.color || '#6366f1'}">&ldquo;${escHTML(c.codedText)}&rdquo;<div class="source">${escHTML(t?.title || 'Unknown')} · <span class="code-badge"><span class="code-dot" style="background:${q?.color || '#888'}"></span>${escHTML(q?.text || 'Unknown')}</span></div></div>`;
            if (c.annotation) html += `<div class="annotation">${escHTML(c.annotation)}</div>`;
          });
        });
      }
    }

    // Memos section
    if (includeMemos && memos.length > 0) {
      html += `<div class="page-break"></div><h2>Research Memos</h2>`;
      memos.forEach((m: CanvasMemo) => {
        html += `<div class="memo-card"><div class="memo-title">${escHTML(m.title || 'Memo')}</div><div class="memo-content">${escHTML(m.content)}</div></div>`;
      });
    }

    html += `
<div class="footer">
  <p>Generated by Canvas App &middot; ${date}</p>
</div>
</body></html>`;

    return html;
  };

  const generateMarkdown = (): string => {
    const name = activeCanvas?.name || 'Untitled Canvas';
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    let md = `# ${name}\n\n*Generated on ${date}*\n\n`;

    if (includeSummary) {
      let totalCoded = 0;
      let totalChars = 0;
      transcriptCoverage.forEach(v => { totalCoded += v.coded; totalChars += v.total; });
      const overallPct = totalChars > 0 ? Math.round((totalCoded / totalChars) * 100) : 0;
      md += `## Project Summary\n\n| Metric | Value |\n|--------|-------|\n| Sources | ${transcripts.length} |\n| Codes | ${questions.length} |\n| Excerpts | ${codings.length} |\n| Coverage | ${overallPct}% |\n\n`;
    }

    if (includeCoverage && transcripts.length > 0) {
      md += `## Source Coverage\n\n| Source | Words | Coverage | Codes |\n|--------|-------|----------|-------|\n`;
      transcripts.forEach((t: CanvasTranscript) => {
        const cov = transcriptCoverage.get(t.id);
        const pct = cov?.pct ?? 0;
        const wordCount = t.content.split(/\s+/).filter(Boolean).length;
        const codeCount = new Set(codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id).map(c => c.questionId)).size;
        md += `| ${t.title} | ${wordCount.toLocaleString()} | ${pct}% | ${codeCount} |\n`;
      });
      md += '\n';
    }

    if (includeCodebook) {
      md += `## Codebook\n\n| Code | Parent Theme | Frequency |\n|------|-------------|------------|\n`;
      questions.forEach((q: CanvasQuestion) => {
        const count = codings.filter((c: CanvasTextCoding) => c.questionId === q.id).length;
        const parentQ = q.parentQuestionId ? questionMap.get(q.parentQuestionId) : null;
        md += `| ${q.text} | ${parentQ?.text || '—'} | ${count} |\n`;
      });
      md += '\n';
    }

    if (includeExcerpts) {
      md += `## Coded Excerpts\n\n`;
      if (groupBy === 'code') {
        questions.forEach((q: CanvasQuestion) => {
          const qCodings = codings.filter((c: CanvasTextCoding) => c.questionId === q.id);
          if (qCodings.length === 0) return;
          md += `### ${q.text} (${qCodings.length})\n\n`;
          qCodings.forEach((c: CanvasTextCoding) => {
            const t = transcriptMap.get(c.transcriptId);
            md += `> "${c.codedText}"\n> — *${t?.title || 'Unknown'}*\n\n`;
            if (c.annotation) md += `*Note: ${c.annotation}*\n\n`;
          });
        });
      } else if (groupBy === 'source') {
        transcripts.forEach((t: CanvasTranscript) => {
          const tCodings = codings.filter((c: CanvasTextCoding) => c.transcriptId === t.id);
          if (tCodings.length === 0) return;
          md += `### ${t.title} (${tCodings.length} excerpts)\n\n`;
          tCodings.forEach((c: CanvasTextCoding) => {
            const q = questionMap.get(c.questionId);
            md += `> "${c.codedText}"\n> — *[${q?.text || 'Unknown'}]*\n\n`;
            if (c.annotation) md += `*Note: ${c.annotation}*\n\n`;
          });
        });
      } else {
        const uncased = transcripts.filter(t => !t.caseId);
        const caseGroups = cases.map(c => ({ case: c, transcripts: transcripts.filter((t: CanvasTranscript) => t.caseId === c.id) }));
        [...caseGroups, { case: null as CanvasCase | null, transcripts: uncased }].forEach(group => {
          if (group.transcripts.length === 0) return;
          const tIds = new Set(group.transcripts.map(t => t.id));
          const caseCodings = codings.filter((c: CanvasTextCoding) => tIds.has(c.transcriptId));
          if (caseCodings.length === 0) return;
          md += `### ${group.case?.name || 'Uncategorized'} (${caseCodings.length} excerpts)\n\n`;
          caseCodings.forEach((c: CanvasTextCoding) => {
            const q = questionMap.get(c.questionId);
            const t = transcriptMap.get(c.transcriptId);
            md += `> "${c.codedText}"\n> — *${t?.title || 'Unknown'}* · [${q?.text || 'Unknown'}]\n\n`;
          });
        });
      }
    }

    if (includeMemos && memos.length > 0) {
      md += `## Research Memos\n\n`;
      memos.forEach((m: CanvasMemo) => {
        md += `### ${m.title || 'Memo'}\n\n${m.content}\n\n---\n\n`;
      });
    }

    md += `\n---\n*Generated by Canvas App · ${date}*\n`;
    return md;
  };

  const handleExport = () => {
    const content = format === 'html' ? generateHTML() : generateMarkdown();
    const mimeType = format === 'html' ? 'text/html' : 'text/markdown';
    const ext = format === 'html' ? 'html' : 'md';
    const filename = `${activeCanvas?.name || 'report'}-analysis-report.${ext}`;

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Report downloaded as ${ext.toUpperCase()}`);
  };

  const handlePreview = () => {
    const content = generateHTML();
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(content);
      win.document.close();
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="modal-content w-[520px] rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Export Analysis Report</h3>
              <p className="text-[10px] text-gray-400">Formatted report for publication or sharing</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Options */}
        <div className="px-5 py-4 space-y-4">
          {/* Format */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Format</label>
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={() => setFormat('html')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${format === 'html' ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <div className="font-semibold">HTML</div>
                <div className="text-[10px] mt-0.5 opacity-70">Opens in Word, browser, print-ready</div>
              </button>
              <button
                onClick={() => setFormat('markdown')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${format === 'markdown' ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <div className="font-semibold">Markdown</div>
                <div className="text-[10px] mt-0.5 opacity-70">Plain text, GitHub-compatible</div>
              </button>
            </div>
          </div>

          {/* Group by */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Group Excerpts By</label>
            <div className="flex gap-2 mt-1.5">
              {[
                { value: 'code' as GroupBy, label: 'Code', icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712' },
                { value: 'source' as GroupBy, label: 'Source', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5' },
                { value: 'case' as GroupBy, label: 'Case', icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setGroupBy(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${groupBy === opt.value ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Include Sections</label>
            <div className="mt-1.5 space-y-1.5">
              {[
                { checked: includeSummary, onChange: setIncludeSummary, label: 'Project summary & statistics' },
                { checked: includeCoverage, onChange: setIncludeCoverage, label: 'Per-source coverage table' },
                { checked: includeCodebook, onChange: setIncludeCodebook, label: 'Codebook (codes, frequencies)' },
                { checked: includeExcerpts, onChange: setIncludeExcerpts, label: `All coded excerpts (${codings.length})` },
                { checked: includeMemos, onChange: setIncludeMemos, label: `Research memos (${memos.length})` },
              ].map((opt, i) => (
                <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={e => opt.onChange(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-300 transition-colors">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-5 py-3">
          {format === 'html' && (
            <button
              onClick={handlePreview}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Preview
            </button>
          )}
          {format !== 'html' && <div />}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download Report
          </button>
        </div>
      </div>
    </div>
  );
}

function escHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
