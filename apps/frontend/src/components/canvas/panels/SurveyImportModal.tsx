import { useState, useCallback, useMemo, useRef } from 'react';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

interface SurveyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: { title: string; content: string }[], onSaved: () => void) => Promise<void>;
}

interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/**
 * Simple CSV parser matching the backend's csvParser.ts logic.
 */
function parseCSV(content: string): ParsedCSV {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' && current.length === 0) {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
        i++;
      } else if (ch === '\n') {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }

  if (inQuotes) throw new Error('A quoted value is not closed. Check the CSV file and upload it again.');

  if (rows.length === 0) return { headers: [], rows: [] };

  return {
    headers: rows[0],
    // Keep blank data rows so the preview can name every skipped CSV row.
    rows: rows.slice(1),
  };
}

export default function SurveyImportModal({ isOpen, onClose, onImport }: SurveyImportModalProps) {
  // Keep Tab inside the dialog and give focus back to the trigger on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  // The `active` argument matters here: this component stays mounted and the
  // dialog appears conditionally, so the effect must re-run when it opens.
  // Without it the trap initialises once against a null ref and never engages.
  useFocusTrap(dialogRef, isOpen);
  useEscapeToClose(onClose);
  const [csvContent, setCsvContent] = useState('');
  const [titleColumn, setTitleColumn] = useState('');
  const [contentColumn, setContentColumn] = useState('');
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [importing, setImporting] = useState(false);

  const parsed = useMemo(() => {
    if (!csvContent) return null;
    try {
      return parseCSV(csvContent);
    } catch {
      return null;
    }
  }, [csvContent]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      let result: ParsedCSV;
      try {
        result = parseCSV(text);
      } catch (cause) {
        setCsvContent('');
        setError(cause instanceof Error ? cause.message : 'Could not read this CSV. Check the file and try again.');
        return;
      }
      if (result.headers.length === 0) {
        setCsvContent('');
        setError('This CSV is empty. Choose a file with a header row and at least one response.');
        return;
      }
      setCsvContent(text);
      setTitleColumn('');
      setContentColumn('');
      setSavedCount(0);

      // Auto-detect columns
      if (result.headers.length > 0) {
        const headers = result.headers.map((h) => h.toLowerCase());
        const titleIdx = headers.findIndex((h) => h.includes('title') || h.includes('name') || h.includes('id'));
        const contentIdx = headers.findIndex(
          (h) => h.includes('content') || h.includes('response') || h.includes('text') || h.includes('answer'),
        );

        if (titleIdx >= 0) setTitleColumn(result.headers[titleIdx]);
        if (contentIdx >= 0) setContentColumn(result.headers[contentIdx]);
      }
    };
    reader.onerror = () => setError('Could not read this file. Choose the CSV again or try another file.');
    reader.readAsText(file);
  }, []);

  const mappedRows = useMemo(() => {
    const empty: { valid: { title: string; content: string }[]; skippedRows: number[] } = {
      valid: [],
      skippedRows: [],
    };
    if (!parsed || !titleColumn || !contentColumn) return empty;

    const titleIdx = parsed.headers.indexOf(titleColumn);
    const contentIdx = parsed.headers.indexOf(contentColumn);

    if (titleIdx === -1 || contentIdx === -1) return empty;

    const valid: { title: string; content: string }[] = [];
    const skippedRows: number[] = [];
    parsed.rows.forEach((row, i) => {
      const content = row[contentIdx]?.trim() || '';
      if (!content) {
        skippedRows.push(i + 2); // header is CSV row 1; quoted cells may span physical lines
        return;
      }
      valid.push({
        title: row[titleIdx]?.trim() || `Response ${i + 1}`,
        content,
      });
    });
    return { valid, skippedRows };
  }, [parsed, titleColumn, contentColumn]);

  const previewRows = mappedRows.valid.slice(0, 5);

  const handleImport = useCallback(async () => {
    if (importing) return;
    if (!parsed || !titleColumn || !contentColumn) {
      setError('Please select title and content columns');
      return;
    }

    if (mappedRows.valid.length === 0) {
      setError('No rows have response text. Check the content column or choose another CSV.');
      return;
    }

    setImporting(true);
    setError('');
    let savedNow = 0;
    try {
      await onImport(mappedRows.valid.slice(savedCount), () => {
        savedNow += 1;
        setSavedCount(savedCount + savedNow);
      });
      onClose();
    } catch {
      const totalSaved = savedCount + savedNow;
      setError(
        `Saved ${totalSaved} of ${mappedRows.valid.length} responses. The remaining ${mappedRows.valid.length - totalSaved} are still here. Try the remaining responses; saved ones will not be repeated.`,
      );
    } finally {
      setImporting(false);
    }
  }, [parsed, titleColumn, contentColumn, mappedRows, savedCount, importing, onImport, onClose]);

  const handleReset = useCallback(() => {
    if (savedCount > 0 || importing) return;
    setCsvContent('');
    setTitleColumn('');
    setContentColumn('');
    setSavedCount(0);
    setError('');
  }, [savedCount, importing]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-import-title"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 id="survey-import-title" className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Import Survey Data (CSV)
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* File upload */}
          <div>
            <label
              htmlFor="survey-csv-file"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Upload CSV File
            </label>
            <input
              id="survey-csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              disabled={importing || savedCount > 0}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 hover:file:bg-blue-100"
            />
          </div>

          {/* Column mapping */}
          {parsed && parsed.headers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Found {parsed.rows.length} rows with {parsed.headers.length} columns. Map the columns below:
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="survey-title-column"
                    className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
                  >
                    Title Column *
                  </label>
                  <select
                    id="survey-title-column"
                    value={titleColumn}
                    onChange={(e) => setTitleColumn(e.target.value)}
                    disabled={importing || savedCount > 0}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="">Select...</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="survey-content-column"
                    className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
                  >
                    Content Column *
                  </label>
                  <select
                    id="survey-content-column"
                    value={contentColumn}
                    onChange={(e) => setContentColumn(e.target.value)}
                    disabled={importing || savedCount > 0}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="">Select...</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You can assign responses to cases after importing. This importer does not create cases from a CSV
                column.
              </p>
            </div>
          )}

          {/* Preview */}
          {previewRows.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview (first 5 rows)</h3>
              <div className="border border-gray-200 dark:border-gray-600 rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="px-3 py-1.5 text-left text-gray-600 dark:text-gray-400">Title</th>
                      <th className="px-3 py-1.5 text-left text-gray-600 dark:text-gray-400">Content</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200 font-medium">{row.title}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">
                          {row.content.slice(0, 100)}
                          {row.content.length > 100 ? '...' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {mappedRows.valid.length > 5 && (
                <p className="text-xs text-gray-500 mt-1">...and {mappedRows.valid.length - 5} more valid rows</p>
              )}
            </div>
          )}

          {mappedRows.skippedRows.length > 0 && (
            <p role="status" className="text-sm text-amber-800 dark:text-amber-200">
              {mappedRows.skippedRows.length} CSV row{mappedRows.skippedRows.length === 1 ? '' : 's'} without response
              text will not be imported (row {mappedRows.skippedRows.slice(0, 5).join(', ')}
              {mappedRows.skippedRows.length > 5 ? ', and more' : ''}). Check the content column or correct the file if
              that was unexpected.
            </p>
          )}

          {parsed && parsed.rows.length === 0 && (
            <p role="status" className="text-sm text-amber-800 dark:text-amber-200">
              This CSV has headings but no responses. Add response rows and upload it again.
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={handleReset}
            disabled={importing || savedCount > 0}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || mappedRows.valid.length === 0 || savedCount >= mappedRows.valid.length}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing
                ? 'Saving responses...'
                : savedCount > 0
                  ? `Retry ${mappedRows.valid.length - savedCount} remaining row${mappedRows.valid.length - savedCount === 1 ? '' : 's'}`
                  : `Import ${mappedRows.valid.length} valid row${mappedRows.valid.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
