import { useState } from 'react';
import { useActiveCanvas } from '../../../stores/canvasStore';
import toast from 'react-hot-toast';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { useAuthStore } from '../../../stores/authStore';
import {
  generateReportDocxBlob,
  generateReportHtml,
  generateReportMarkdown,
  type GroupBy,
  type ReportInput,
} from './richExportContent';

interface RichExportModalProps {
  onClose: () => void;
}

type ExportFormat = 'docx' | 'html' | 'markdown';

export default function RichExportModal({ onClose }: RichExportModalProps) {
  useEscapeToClose(onClose);
  const activeCanvas = useActiveCanvas();
  const effectivePlan = useAuthStore((state) => state.effectivePlan ?? state.plan ?? 'free');
  // Word first — it's the format researchers actually need for supervisors,
  // committees, and repositories.
  const [format, setFormat] = useState<ExportFormat>('docx');
  const [exporting, setExporting] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('code');
  const [includeCodebook, setIncludeCodebook] = useState(true);
  const [includeExcerpts, setIncludeExcerpts] = useState(true);
  const [includeMemos, setIncludeMemos] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeCoverage, setIncludeCoverage] = useState(true);

  const questions = activeCanvas?.questions ?? [];
  const transcripts = activeCanvas?.transcripts ?? [];
  const codings = activeCanvas?.codings ?? [];
  const cases = activeCanvas?.cases ?? [];
  const memos = activeCanvas?.memos ?? [];

  // The report bodies live in richExportContent.ts so they can be tested
  // against the file they actually produce.
  const buildReportInput = (): ReportInput => ({
    canvasName: activeCanvas?.name || 'Untitled Canvas',
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    questions,
    transcripts,
    codings,
    cases,
    memos,
    groupBy,
    includeCodebook,
    includeExcerpts,
    includeMemos,
    includeSummary,
    includeCoverage,
  });

  const handleExport = async () => {
    if (effectivePlan === 'free') {
      toast.error('Formatted reports are available on Student, Pro, and Team plans.');
      return;
    }
    try {
      setExporting(true);
      let blob: Blob;
      let ext: string;
      const input = buildReportInput();
      if (format === 'docx') {
        blob = await generateReportDocxBlob(input);
        ext = 'docx';
      } else {
        const content = format === 'html' ? generateReportHtml(input) : generateReportMarkdown(input);
        const mimeType = format === 'html' ? 'text/html' : 'text/markdown';
        ext = format === 'html' ? 'html' : 'md';
        blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
      }
      const filename = `${activeCanvas?.name || 'report'}-analysis-report.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(format === 'docx' ? 'Word report downloaded' : `Report downloaded as ${ext.toUpperCase()}`);
    } catch {
      toast.error('Export failed — please try again');
    } finally {
      setExporting(false);
    }
  };

  const handlePreview = () => {
    if (effectivePlan === 'free') {
      toast.error('Formatted reports are available on Student, Pro, and Team plans.');
      return;
    }
    const content = generateReportHtml(buildReportInput());
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(content);
      win.document.close();
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="modal-content w-[520px] rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rich-export-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <svg
                className="h-4 w-4 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
            </div>
            <div>
              <h3 id="rich-export-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Export Analysis Report
              </h3>
              <p className="text-[10px] text-gray-400">Formatted report for publication or sharing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            <span>Close</span>
          </button>
        </div>

        {/* Options */}
        <div className="px-5 py-4 space-y-4">
          {/* Format */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Format
            </label>
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={() => setFormat('docx')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${format === 'docx' ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <div className="font-semibold">Word</div>
                <div className="text-[10px] mt-0.5 opacity-70">.docx — for supervisors & repositories</div>
              </button>
              <button
                onClick={() => setFormat('html')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${format === 'html' ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <div className="font-semibold">Web page</div>
                <div className="text-[10px] mt-0.5 opacity-70">HTML — opens in a browser, print-ready</div>
              </button>
              <button
                onClick={() => setFormat('markdown')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${format === 'markdown' ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <div className="font-semibold">Plain text</div>
                <div className="text-[10px] mt-0.5 opacity-70">Markdown — for notes & version control</div>
              </button>
            </div>
          </div>

          {/* Group by */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Group Excerpts By
            </label>
            <div className="flex gap-2 mt-1.5">
              {[
                {
                  value: 'code' as GroupBy,
                  label: 'Code',
                  icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712',
                },
                {
                  value: 'source' as GroupBy,
                  label: 'Source',
                  icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5',
                },
                {
                  value: 'case' as GroupBy,
                  label: 'Case',
                  icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
                },
              ].map((opt) => (
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
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Include Sections
            </label>
            <div className="mt-1.5 space-y-1.5">
              {[
                { checked: includeSummary, onChange: setIncludeSummary, label: 'Project summary & statistics' },
                { checked: includeCoverage, onChange: setIncludeCoverage, label: 'Per-source coverage table' },
                { checked: includeCodebook, onChange: setIncludeCodebook, label: 'Codebook (codes, frequencies)' },
                {
                  checked: includeExcerpts,
                  onChange: setIncludeExcerpts,
                  label: `All coded excerpts (${codings.length})`,
                },
                { checked: includeMemos, onChange: setIncludeMemos, label: `Research memos (${memos.length})` },
              ].map((opt, i) => (
                <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={(e) => opt.onChange(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-300 transition-colors">
                    {opt.label}
                  </span>
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Preview
            </button>
          )}
          {format !== 'html' && <div />}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-60"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            {exporting ? 'Preparing…' : 'Download Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
